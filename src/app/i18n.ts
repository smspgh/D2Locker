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

  // Debug any keys that contain dots (potential translation keys)
  const isTranslationKey = key.includes('.') && key === key.split('.').join('.');
  if (isTranslationKey) {
    console.log(`Translating key: ${key}`);
    console.log('Translations object exists:', !!translations);
    console.log('Keys to traverse:', keys);
  }

  for (const k of keys) {
    if (value && typeof value === 'object' && value !== null && k in value) {
      value = (value as Record<string, unknown>)[k];
      if (isTranslationKey) {
        console.log(`After key "${k}":`, value);
      }
    } else {
      if (isTranslationKey) {
        console.log(`Key "${k}" not found in:`, value);
      }
      
      // If direct key not found, check for pluralization
      if (options && 'count' in options && typeof options.count === 'number') {
        const count = options.count;
        const pluralKey = count === 1 ? `${k}_one` : `${k}_other`;
        
        if (value && typeof value === 'object' && value !== null && pluralKey in value) {
          value = (value as Record<string, unknown>)[pluralKey];
          if (isTranslationKey) {
            console.log(`Found plural key "${pluralKey}":`, value);
          }
          break; // Found the plural key, exit the loop
        }
      }
      
      return key; // Return key if translation not found
    }
  }

  if (typeof value === 'string') {
    // Simple interpolation for {{variable}} patterns
    if (options) {
      return value.replace(/\{\{(\w+(?:,\s*\w+)*)\}\}/g, (match, varExpr: string) => {
        const varName = varExpr.split(',')[0].trim();
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
  return new Promise(async (resolve) => {
    // Load English translations
    if ($D2L_FLAVOR === 'dev') {
      translations = enSrc;
    } else {
      // In production, we need to fetch the JSON file since webpack bundles it as a separate file
      try {
        if (typeof en === 'string') {
          // en is a URL path, fetch the actual content
          const response = await fetch(en);
          translations = await response.json();
        } else {
          // en is the actual JSON object
          translations = en;
        }
      } catch (error) {
        console.error('Failed to load translations:', error);
        translations = {};
      }
    }
    
    // Debug logging to check what's loaded
    console.log('D2L_FLAVOR:', $D2L_FLAVOR);
    console.log('Translations loaded:', !!translations);
    console.log('Header section:', (translations as any)?.Header);
    
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
