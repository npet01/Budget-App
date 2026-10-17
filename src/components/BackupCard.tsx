import { useState } from 'react'
import type { Expense, Settings, Wish } from '../lib/types'
import { backupFileName, createBackup, parseBackup, type Backup } from '../lib/backup'
import { useStoredState } from '../lib/storage'
import { formatDate } from '../lib/format'

interface Props {
  /** Fehlt beim ersten Start: dann gibt es nur das Einlesen */
  data?: { settings: Settings; wishes: Wish[]; expenses: Expense[] }
  onRestore: (backup: Backup) => void
}

/** Speichert alles als Datei bzw. liest eine Sicherung wieder ein. */
export function BackupCard({ data, onRestore }: Props) {
  const [lastBackup, setLastBackup] = useStoredState<string | null>('lastBackup', null)
  const [pending, setPending] = useState<Backup | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!data) return
    const now = new Date()
    const json = JSON.stringify(createBackup(data.settings, data.wishes, data.expenses, now), null, 2)
    const file = new File([json], backupFileName(now), { type: 'application/json' })
    try {
      // Auf dem Handy öffnet das Teilen-Menü: in Dateien sichern, per Mail schicken …
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Sicherung' })
      } else {
        const url = URL.createObjectURL(file)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        URL.revokeObjectURL(url)
      }
      setLastBackup(now.toISOString())
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('Die Sicherung konnte nicht gespeichert werden.')
    }
  }

  const read = async (file: File | undefined) => {
    if (!file) return
    const result = parseBackup(await file.text())
    if (typeof result === 'string') {
      setError(result)
      setPending(null)
    } else {
      setError(null)
      setPending(result)
    }
  }

  return (
    <section className="card">
      <h2>{data ? 'Sicherung' : 'Neues Handy?'}</h2>
      <p className="muted">
        {data
          ? 'Deine Daten liegen nur auf diesem Gerät. Speicher ab und zu eine Sicherung, zum Beispiel in iCloud, Google Drive oder per Mail an dich selbst.'
          : 'Wenn du eine Sicherung aus der App hast, kannst du sie hier einlesen und musst nichts neu eintragen.'}
      </p>
      {data && <small className="muted">{lastBackup ? `Letzte Sicherung: ${formatDate(new Date(lastBackup))}` : 'Noch keine Sicherung gespeichert.'}</small>}

      {pending ? (
        <div className="confirm">
          <p>
            Sicherung vom {formatDate(new Date(pending.createdAt))} mit {pending.wishes.length}{' '}
            {pending.wishes.length === 1 ? 'Wunsch' : 'Wünschen'} und {pending.expenses.length}{' '}
            {pending.expenses.length === 1 ? 'Ausgabe' : 'Ausgaben'} einlesen?
            {data && ' Alles, was gerade auf diesem Gerät ist, wird dabei ersetzt.'}
          </p>
          <div className="actions">
            <button className="secondary" onClick={() => setPending(null)}>
              Abbrechen
            </button>
            <button
              onClick={() => {
                onRestore(pending)
                setPending(null)
              }}
            >
              Einlesen
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <label className="button secondary">
            Sicherung einlesen
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void read(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {data && <button onClick={() => void save()}>Sicherung speichern</button>}
        </div>
      )}
      {error && <p className="negative">{error}</p>}
    </section>
  )
}
