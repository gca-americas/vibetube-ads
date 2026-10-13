import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// One JSON file per page: locales/<code>/<page>.json, each holding a single top-level key.
// To add a language: copy locales/en/ to locales/<code>/, translate it, then add it to LANGUAGES.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
] as const;

const files = import.meta.glob<Record<string, unknown>>('./locales/*/*.json', { eager: true, import: 'default' });

function resourcesFor(code: string) {
  const merged: Record<string, unknown> = {};
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith(`./locales/${code}/`)) Object.assign(merged, content);
  }
  return merged;
}

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const SUPPORTED = LANGUAGES.map(l => l.code) as string[];

// Map browser locales like "es-ES" or "pt" to the closest supported variant.
function toSupported(lng: string): string {
  if (SUPPORTED.includes(lng)) return lng;
  const base = lng.split('-')[0];
  return SUPPORTED.find(code => code.split('-')[0] === base) ?? 'en';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: Object.fromEntries(LANGUAGES.map(l => [l.code, { translation: resourcesFor(l.code) }])),
    supportedLngs: SUPPORTED,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'language',
      caches: ['localStorage'],
      convertDetectedLanguage: toSupported,
    },
  });

const syncHtmlLang = (lng: string) => document.documentElement.setAttribute('lang', lng);
syncHtmlLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
