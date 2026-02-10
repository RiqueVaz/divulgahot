import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  const { phone, chatId, chatName } = req.body;

  const { data } = await supabase.from('telegram_sessions').select('session_string').eq('phone_number', phone).single();
  const client = new TelegramClient(new StringSession(data.session_string), apiId, apiHash, { connectionRetries: 1, useWSS: false });

  try {
    await client.connect();
    
    // Pega participantes (Limitado a 100 por vez para não estourar a Vercel)
    // O ideal é filtrar por 'recent' para pegar gente ativa
    const participants = await client.getParticipants(chatId, { limit: 100 });
    
    const leads = [];
    
    for (const p of participants) {
      if (!p.bot && !p.deleted) { // Ignora bots e contas excluídas
        leads.push({
            user_id: p.id.toString(),
            username: p.username ? `@${p.username}` : null,
            origin_group: chatName,
            extracted_by: phone
        });
      }
    }

    // Salva no Supabase (ignoreDuplicates evita erro se já existir)
    const { error } = await supabase.from('harvested_leads').upsert(leads, { onConflict: 'user_id, origin_group', ignoreDuplicates: true });

    await client.disconnect();
    
    if(error) throw error;
    res.status(200).json({ success: true, count: leads.length });

  } catch (error) {
    await client.disconnect();
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao extrair" });
  }
}
