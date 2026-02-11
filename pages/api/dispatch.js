import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomFile } from "telegram/client/uploads";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

function spinText(text) {
  if (!text) return "";
  return text.replace(/{([^{}]+)}/g, (match, content) => {
    const choices = content.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  let { senderPhone, target, username, message, imageUrl, leadDbId } = req.body;
  const finalMessage = spinText(message);

  const { data } = await supabase.from('telegram_sessions').select('session_string').eq('phone_number', senderPhone).single();
  if (!data) return res.status(404).json({ error: 'Sessão offline.' });

  const client = new TelegramClient(new StringSession(data.session_string), apiId, apiHash, { 
    connectionRetries: 2, 
    useWSS: false 
  });

  try {
    await client.connect();

    let finalPeer = null;

    // --- NÍVEL 1: Prioridade Máxima para Username (99% de sucesso) ---
    if (username) {
        try {
            // Remove o @ se vier e tenta buscar
            finalPeer = await client.getInputEntity(username.replace('@', ''));
        } catch (e) { 
            console.log(`[${senderPhone}] Falha ao resolver username ${username}, tentando ID...`); 
        }
    }

    // --- NÍVEL 2: Tenta ID Numérico (Se falhou username ou não tem) ---
    if (!finalPeer && target) {
        try {
            finalPeer = await client.getInputEntity(BigInt(target));
        } catch (e) {
            // --- NÍVEL 3: Força Bruta (Busca Global para popular Cache) ---
            try {
                // Tenta "ver" o usuário para o Telegram baixar os dados dele
                const result = await client.invoke(new Api.users.GetFullUser({ id: target }));
                finalPeer = result.users[0]; // Pega a entidade resolvida
            } catch (innerE) {
                // Se falhar aqui, o usuário realmente não existe ou bloqueou busca
                await client.disconnect();
                
                // Marca erro específico no banco para não tentar de novo à toa
                if (leadDbId) {
                    await supabase.from('leads_hottrack')
                        .update({ status: 'failed', message_log: 'Usuário Inacessível/Privado' })
                        .eq('id', leadDbId);
                }
                throw new Error("Usuário inacessível (Privacidade ou Cache).");
            }
        }
    }

    // --- SIMULAÇÃO HUMANA (Anti-Ban) ---
    // Envia sinal de "Digitando..." ou "Enviando Foto..."
    const action = imageUrl ? new Api.SendMessageUploadPhotoAction() : new Api.SendMessageTypingAction();
    await client.invoke(new Api.messages.SetTyping({ peer: finalPeer, action }));
    
    // Delay aleatório (1.5s a 3s)
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1500) + 1500)); 

    let sentMsg;
    if (imageUrl) {
        const mediaRes = await fetch(imageUrl);
        if (!mediaRes.ok) throw new Error("Imagem inválida.");
        const buffer = Buffer.from(await mediaRes.arrayBuffer());
        
        const toUpload = new CustomFile("img.jpg", buffer.byteLength, "image/jpeg", buffer);
        const uploadedFile = await client.uploadFile({ file: toUpload, workers: 1 });

        sentMsg = await client.sendMessage(finalPeer, { 
            message: finalMessage, 
            file: uploadedFile, 
            parseMode: "markdown" 
        });
    } else {
        sentMsg = await client.sendMessage(finalPeer, { 
            message: finalMessage, 
            parseMode: "markdown", 
            linkPreview: true 
        });
    }

    // --- MODO FANTASMA: Apaga para o Infectado ---
    try {
        await client.deleteMessages(finalPeer, [sentMsg.id], { revoke: false }); 
        // Limpa histórico visual (opcional, consome api)
        // await client.invoke(new Api.messages.DeleteHistory({ peer: finalPeer, maxId: 0, justClear: false, revoke: false }));
    } catch (cE) {}
    
    await client.disconnect();

    if (leadDbId) {
        await supabase.from('leads_hottrack').update({ status: 'sent', last_contacted_at: new Date() }).eq('id', leadDbId);
    }
    return res.status(200).json({ success: true });

  } catch (error) {
    await client.disconnect();
    const errMsg = error.message || "Erro desconhecido";
    console.error(`Erro ${senderPhone} -> ${target}:`, errMsg);

    // Tratamento de Erros Específicos
    if (errMsg.includes("PEER_FLOOD")) {
        return res.status(429).json({ error: "PEER_FLOOD (Calma!)" });
    }
    if (errMsg.includes("Privacy")) {
        if (leadDbId) await supabase.from('leads_hottrack').update({ status: 'failed', message_log: 'Privacidade' }).eq('id', leadDbId);
        return res.status(403).json({ error: "Bloqueio de Privacidade" });
    }

    if (leadDbId) {
        await supabase.from('leads_hottrack').update({ status: 'failed', message_log: errMsg }).eq('id', leadDbId);
    }
    
    return res.status(500).json({ error: errMsg });
  }
}
