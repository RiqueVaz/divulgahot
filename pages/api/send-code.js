import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  const { phoneNumber } = req.body;

  // Cria uma sessão vazia
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });
  
  await client.connect();

  // 1. Pede pro Telegram enviar o código para o app do lead
  const { phoneCodeHash } = await client.sendCode(
    { apiId, apiHash },
    phoneNumber
  );

  // 2. Salva a chave de autenticação temporária gerada no handshake
  const tempSession = client.session.save();

  // 3. Guarda no Supabase para usar na próxima rota
  await supabase.from('auth_state').upsert({
    phone_number: phoneNumber,
    phone_code_hash: phoneCodeHash,
    temp_session: tempSession
  });

  await client.disconnect();
  res.status(200).json({ success: true });
}
