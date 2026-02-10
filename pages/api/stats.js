import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  try {
    // 1. Conta TOTAL de leads na tabela nova
    const { count: total, error: err1 } = await supabase
      .from('leads_hottrack') // <--- NOME NOVO
      .select('*', { count: 'exact', head: true });

    if (err1) throw err1;

    // 2. Conta PENDENTES (status = 'pending')
    const { count: pending } = await supabase
      .from('leads_hottrack')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 3. Conta ENVIADOS (status = 'sent')
    const { count: sent } = await supabase
      .from('leads_hottrack')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    res.status(200).json({ total: total || 0, pending: pending || 0, sent: sent || 0 });

  } catch (error) {
    console.error("Erro ao carregar stats:", error.message);
    // Retorna zeros para não quebrar o painel se a tabela não existir
    res.status(200).json({ total: 0, pending: 0, sent: 0 });
  }
}
