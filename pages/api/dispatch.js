import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { senderPhone, targetUsername, message } = req.body;

  // 1. Busca a sessão completa (com a chave secreta) no banco
  const { data } = await supabase
    .from('telegram_sessions')
    .select('session_string')
    .eq('phone_number', senderPhone)
    .single();

  if (!data) return res.status(404).json({ error: 'Sessão não encontrada.' });

  // 2. Conecta usando a conta do usuário
  const client = new TelegramClient(new StringSession(data.session_string), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false, // Importante para rodar na Vercel
  });

  try {
    await client.connect();

    // 3. Envia a mensagem
    await client.sendMessage(targetUsername, { message: message });
    
    await client.disconnect();
    
    return res.status(200).json({ success: true, status: 'Mensagem enviada!' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Erro ao enviar' });
  }
}
