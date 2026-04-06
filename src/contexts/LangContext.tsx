import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { en } from '@/i18n/en';
import { ar } from '@/i18n/ar';

type Lang = 'en' | 'ar';
type Translations = Record<string, string>;

interface LangContextType {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  t: (key: string) => string;
  toggleLang: () => void;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextType>({} as LangContextType);

const translations: Record<Lang, Translations> = { en: en as Translations, ar: ar as Translations };

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('lang') as Lang) || 'en';
  });

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const t = useCallback((key: string): string => {
    return translations[lang][key] || key;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('lang', l);
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'ar' : 'en');
  }, [lang, setLang]);

  return (
    <LangContext.Provider value={{ lang, dir, t, toggleLang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
