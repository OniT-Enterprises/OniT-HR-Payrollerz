import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type TranslationParams = Record<string, string | number>;
type Locale = "en" | "tet" | "pt";
type TranslationTree = Record<string, unknown>;
type TranslationBundle = Partial<Record<Locale, TranslationTree>>;

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

const translationLoaders: Record<Locale, () => Promise<TranslationTree>> = {
  en: () => import("./locales/en").then((module) => module.default as TranslationTree),
  tet: () => import("./locales/tet").then((module) => module.default as TranslationTree),
  pt: () => import("./locales/pt").then((module) => module.default as TranslationTree),
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
  const [translationBundle, setTranslationBundle] = useState<TranslationBundle>({});

  useEffect(() => {
    let active = true;

    const requiredLocales: Locale[] = locale === "en" ? ["en"] : ["en", locale];
    const missingLocales = requiredLocales.filter((item) => !translationBundle[item]);

    if (missingLocales.length === 0) {
      return () => {
        active = false;
      };
    }

    void Promise.all(
      missingLocales.map(async (item) => [item, await translationLoaders[item]()] as const)
    )
      .then((entries) => {
        if (!active) return;
        setTranslationBundle((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      });

    return () => {
      active = false;
    };
  }, [locale, translationBundle]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const fallbackTree = translationBundle.en;
      const currentTree = translationBundle[locale] ?? fallbackTree;
      if (!fallbackTree) {
        return key;
      }
      const current = resolvePath(currentTree, key);
      const fallback = resolvePath(fallbackTree, key);
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

  if (!translationBundle.en) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        Loading Meza...
      </div>
    );
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
