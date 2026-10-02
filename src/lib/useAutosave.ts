// I testi liberi (appunti, note, dettagli) si salvano mentre si scrive, non solo uscendo dal
// campo: da telefono si chiude l'app o il dialogo senza mai togliere il cursore, e con il
// solo onBlur l'appunto andava perso.

import { type ChangeEvent, useCallback, useEffect, useLayoutEffect, useRef } from 'react'

/** Attesa dopo l'ultimo tasto: una parola, non ogni lettera, diventa una modifica. */
const DELAY_MS = 600

/**
 * Gestori per un campo di testo non controllato (con defaultValue). Il testo si salva poco dopo
 * l'ultimo tasto e, se ne resta da salvare, uscendo dal campo, quando l'app va in background e
 * quando il campo sparisce (dialogo chiuso con Esc o con il tasto Indietro).
 */
export function useAutosave(save: (value: string) => void) {
  const latest = useRef(save)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Si salva sempre con la funzione dell'ultimo render, che conosce i dati aggiornati.
  useLayoutEffect(() => {
    latest.current = save
  })

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (pending.current === null) return
    const value = pending.current
    pending.current = null
    latest.current(value)
  }, [])

  useEffect(() => {
    const onHidden = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      pending.current = e.target.value
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, DELAY_MS)
    },
    [flush],
  )

  return { onChange, onBlur: flush }
}
