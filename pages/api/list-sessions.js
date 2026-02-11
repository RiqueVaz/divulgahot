import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  const { ownerId } = req.query; // Recebe o dono via URL

  let query = supabase
    .from('telegram_sessions')
    .select('phone_number, created_at, id, is_active')
    .order('created_at', { ascending: false });

  // FILTRO OBRIGATÓRIO: Se tiver ownerId, filtra. Se não, traz tudo (ou nada, dependendo da sua regra)
  if (ownerId) {
      query = query.eq('owner_id', ownerId);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ sessions: data });
}
