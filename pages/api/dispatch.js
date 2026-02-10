import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

// Função Auxiliar: Spintax (Gira o texto para variar mensagens)
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

  // 1. Processa o Spintax (Gera a variação única desta mensagem)
  const finalMessage = spinText(message);

  // 2. Tratamento do Alvo (ID Numérico vs Username)
  if (/^\d+$/.test(target)) {
    try {
        target = BigInt(target); // Converte para BigInt se for apenas números (ID)
    } catch (e) {
        return res.status(400).json({ error: "ID de usuário inválido" });
    }
  }

  // 3. Busca a sessão do remetente no banco
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

    // --- SIMULAÇÃO HUMANA ---
    // Avisa que está "Digitando..." por 2 a 4 segundos (aleatório)
    const typingTime = Math.floor(Math.random() * 2000) + 2000;
    await client.invoke(new Api.messages.SetTyping({
        peer: target,
        action: new Api.SendMessageTypingAction()
    }));
    await new Promise(r => setTimeout(r, typingTime)); 

    // 4. Envia a Mensagem
    await client.sendMessage(target, { 
      message: finalMessage,
      parseMode: "markdown", // Permite links mascarados [Texto](Url)
      linkPreview: true      // Mostra a foto do site (aumenta conversão)
    });
    
    await client.disconnect();

    // 5. Atualiza o Status na tabela NOVA (leads_hottrack)
    if (leadDbId) {
        await supabase.from('leads_hottrack')
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

    let errorMessage = error.message || 'Erro desconhecido';

    // Se a conta caiu/foi desconectada
    if (errorMessage.includes('AUTH_KEY') || errorMessage.includes('SESSION_REVOKED')) {
        await supabase.from('telegram_sessions').update({ is_active: false }).eq('phone_number', senderPhone);
        errorMessage = 'Conta desconectada ou banida';
    }

    // Se falhou, marca na tabela NOVA (leads_hottrack)
    if (leadDbId) {
        await supabase.from('leads_hottrack')
            .update({ status: 'failed' })
            .eq('id', leadDbId);
    }
    
    return res.status(500).json({ error: errorMessage });
  }
}
