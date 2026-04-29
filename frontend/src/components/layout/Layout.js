// src/components/layout/Layout.js
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LangContext';
import toast from 'react-hot-toast';
import '../../styles/global.css';

const NAV = [
  { path: '/',           icon: '⊞', key: 'dashboard',  section: 'main' },
  { path: '/daily-sales', icon: '🍽️', key: 'dailySales', section: 'main' },
  { path: '/customers',  icon: '👤', key: 'customers',  section: 'main' },
  { path: '/sales',      icon: '📄', key: 'sales',      section: 'main' },
  { path: '/purchase',   icon: '🛒', key: 'purchase',   section: 'main' },
  { path: '/inventory',  icon: '📦', key: 'inventory',  section: 'main' },
  { path: '/legal',      icon: '⚖️', key: 'legal',     section: 'main' },
  { path: '/expenses',   icon: '💸', key: 'expenses',   section: 'finance' },
  { path: '/petty-cash', icon: '💵', key: 'pettyCash',  section: 'finance' },
  { path: '/internal-transfers', icon: '🔁', key: 'internalTransfers', section: 'finance' },
  { path: '/receipts',   icon: '🧾', key: 'receipts',   section: 'finance' },
  { path: '/accounting', icon: '📊', key: 'accounting', section: 'finance' },
  { path: '/hrd',        icon: '🏢', key: 'staffManagement', section: 'hrd' },
  { path: '/attendance', icon: '🕐', key: 'attendance', section: 'hrd' },
  { path: '/payroll',    icon: '💳', key: 'payroll',    section: 'hrd' },
  { path: '/leaves',     icon: '🌴', key: 'leaves',     section: 'hrd' },
  { path: '/users',      icon: '👥', key: 'users',      section: 'admin' },
  { path: '/settings',   icon: '⚙️', key: 'settings',  section: 'admin' },
];

const SECTION_KEYS = { main: 'main', finance: 'finance', hrd: 'hrdSection', admin: 'admin' };

export default function Layout() {
  const { profile, signOut, isOwner } = useAuth();
  const { t, toggleLang, lang } = useLang();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  async function handleLogout() {
    try { await signOut(); navigate('/login'); }
    catch { toast.error('Logout failed'); }
  }

  const initials = profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

  // Filter nav: non-owners can't see users page
  const visibleNav = NAV.filter(item => item.key !== 'users' || isOwner);

  let lastSection = '';

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="topbar-logo">M</div>
          <div>
            <div className="topbar-title">{t('appTitle')}</div>
            <div className="topbar-subtitle">{t('appSubtitle')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="lang-btn" onClick={toggleLang}>
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
          <div style={{ position: 'relative' }}>
            <div className="user-badge" onClick={() => setShowUserMenu(s => !s)}>
              <div className="avatar">{initials}</div>
              <span style={{ fontSize: 12, color: '#fff' }}>{profile?.full_name || t('owner')}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>▾</span>
            </div>
            {showUserMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 8,
                background: '#fff', borderRadius: 10, border: '1px solid #dde3ed',
                minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{profile?.full_name}</div>
                  <div style={{ fontSize: 11, color: '#5a6a7e' }}>{profile?.role}</div>
                </div>
                <div
                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: '#c0392b' }}
                  onClick={handleLogout}
                >
                  {t('logout')}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <nav className="sidebar">
          <div style={{ padding: '12px 8px 8px' }}>
            {visibleNav.map(item => {
              const showSection = item.section !== lastSection;
              lastSection = item.section;
              return (
                <React.Fragment key={item.path}>
                  {showSection && (
                    <div className="sidebar-section">{t(SECTION_KEYS[item.section])}</div>
                  )}
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{t(item.key)}</span>
                  </NavLink>
                </React.Fragment>
              );
            })}
          </div>
        </nav>

        {/* Page content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
