import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

// Função Auxiliar: Spintax (Gira o texto)
function spinText(text) {
  if (!text) return "";
  return text.replace(/{([^{}]+)}/g, (match, content) => {
    const choices = content.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  let { senderPhone, target, message, leadDbId } = req.body;

  // 1. Processa o Spintax
  const finalMessage = spinText(message);

  // 2. Prepara a Mensagem com "Botão Fake" (Markdown)
  // Isso cria um link clicável bonito se você usar [Texto](Link) na mensagem
  const messageWithMarkdown = finalMessage; 

  // 3. Tratamento do Alvo (ID Numérico vs Username)
  if (/^\d+$/.test(target)) {
    try {
        target = BigInt(target); // Converte para BigInt se for apenas números
    } catch (e) {
        return res.status(400).json({ error: "ID de usuário inválido" });
    }
  }

  // 4. Busca a sessão no banco
  const { data } = await supabase
    .from('telegram_sessions')
    .select('session_string')
    .eq('phone_number', senderPhone)
    .single();

  if (!data) return res.status(404).json({ error: 'Sessão do disparador não encontrada.' });

  const client = new TelegramClient(new StringSession(data.session_string), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false, 
  });

  try {
    await client.connect();

    // --- FUNCIONALIDADE EXTRA: SIMULAÇÃO HUMANA ---
    // Avisa que está "Digitando..." por 2 segundos
    await client.invoke(new Api.messages.SetTyping({
        peer: target,
        action: new Api.SendMessageTypingAction()
    }));
    await new Promise(r => setTimeout(r, 2000)); // Delay fake

    // 5. Envia a Mensagem
    await client.sendMessage(target, { 
      message: messageWithMarkdown,
      parseMode: "markdown", // Permite links mascarados [Texto](Url)
      linkPreview: true      // Mostra a foto do site (aumenta conversão)
    });
    
    await client.disconnect();

    // 6. Atualiza o Status no CRM (Se veio do disparo automático)
    if (leadDbId) {
        await supabase.from('harvested_leads')
            .update({ status: 'sent', last_contacted_at: new Date() })
            .eq('id', leadDbId);
    }
    
    return res.status(200).json({ 
      success: true, 
      status: 'Enviado', 
      msg_sent: finalMessage 
    });

  } catch (error) {
    await client.disconnect();
    
    console.error(`Erro no disparo de ${senderPhone}:`, error);

    // Tratamento de Erros Específicos
    let errorMessage = error.message || 'Erro desconhecido';

    // Se o erro for grave (Ban/Revoked), inativa a conta
    if (errorMessage.includes('AUTH_KEY') || errorMessage.includes('SESSION_REVOKED')) {
        await supabase.from('telegram_sessions').update({ is_active: false }).eq('phone_number', senderPhone);
        errorMessage = 'Conta desconectada ou banida';
    }

    // Se tiver ID do banco, marca como falha
    if (leadDbId) {
        await supabase.from('harvested_leads')
            .update({ status: 'failed' })
            .eq('id', leadDbId);
    }
    
    return res.status(500).json({ error: errorMessage });
  }
}
