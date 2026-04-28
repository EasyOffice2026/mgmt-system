import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context';
import { login } from '../api';

export default function LoginPage() {
  const { t, toggleLang, lang, setUser } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      setUser(user);
      toast.success(lang === 'ar' ? '\u0645\u0631\u062d\u0628\u0627 \u0628\u0643' : 'Welcome!');
      navigate('/');
    } catch {
      setError(t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
          <button className="btn btn-outline" onClick={toggleLang} style={{fontSize:12}}>
            {lang === 'en' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'English'}
          </button>
        </div>
        <div className="login-logo">M</div>
        <div className="login-title">{t('appTitle')}</div>
        <div className="login-subtitle">{t('appSubtitle')}</div>
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group">
            <label>{t('username')}</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="owner" required autoComplete="username" />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********" required autoComplete="current-password" />
          </div>
          {error && <div style={{fontSize:13,color:'var(--danger)',padding:'8px 12px',background:'#fce8e7',borderRadius:6}}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{width:'100%',justifyContent:'center',padding:'10px'}}>
            {loading ? '...' : t('loginBtn')}
          </button>
        </form>
        <div style={{marginTop:20,padding:12,background:'#f8fafc',borderRadius:8,fontSize:12,color:'var(--text-muted)'}}>
          <strong style={{color:'var(--primary)'}}>Demo:</strong> owner / owner123
        </div>
      </div>
    </div>
  );
}
