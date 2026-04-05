import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import id from '../locales/id.json';
import ja from '../locales/ja.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      id: { translation: id },
      ja: { translation: ja },
    },
    fallbackLng: 'id',
    supportedLngs: ['id', 'ja'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'ijbnet-lang',
    },
  });

export default i18n;
