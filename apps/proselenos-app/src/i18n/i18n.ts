import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  lng: 'en',
  supportedLngs: ['en'],
  fallbackLng: 'en',
  ns: ['translation'],
  defaultNS: 'translation',
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  resources: {
    en: {
      translation: {},
    },
  },
});

export default i18n;
