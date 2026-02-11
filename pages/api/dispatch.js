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

  const client = new TelegramClient(new StringSession(data.session_string), apiId, apiHash, { connectionRetries: 2, useWSS: false });

  try {
    await client.connect();

    let finalPeer;
    
    // ESTRATÉGIA 1: Prioridade absoluta para Username (Evita o erro de Input Entity)
    if (username) {
        try {
            finalPeer = await client.getInputEntity(username.replace('@', ''));
        } catch (e) { console.log("Falha ao resolver username, tentando ID..."); }
    }

    // ESTRATÉGIA 2: Se não tem username ou falhou, tenta resolver o ID numérico
    if (!finalPeer && target) {
        try {
            // Tenta forçar o Telegram a reconhecer o ID
            finalPeer = await client.getInputEntity(BigInt(target));
        } catch (e) {
            // ESTRATÉGIA 3: Busca global (Último recurso)
            try {
                const result = await client.invoke(new Api.contacts.ResolveUsername({ username: target.toString() }));
                finalPeer = result.peer;
            } catch (innerE) {
                await client.disconnect();
                throw new Error("Usuário não encontrado no cache da conta remetente.");
            }
        }
    }

    // Simulação de presença
    const action = imageUrl ? new Api.SendMessageUploadPhotoAction() : new Api.SendMessageTypingAction();
    await client.invoke(new Api.messages.SetTyping({ peer: finalPeer, action }));
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 2000) + 500)); 

    let sentMsg;
    if (imageUrl) {
        const mediaRes = await fetch(imageUrl);
        const buffer = Buffer.from(await mediaRes.arrayBuffer());
        const toUpload = new CustomFile("img.jpg", buffer.byteLength, "image/jpeg", buffer);
        const uploadedFile = await client.uploadFile({ file: toUpload, workers: 1 });
        sentMsg = await client.sendMessage(finalPeer, { message: finalMessage, file: uploadedFile, parseMode: "markdown" });
    } else {
        sentMsg = await client.sendMessage(finalPeer, { message: finalMessage, parseMode: "markdown", linkPreview: true });
    }

    // MODO FANTASMA: Apaga rastro do envio
    try {
        await client.deleteMessages(finalPeer, [sentMsg.id], { revoke: false }); 
        await client.invoke(new Api.messages.DeleteHistory({ peer: finalPeer, maxId: 0, justClear: false, revoke: false }));
    } catch (cE) {}
    
    await client.disconnect();

    if (leadDbId) {
        await supabase.from('leads_hottrack').update({ status: 'sent', last_contacted_at: new Date() }).eq('id', leadDbId);
    }
    return res.status(200).json({ success: true });

  } catch (error) {
    await client.disconnect();
    if (leadDbId) await supabase.from('leads_hottrack').update({ status: 'failed' }).eq('id', leadDbId);
    return res.status(500).json({ error: error.message });
  }
}
