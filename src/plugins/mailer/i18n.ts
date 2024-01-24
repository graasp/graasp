import i18next from 'i18next';

import arTranslations from './langs/ar.json';
import enTranslations from './langs/en.json';
import esTranslations from './langs/es.json';
import frTranslations from './langs/fr.json';
import itTranslations from './langs/it.json';

i18next.init({
  resources: {
    en: {
      translation: enTranslations,
    },
    fr: {
      translation: frTranslations,
    },
    es: {
      translation: esTranslations,
    },
    it: {
      translation: itTranslations,
    },
    ar: {
      translation: arTranslations,
    },
  },
});

export default i18next;
