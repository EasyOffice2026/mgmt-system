import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from './i18n/translations';
import { getUser, logoutUser } from './api';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [user, setUser] = useState(() => getUser());

  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }, [lang, dir]);

  function toggleLang() { setLang(l => l === 'en' ? 'ar' : 'en'); }
  function logout() { logoutUser(); setUser(null); }

  return (
    <AppContext.Provider value={{ lang, dir, t, toggleLang, user, setUser, logout }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
