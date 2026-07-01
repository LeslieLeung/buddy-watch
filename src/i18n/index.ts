import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enUS from './locales/en-US.json'
import zhCN from './locales/zh-CN.json'

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export function normalizeLanguage(language: string): SupportedLanguage {
  return language?.startsWith('zh') ? 'zh-CN' : 'en-US'
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
      'zh-CN': { translation: zhCN },
    },
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    fallbackLng: 'en-US',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      convertDetectedLanguage: normalizeLanguage,
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
