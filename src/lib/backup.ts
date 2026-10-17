import type { Expense, Settings, Wish } from './types'
import { migrateSettings } from './defaults'

const APP_ID = 'was-kostet-mich'

export interface Backup {
  app: typeof APP_ID
  version: 1
  /** ISO-Zeitpunkt der Sicherung */
  createdAt: string
  settings: Settings
  wishes: Wish[]
  expenses: Expense[]
}

export function createBackup(settings: Settings, wishes: Wish[], expenses: Expense[], now = new Date()): Backup {
  return { app: APP_ID, version: 1, createdAt: now.toISOString(), settings, wishes, expenses }
}

export function backupFileName(now = new Date()): string {
  return `was-kostet-mich-sicherung-${now.toISOString().slice(0, 10)}.json`
}

/** Liest eine Sicherungsdatei. Gibt bei Fehlern einen Text für die Nutzerin oder den Nutzer zurück. */
export function parseBackup(text: string): Backup | string {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return 'Die Datei ist keine Sicherung dieser App.'
  }
  const b = data as Partial<Backup> | null
  if (!b || b.app !== APP_ID) return 'Die Datei ist keine Sicherung dieser App.'
  if (b.version !== 1) return 'Diese Sicherung stammt aus einer neueren Version der App. Bitte erst die App aktualisieren.'
  if (!b.settings || typeof b.settings !== 'object' || !Array.isArray(b.wishes) || !Array.isArray(b.expenses)) {
    return 'Die Sicherung ist unvollständig oder beschädigt.'
  }
  return { ...(b as Backup), settings: migrateSettings(b.settings) }
}
