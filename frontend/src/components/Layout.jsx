import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useApp } from '../context';
import { LayoutDashboard, ShoppingCart, Package, Receipt, Users, Wallet, Globe } from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/sales', icon: ShoppingCart, key: 'sales' },
  { to: '/purchases', icon: Package, key: 'purchases' },
  { to: '/expenses', icon: Receipt, key: 'expenses' },
  { to: '/hr', icon: Users, key: 'hr' },
  { to: '/cash', icon: Wallet, key: 'cashSheet' },
];

export default function Layout() {
  const { t, toggleLang, lang, user, logout } = useApp();
  return (
    <div className="app-layout" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>{t('appTitle')}</h1>
          <p>{user?.branch_name || t('allBranches')}</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({isActive}) => `sidebar-link${isActive ? ' active' : ''}`}>
              <n.icon size={18} />
              <span>{t(n.key)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            <button className="btn btn-outline" style={{color:'#fff',borderColor:'rgba(255,255,255,.3)',fontSize:12}} onClick={toggleLang}>
              <Globe size={14} /> {lang === 'en' ? 'العربية' : 'English'}
            </button>
            <button className="btn btn-outline" style={{color:'#fff',borderColor:'rgba(255,255,255,.3)',fontSize:12}} onClick={logout}>
              {t('logout')}
            </button>
          </div>
          <div style={{marginTop:6,opacity:.6,fontSize:11}}>{user?.full_name} ({user?.role})</div>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
