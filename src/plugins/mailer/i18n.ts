import i18next, { init } from 'i18next';

import arTranslations from './langs/ar.json' assert { type: 'json' };
import enTranslations from './langs/en.json' assert { type: 'json' };
import esTranslations from './langs/es.json' assert { type: 'json' };
import frTranslations from './langs/fr.json' assert { type: 'json' };
import itTranslations from './langs/it.json' assert { type: 'json' };

init({
  fallbackLng: 'en',
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
