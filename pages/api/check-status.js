import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  const { phone } = req.body;

  const { data } = await supabase
    .from('telegram_sessions')
    .select('session_string')
    .eq('phone_number', phone)
    .single();

  if (!data) return res.status(404).json({ status: 'error', msg: 'Não encontrado' });

  const client = new TelegramClient(new StringSession(data.session_string), apiId, apiHash, {
    connectionRetries: 2,
    useWSS: false,
  });

  try {
    await client.connect();
    // Tenta pegar os dados do próprio usuário ("Quem sou eu?")
    const me = await client.getMe();
    await client.disconnect();

    if (me) {
        // Reativa no banco se estiver marcado como inativo
        await supabase.from('telegram_sessions').update({ is_active: true }).eq('phone_number', phone);
        return res.status(200).json({ status: 'alive', username: me.username, name: me.firstName });
    }
  } catch (error) {
    // Se falhar a conexão, marca como inativo/banido
    await supabase.from('telegram_sessions').update({ is_active: false }).eq('phone_number', phone);
    return res.status(200).json({ status: 'dead', error: error.message });
  }
  
  return res.status(200).json({ status: 'unknown' });
}
