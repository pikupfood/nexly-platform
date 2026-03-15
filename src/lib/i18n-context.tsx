'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Lang, LANG_LABELS, translations, loadLang, saveLang } from '@/lib/i18n'

interface I18nContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  LANGS: typeof LANG_LABELS
}

const I18nContext = createContext<I18nContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (k) => k,
  LANGS: LANG_LABELS,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    setLangState(loadLang())
    // Ascolta cambi di lingua da LangSwitcher
    const handler = (e: Event) => {
      const l = (e as CustomEvent<Lang>).detail
      setLangState(l)
    }
    window.addEventListener('nexly:lang', handler)
    return () => window.removeEventListener('nexly:lang', handler)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    saveLang(l)
    window.dispatchEvent(new CustomEvent('nexly:lang', { detail: l }))
  }

  const t = (key: string) => translations[lang]?.[key] || translations['fr']?.[key] || key

  return (
    <I18nContext.Provider value={{ lang, setLang, t, LANGS: LANG_LABELS }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
