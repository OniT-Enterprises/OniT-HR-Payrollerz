import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { translations, type Locale } from "./translations";

type TranslationParams = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslationParams) => string;
  localeLabels: Record<Locale, string>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const LOCALE_STORAGE_KEY = "onit:locale";

const localeLabels: Record<Locale, string> = {
  en: (translations.en as unknown as Record<string, Record<string, string>>).locale?.en || 'English',
  tet: (translations.tet as unknown as Record<string, Record<string, string>>).locale?.tet || 'Tetun',
};

const resolvePath = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, obj);

const formatString = (value: string, params?: TranslationParams) => {
  if (!params) {
    return value;
  }
  return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return match;
  });
};

const getInitialLocale = (): Locale => {
  if (typeof window === "undefined") {
    return "en";
  }
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "en" || stored === "tet") {
    return stored;
  }
  const preferred = navigator.languages?.[0] || navigator.language || "en";
  if (preferred.toLowerCase().startsWith("tet")) {
    return "tet";
  }
  return "en";
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const current = resolvePath(translations[locale], key);
      const fallback = resolvePath(translations.en, key);
      const value = typeof current === "string" ? current : typeof fallback === "string" ? fallback : key;
      return formatString(value, params);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      localeLabels,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
};
