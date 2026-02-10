import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [tab, setTab] = useState('dashboard'); 
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0 });
  const [logs, setLogs] = useState([]);
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [processing, setProcessing] = useState(false);

  // Estados de Disparo
  const [msg, setMsg] = useState('{Olá|Oi}, tudo bem?');
  
  // Estados de Espionagem/Clonagem
  const [spyPhone, setSpyPhone] = useState('');
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // --- CARREGAMENTO INICIAL ---
  const fetchData = async () => {
    try {
      // Carrega Sessões
      const sRes = await fetch('/api/list-sessions');
      const sData = await sRes.json();
      setSessions(sData.sessions || []);

      // Carrega Estatísticas (crie o arquivo api/stats.js se der erro aqui)
      const stRes = await fetch('/api/stats');
      if (stRes.ok) {
          const stData = await stRes.json();
          setStats(stData);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, []);

  const addLog = (text) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);

  const toggleSelect = (phone) => {
    const newSet = new Set(selectedPhones);
    if (newSet.has(phone)) newSet.delete(phone); else newSet.add(phone);
    setSelectedPhones(newSet);
  };

  // --- FUNÇÃO 1: CAMPANHA AUTOMÁTICA (DISPARO NO BANCO) ---
  const startRealCampaign = async () => {
     if (selectedPhones.size === 0) return alert('Selecione contas na lista à direita!');
     
     setProcessing(true);
     addLog('Buscando leads pendentes no banco...');
     
     try {
         // Busca leads da API (certifique-se de ter criado api/get-campaign-leads.js)
         const resLeads = await fetch('/api/get-campaign-leads'); 
         const dataLeads = await resLeads.json();
         const leads = dataLeads.leads || [];

         if (leads.length === 0) {
             setProcessing(false);
             return alert('Sem leads pendentes! Vá na aba Espionagem e roube leads de grupos.');
         }

         const phones = Array.from(selectedPhones);
         
         addLog(`Iniciando campanha para ${leads.length} leads...`);

         for (let i = 0; i < leads.length; i++) {
             const lead = leads[i];
             const sender = phones[i % phones.length]; // Distribui a carga entre as contas

             addLog(`[${i+1}/${leads.length}] ${sender} enviando para ${lead.username || lead.user_id}...`);
             
             await fetch('/api/dispatch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    senderPhone: sender,
                    target: lead.user_id, // Tenta mandar pelo ID
                    message: msg,
                    leadDbId: lead.id
                })
             });
             
             // Delay para evitar flood (1.5s)
             await new Promise(r => setTimeout(r, 1500)); 
         }
         addLog('✅ Campanha finalizada.');
         fetchData(); // Atualiza os números do dashboard
     } catch (err) {
         addLog(`❌ Erro na campanha: ${err.message}`);
     }
     setProcessing(false);
  };


  // --- FUNÇÕES DE ESPIONAGEM ---
  const loadChats = async (phone) => {
    setSpyPhone(phone);
    setLoadingChats(true);
    setChats([]);
    addLog(`🔍 Listando grupos de ${phone}...`);
    
    try {
        const res = await fetch('/api/spy/list-chats', { 
            method: 'POST', 
            body: JSON.stringify({ phone }), 
            headers: {'Content-Type': 'application/json'} 
        });
        const data = await res.json();
        setChats(data.chats || []);
    } catch (e) {
        addLog(`Erro ao listar chats: ${e.message}`);
    }
    setLoadingChats(false);
  };

  const handleCloneGroup = async (chatId, title) => {
    if(!confirm(`Criar um NOVO grupo clonando "${title}"?`)) return;
    addLog(`🐑 Clonando grupo... (Isso pode levar alguns segundos)`);
    
    try {
        const res = await fetch('/api/spy/clone-group', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone: spyPhone, originalChatId: chatId, originalTitle: title })
        });
        const data = await res.json();
        
        if (res.ok) addLog(`✅ Grupo criado com sucesso: "${data.newTitle}"`);
        else addLog(`❌ Erro ao clonar: ${data.error}`);
    } catch (e) {
        addLog(`❌ Erro de conexão.`);
    }
  };

  const handleHarvest = async (chatId, title) => {
      if(!confirm(`Extrair leads do grupo "${title}"?`)) return;
      addLog(`🕷️ Roubando leads de ${title}...`);
      
      try {
          const res = await fetch('/api/spy/harvest', { 
            method: 'POST', 
            body: JSON.stringify({ phone: spyPhone, chatId, chatName: title }), 
            headers: {'Content-Type': 'application/json'} 
          });
          
          if(res.ok) {
              const data = await res.json();
              addLog(`✅ ${data.count || 'Vários'} leads salvos no banco!`);
              fetchData(); // Atualiza contador
          } else {
              const err = await res.json();
              addLog(`❌ Falha: ${err.error}`);
          }
      } catch (e) {
          addLog(`❌ Erro crítico ao roubar.`);
      }
  };

  return (
    <div style={{ backgroundColor: '#0d1117', color: '#c9d1d9', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      
      {/* Top Bar Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <div style={{ background: '#161b22', padding: '15px', borderRadius: '6px', border: '1px solid #30363d', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', color: '#fff' }}>{stats.total}</div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Total Leads</div>
          </div>
          <div style={{ background: '#161b22', padding: '15px', borderRadius: '6px', border: '1px solid #d29922', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', color: '#d29922' }}>{stats.pending}</div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Disponíveis (Pendentes)</div>
          </div>
          <div style={{ background: '#161b22', padding: '15px', borderRadius: '6px', border: '1px solid #238636', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', color: '#238636' }}>{stats.sent}</div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Já Receberam</div>
          </div>
      </div>

      <div style={{ marginBottom: '20px', borderBottom: '1px solid #30363d' }}>
        <button onClick={() => setTab('dashboard')} style={{ padding: '10px 20px', background: tab === 'dashboard' ? '#238636' : 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>🚀 CRM & Disparo</button>
        <button onClick={() => setTab('spy')} style={{ padding: '10px 20px', background: tab === 'spy' ? '#8957e5' : 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>🕵️ Espionagem & Clonagem</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* Coluna Esquerda: Ações Principais */}
        <div>
            {tab === 'dashboard' && (
                <div style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '6px' }}>
                    <h3>Disparo Automático (CRM)</h3>
                    <p style={{ fontSize: '12px', color: '#8b949e' }}>
                        Isso vai pegar os <strong>{stats.pending} leads pendentes</strong> do banco de dados e distribuir o envio entre as contas selecionadas na direita.
                    </p>
                    
                    <label style={{display:'block', marginBottom:'5px', marginTop:'15px'}}>Mensagem (Suporta Spintax e Markdown)</label>
                    <textarea 
                        value={msg} 
                        onChange={e => setMsg(e.target.value)} 
                        style={{ width: '100%', height: '80px', marginBottom: '15px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '10px' }} 
                    />
                    
                    <button 
                        onClick={startRealCampaign} 
                        disabled={processing} 
                        style={{ width: '100%', padding: '15px', background: processing ? '#23863655' : '#238636', color: 'white', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}>
                        {processing ? 'ENVIANDO CAMPANHA...' : '▶️ INICIAR CAMPANHA AUTOMÁTICA'}
                    </button>
                </div>
            )}

            {tab === 'spy' && (
                <div style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '6px' }}>
                     {!spyPhone ? (
                        <p style={{color: '#8b949e', textAlign: 'center', padding: '20px'}}>
                            &lt;&lt; Selecione uma conta na lista à direita para começar a espiar
                        </p>
                     ) : (
                        <div>
                            <h4 style={{borderBottom: '1px solid #30363d', paddingBottom: '10px'}}>Grupos de {spyPhone}</h4>
                            
                            {loadingChats && <p>Carregando lista...</p>}

                            <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                                {chats.map(c => (
                                    <div key={c.id} style={{ borderBottom: '1px solid #30363d', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{fontWeight: 'bold', color: '#e6edf3'}}>{c.title}</div>
                                            <div style={{fontSize: '11px', color: '#8b949e'}}>
                                                {c.type} • {c.participants_count || '?'} membros
                                            </div>
                                        </div>
                                        <div>
                                            {/* Proteção: Só mostra botão de roubar se for Grupo (não Canal) */}
                                            {c.type === 'Grupo' ? (
                                                <button onClick={() => handleHarvest(c.id, c.title)} style={{ marginRight: '8px', background: '#d29922', border: 'none', padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', color: 'black', fontWeight: 'bold' }}>🕷️ Roubar</button>
                                            ) : (
                                                <span style={{ marginRight: '8px', fontSize: '10px', color: '#666', border: '1px solid #333', padding: '4px 8px', borderRadius: '4px' }}>🚫 Canal</span>
                                            )}
                                            
                                            <button onClick={() => handleCloneGroup(c.id, c.title)} style={{ background: '#1f6feb', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'white', borderRadius: '4px', fontWeight: 'bold' }}>🐑 Clonar</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                     )}
                </div>
            )}
            
            {/* Terminal de Logs */}
            <div style={{ marginTop: '20px', background: '#000', padding: '15px', height: '250px', overflowY: 'auto', fontSize: '12px', fontFamily: 'monospace', borderRadius: '6px', border: '1px solid #30363d' }}>
                <div style={{color: '#58a6ff', marginBottom: '5px'}}>root@hottrack:~# logs</div>
                {logs.map((l, i) => <div key={i} style={{marginBottom: '3px', color: l.includes('❌') ? '#ff7b72' : l.includes('✅') ? '#3fb950' : '#c9d1d9'}}>{l}</div>)}
            </div>
        </div>

        {/* Coluna Direita: Lista de Contas */}
        <div style={{ backgroundColor: '#161b22', padding: '20px', borderRadius: '6px' }}>
            <h3>Exército ({sessions.length})</h3>
            <p style={{fontSize: '11px', color: '#8b949e', marginBottom: '15px'}}>Contas disponíveis para ataque ou espionagem.</p>
            
            {sessions.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#21262d', marginBottom: '8px', borderRadius: '4px', border: selectedPhones.has(s.phone_number) ? '1px solid #238636' : '1px solid transparent' }}>
                    <span style={{fontWeight: 'bold', fontSize: '13px'}}>{s.phone_number}</span>
                    
                    {tab === 'dashboard' ? (
                        <button onClick={() => toggleSelect(s.phone_number)} style={{ background: selectedPhones.has(s.phone_number) ? '#238636' : '#30363d', color: 'white', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px' }}>
                           {selectedPhones.has(s.phone_number) ? '✓ Selecionado' : 'Selecionar'}
                        </button>
                    ) : (
                        <button onClick={() => loadChats(s.phone_number)} style={{ background: spyPhone === s.phone_number ? '#8957e5' : '#30363d', color: 'white', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '4px' }}>
                           {spyPhone === s.phone_number ? '👁 Espiando' : 'Espiar'}
                        </button>
                    )}
                </div>
            ))}
            
            {sessions.length === 0 && <p style={{color: '#ff7b72', fontSize: '12px'}}>Nenhuma conta conectada. Use o link inicial para capturar sessões.</p>}
        </div>

      </div>
    </div>
  );
}
