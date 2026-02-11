import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    const { limit, ownerId } = req.query; // Recebe limit e ownerId

    let query = supabase
        .from('leads_hottrack')
        .select('*')
        .eq('status', 'pending')
        .order('username', { ascending: false, nullsFirst: false })
        .limit(limit || 100);
    
    // FILTRO DE ISOLAMENTO
    if (ownerId) {
        query = query.eq('owner_id', ownerId);
    }
    
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ leads: data || [] });
}
