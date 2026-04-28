import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context';
import { login } from '../api';

export default function LoginPage() {
  const { t, toggleLang, lang, setUser } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const u = usernameRef.current.value.trim();
    const p = passwordRef.current.value;
    if (!u || !p) {
      setError(t('invalidCredentials'));
      return;
    }
    setLoading(true);
    try {
      const user = await login(u, p);
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
          <button type="button" className="btn btn-outline" onClick={toggleLang} style={{fontSize:12}}>
            {lang === 'en' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'English'}
          </button>
        </div>
        <div className="login-logo">M</div>
        <div className="login-title">{t('appTitle')}</div>
        <div className="login-subtitle">{t('appSubtitle')}</div>
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group">
            <label>{t('username')}</label>
            <input ref={usernameRef} name="username" placeholder="owner" required autoComplete="username" />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input ref={passwordRef} name="password" type="password" placeholder="********" required autoComplete="current-password" />
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
