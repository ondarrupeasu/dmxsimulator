/**
 * i18n setup. UI ships in English (house convention); Spanish and Basque are
 * wired so we can translate as the app grows. Language persists in localStorage.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import es from './locales/es.json'
import eu from './locales/eu.json'

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('dmxsim-lang') : null

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    eu: { translation: eu },
  },
  lng: stored ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setLanguage(lang: string): void {
  void i18n.changeLanguage(lang)
  localStorage.setItem('dmxsim-lang', lang)
}

export default i18n
