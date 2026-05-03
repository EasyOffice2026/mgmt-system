// src/contexts/LangContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LangContext = createContext({});

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;
  const toggleLang = () => setLang(l => l === 'en' ? 'ar' : 'en');
  const isRTL = lang === 'ar';

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t, isRTL }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
