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
    const { data: sessionData } = await supabase
      .from('telegram_sessions')
      .select('session_string')
      .eq('phone_number', phone)
      .single();

    if (!sessionData) return res.status(404).json({ error: 'Conta offline.' });

    const client = new TelegramClient(new StringSession(sessionData.session_string), apiId, apiHash, {
      connectionRetries: 1, useWSS: false 
    });
    
    await client.connect();
    
    let targetId = chatId;
    let finalSource = chatName;

    // --- LÓGICA DE CANAIS/SUPERGRUPOS ---
    // Se for canal broadcast, tenta achar o vinculado.
    if (isChannel) {
        try {
            const fullChannel = await client.invoke(new Api.channels.GetFullChannel({
                channel: chatId
            }));
            if (fullChannel.fullChat.linkedChatId) {
                targetId = fullChannel.fullChat.linkedChatId.toString();
                finalSource = `${chatName} (Comentários)`;
            } else {
                // Tenta forçar como se fosse Megagroup (às vezes a flag vem errada)
                targetId = chatId; 
            }
        } catch (e) {
             // Se falhar a análise, tenta extrair do próprio ID (vai que é supergrupo)
             targetId = chatId;
        }
    }

    // --- MODO ASPIRADOR DE PÓ (GetParticipants com Filtro) ---
    // Em vez de pegar aleatório, pedimos os RECENTES (gente ativa)
    let participants = [];
    try {
        // Tenta pegar os RECENTES primeiro (ouro puro)
        const recent = await client.getParticipants(targetId, { 
            limit: 4000,
            filter: new Api.ChannelParticipantsRecent() 
        });
        participants = recent;

        // Se vier pouco (menos de 100) em um grupo gigante, tenta busca padrão
        if (participants.length < 100) {
            const all = await client.getParticipants(targetId, { limit: 4000 });
            participants = all;
        }

    } catch (e) {
        await client.disconnect();
        return res.status(400).json({ error: "Grupo privado ou oculto (Anti-Scraping ativo)." });
    }

    const leads = [];
    for (const p of participants) {
      // FILTRO MENOS AGRESSIVO: Aceita quem não tem username
      // A única coisa que ignoramos é BOT, DELETADO e VOCÊ MESMO
      if (!p.bot && !p.deleted && !p.isSelf) { 
        
        const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
        
        leads.push({
            user_id: p.id.toString(),
            // Se não tiver username, salva null (o disparo funciona pelo ID)
            username: p.username ? `@${p.username}` : null,
            name: name || 'Sem Nome',
            phone: p.phone || null,
            origin_group: finalSource,
            chat_id: targetId.toString(),
            status: 'pending',
            message_log: `Extraído de ${finalSource}`
        });
      }
    }

    // Upsert em Lote (Lida com duplicatas automaticamente)
    if (leads.length > 0) {
        const { error } = await supabase.from('leads_hottrack').upsert(leads, { 
            onConflict: 'user_id', ignoreDuplicates: true 
        });
        if(error) throw error;
    }

    await client.disconnect();
    
    res.status(200).json({ success: true, count: leads.length, message: `${leads.length} leads sugados de ${finalSource}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
