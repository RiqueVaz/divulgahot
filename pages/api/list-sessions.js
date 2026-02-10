import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // Busca apenas o telefone e a data (não precisamos da session string no front por segurança)
  const { data, error } = await supabase
    .from('telegram_sessions')
    .select('phone_number, created_at, id')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  
  res.status(200).json({ sessions: data });
}
