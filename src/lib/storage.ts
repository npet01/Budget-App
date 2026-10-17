import { useEffect, useState } from 'react'

/** Speichert einen Wert nur auf diesem Gerät (localStorage). */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Speicher voll oder privat-Modus: App funktioniert weiter, nur ohne Speichern
    }
  }, [key, value])

  return [value, setValue] as const
}
