import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type TranslationParams = Record<string, string | number>;
export type Locale = "en" | "tet" | "pt";
type TranslationTree = Record<string, unknown>;
type TranslationBundle = Record<Locale, TranslationTree>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslationParams) => string;
  localeLabels: Record<Locale, string>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const LOCALE_STORAGE_KEY = "onit:locale";

const localeLabels: Record<Locale, string> = {
  en: "English",
  tet: "Tetun",
  pt: "Português",
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
  if (stored === "en" || stored === "tet" || stored === "pt") {
    return stored;
  }
  const preferred = navigator.languages?.[0] || navigator.language || "en";
  if (preferred.toLowerCase().startsWith("tet")) {
    return "tet";
  }
  if (preferred.toLowerCase().startsWith("pt")) {
    return "pt";
  }
  return "en";
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [translationBundle, setTranslationBundle] = useState<TranslationBundle | null>(null);

  useEffect(() => {
    let active = true;

    void import("./translations")
      .then((module) => {
        if (!active) return;
        setTranslationBundle(module.translations as TranslationBundle);
      })
      .catch(() => {
        if (!active) return;
        setTranslationBundle({
          en: {},
          tet: {},
          pt: {},
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      if (!translationBundle) {
        return key;
      }
      const current = resolvePath(translationBundle[locale], key);
      const fallback = resolvePath(translationBundle.en, key);
      const value = typeof current === "string" ? current : typeof fallback === "string" ? fallback : key;
      return formatString(value, params);
    },
    [locale, translationBundle]
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

  if (!translationBundle) {
    return null;
  }

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
