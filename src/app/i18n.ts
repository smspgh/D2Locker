import en from 'locale/en.json';
import enSrc from '../../config/i18n.json';
import { StoreObserver } from './store/observerMiddleware';
import { infoLog } from './utils/log';
import { setTag } from './utils/sentry';

export const D2L_LANG_INFOS = {
  en: { latinBased: true },
};

export type DimLanguage = keyof typeof D2L_LANG_INFOS;

export const D2L_LANGS = Object.keys(D2L_LANG_INFOS) as DimLanguage[];

// Simple storage for translations
let translations: Record<string, unknown> = {};

// Simple translation function
export function t(key: string, options?: { [key: string]: unknown }): string {
  const keys = key.split('.');
  let value: unknown = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && value !== null && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  if (typeof value === 'string') {
    // Simple interpolation for {{variable}} patterns
    if (options) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
        const replacement = options[varName];
        return replacement !== undefined &&
          (typeof replacement === 'string' || typeof replacement === 'number')
          ? String(replacement)
          : match;
      });
    }
    return value;
  }

  return key;
}

// Always use English
export function defaultLanguage(): DimLanguage {
  return 'en';
}

export function initi18n(): Promise<unknown> {
  return new Promise((resolve) => {
    // Load English translations
    translations = $D2L_FLAVOR === 'dev' ? enSrc : en;
    resolve(undefined);
  });
}

// Simplified observer for English-only
export function createLanguageObserver(): StoreObserver<DimLanguage> {
  return {
    id: 'i18n-observer',
    getObserved: () => 'en', // Always return 'en'
    runInitially: true,
    sideEffect: () => {
      // Remove stored language preference since we only support English
      localStorage.removeItem('d2lLanguage');
      setTag('lang', 'en');
      document.querySelector('html')!.setAttribute('lang', 'en');
    },
  };
}

// Hot-reload translations in dev
if (module.hot) {
  module.hot.accept('../../config/i18n.json', () => {
    translations = enSrc;
    infoLog('i18n', 'Reloaded translations');
  });
}
