import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { phone, chatId, chatName, isChannel } = req.body;

  try {
    const { data: sessionData } = await supabase.from('telegram_sessions').select('session_string').eq('phone_number', phone).single();
    if (!sessionData) return res.status(404).json({ error: 'Conta offline.' });

    const client = new TelegramClient(new StringSession(sessionData.session_string), apiId, apiHash, { connectionRetries: 1, useWSS: false });
    await client.connect();
    
    let targetId = chatId;
    let finalSource = chatName;

    // Detecta Linked Chat de Canais
    if (isChannel) {
        try {
            const fullChannel = await client.invoke(new Api.channels.GetFullChannel({ channel: chatId }));
            if (fullChannel.fullChat.linkedChatId) {
                targetId = fullChannel.fullChat.linkedChatId.toString();
                finalSource = `${chatName} (Comentários)`;
            } else {
                targetId = chatId; // Tenta extrair direto se não tiver link (pode ser supergrupo mal classificado)
            }
        } catch (e) { targetId = chatId; }
    }

    // Busca Leads (Modo Aspirador)
    let participants = [];
    try {
        const recent = await client.getParticipants(targetId, { limit: 4000, filter: new Api.ChannelParticipantsRecent() });
        participants = recent.length > 50 ? recent : await client.getParticipants(targetId, { limit: 4000 });
    } catch (e) {
        await client.disconnect();
        return res.status(400).json({ error: "Privado/Oculto." });
    }

    const leads = [];
    for (const p of participants) {
      if (!p.bot && !p.deleted && !p.isSelf) { 
        const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
        leads.push({
            user_id: p.id.toString(),
            username: p.username ? `@${p.username}` : null,
            name: name || 'Sem Nome',
            phone: p.phone || null,
            origin_group: finalSource,
            chat_id: targetId.toString(),
            status: 'pending'
        });
      }
    }

    if (leads.length > 0) {
        await supabase.from('leads_hottrack').upsert(leads, { onConflict: 'user_id', ignoreDuplicates: true });
        
        // --- MARCAR COMO COLHIDO ---
        await supabase.from('harvested_sources').upsert({
            chat_id: chatId.toString(), // Salva o ID original (do botão que vc clicou)
            title: chatName,
            leads_count: leads.length,
            extracted_by: phone,
            harvested_at: new Date()
        }, { onConflict: 'chat_id' });
    }

    await client.disconnect();
    res.status(200).json({ success: true, count: leads.length, message: `${leads.length} leads de ${finalSource}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
