import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  const { phone, chatId } = req.body;
  
  const { data } = await supabase.from('telegram_sessions').select('session_string').eq('phone_number', phone).single();
  if(!data) return res.status(400).json({error: 'Sessão não encontrada'});

  const client = new TelegramClient(new StringSession(data.session_string), apiId, apiHash, { connectionRetries: 1, useWSS: false });

  try {
    await client.connect();
    // Pega ultimas 20 mensagens
    const msgs = await client.getMessages(chatId, { limit: 20 });
    
    const history = msgs.map(m => ({
        id: m.id,
        text: m.message || (m.media ? '[Mídia/Arquivo]' : ''),
        sender: m.sender?.firstName || 'Desconhecido',
        isOut: m.out,
        date: m.date,
        hasMedia: !!m.media
    })).reverse();

    await client.disconnect();
    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
