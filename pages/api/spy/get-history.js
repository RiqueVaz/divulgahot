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
    
    // Pega as últimas 15 mensagens
    const msgs = await client.getMessages(chatId, { limit: 15 });
    
    const history = [];

    for (const m of msgs) {
        let mediaBase64 = null;
        
        // Tenta baixar foto se existir
        if (m.media && m.media.photo) {
            try {
                const buffer = await client.downloadMedia(m, { workers: 1 });
                if (buffer) {
                    mediaBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                }
            } catch (err) {
                console.log('Erro mídia:', err.message);
            }
        }

        history.push({
            id: m.id,
            text: m.message || '',
            sender: m.sender?.firstName || 'Desconhecido',
            isOut: m.out,
            date: m.date,
            media: mediaBase64,
            hasMedia: !!m.media
        });
    }

    await client.disconnect();
    res.json({ history: history.reverse() });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
