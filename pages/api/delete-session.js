import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { phone } = req.body;

  if (!phone) return res.status(400).json({ error: 'Número obrigatório' });

  try {
    // Deleta a sessão do banco
    const { error } = await supabase
      .from('telegram_sessions')
      .delete()
      .eq('phone_number', phone);

    if (error) throw error;

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
