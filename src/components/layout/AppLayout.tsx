import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, ShoppingCart, Package, Warehouse,
  Scale, Receipt, FileText, Calculator, Settings, LogOut,
  Menu, X, Globe, ChevronRight, FileSearch
} from 'lucide-react';

const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/' },
  { key: 'contractLookup', icon: FileSearch, path: '/contract-lookup' },
  { key: 'customers', icon: Users, path: '/customers' },
  { key: 'sales', icon: ShoppingCart, path: '/sales' },
  { key: 'purchase', icon: Package, path: '/purchase' },
  { key: 'inventory', icon: Warehouse, path: '/inventory' },
  { key: 'legalCases', icon: Scale, path: '/legal-cases' },
  { key: 'expenses', icon: Receipt, path: '/expenses' },
  { key: 'receipts', icon: FileText, path: '/receipts' },
  { key: 'accounting', icon: Calculator, path: '/accounting' },
  { key: 'users', icon: Settings, path: '/users' },
] as const;

export function AppLayout() {
  const { profile, signOut, hasAccess } = useAuth();
  const { t, toggleLang, lang, dir } = useLang();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  const sidebarContent = (
    <div className="flex flex-col h-full" dir={dir}>
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
          AB
        </div>
        {sidebarOpen && (
          <span className="text-white font-semibold text-sm tracking-tight">{t('appName')}</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.filter(item => hasAccess(item.key)).map(item => (
          <NavLink
            key={item.key}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {sidebarOpen && <span>{t(item.key)}</span>}
            {sidebarOpen && (
              <ChevronRight className="h-3.5 w-3.5 ms-auto opacity-0 group-hover:opacity-50 transition-opacity" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 p-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLang}
          className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-700/50"
        >
          <Globe className="h-4 w-4 me-2" />
          {sidebarOpen && (lang === 'en' ? 'العربية' : 'English')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-slate-300 hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4 me-2" />
          {sidebarOpen && t('logout')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex" dir={dir}>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 border-e border-slate-800 transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-slate-900">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.innerWidth < 1024) setMobileOpen(!mobileOpen);
                else setSidebarOpen(!sidebarOpen);
              }}
              className="text-slate-500"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-end">
              <p className="text-sm font-medium text-slate-900">
                {lang === 'ar' ? profile?.full_name_ar : profile?.full_name}
              </p>
              <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
