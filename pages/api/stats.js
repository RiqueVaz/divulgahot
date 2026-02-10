import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // Conta total
  const { count: total } = await supabase
    .from('harvested_leads')
    .select('*', { count: 'exact', head: true });

  // Conta pendentes
  const { count: pending } = await supabase
    .from('harvested_leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Conta enviados
  const { count: sent } = await supabase
    .from('harvested_leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent');

  res.status(200).json({ total, pending, sent });
}
