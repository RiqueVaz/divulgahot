import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
export default async function handler(req, res) {
    // Pega 20 leads pendentes (lote pequeno para ser rápido)
    const { data } = await supabase.from('harvested_leads').select('*').eq('status', 'pending').limit(20);
    res.json({ leads: data || [] });
}
