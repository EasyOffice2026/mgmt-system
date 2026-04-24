// src/components/auth/LoginPage.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { signIn } = useAuth();
  const { t, toggleLang, lang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success(lang === 'ar' ? 'مرحباً بك' : 'Welcome back!');
    } catch (err) {
      setError(lang === 'ar' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button className="lang-btn" style={{ background: '#f4f6fa', color: '#1a3a5c', border: '1px solid #dde3ed' }} onClick={toggleLang}>
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
        <div className="login-logo">T</div>
        <div className="login-title">{t('appTitle')}</div>
        <div className="login-subtitle">{t('appSubtitle')}</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="field-label">{t('email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@company.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="field-label">{t('password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <div style={{ fontSize: 13, color: '#c0392b', padding: '8px 12px', background: '#fce8e7', borderRadius: 6 }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '11px' }}>
            {loading ? (lang === 'ar' ? 'جاري الدخول...' : 'Signing in...') : t('loginBtn')}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: 14, background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#5a6a7e' }}>
          <strong style={{ color: '#1a3a5c' }}>{lang === 'ar' ? 'للتجربة:' : 'Demo credentials:'}</strong><br />
          {lang === 'ar' ? 'البريد: ' : 'Email: '}<code style={{ color: '#2563a8' }}>owner@company.com</code><br />
          {lang === 'ar' ? 'كلمة المرور: ' : 'Password: '}<code style={{ color: '#2563a8' }}>Admin@12345</code>
        </div>
      </div>
    </div>
  );
}
