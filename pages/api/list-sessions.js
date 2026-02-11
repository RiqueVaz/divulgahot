import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // Adicionei 'is_active' na seleção
  const { data, error } = await supabase
    .from('telegram_sessions')
    .select('phone_number, created_at, id, is_active')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  
  res.status(200).json({ sessions: data });
}
