import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  const { phone } = req.body;

  const { data } = await supabase.from('telegram_sessions').select('session_string').eq('phone_number', phone).single();
  if (!data) return res.status(404).json({ error: 'Sessão off' });

  const client = new TelegramClient(new StringSession(data.session_string), apiId, apiHash, { connectionRetries: 1, useWSS: false });

  try {
    await client.connect();
    
    // Pega os últimos 30 chats (Grupos e Canais)
    const dialogs = await client.getDialogs({ limit: 30 });
    
    const chats = dialogs
      .filter(d => d.isGroup || d.isChannel)
      .map(d => ({
        id: d.id.toString(),
        title: d.title,
        type: d.isChannel ? 'Canal' : 'Grupo',
        participants_count: d.entity.participantsCount || '?'
      }));

    await client.disconnect();
    res.status(200).json({ chats });

  } catch (error) {
    await client.disconnect();
    res.status(500).json({ error: error.message });
  }
}
