import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from './backup'
import { DEFAULT_SETTINGS } from './defaults'

describe('Sicherung', () => {
  const wishes = [{ id: 'a', name: 'Tv', price: 1200, createdAt: '2026-10-17', saved: 50 }]
  const expenses = [{ id: 'e', date: '2026-10-17', label: 'Lidl', amount: 76, source: 'manual' as const }]

  it('lässt sich speichern und unverändert wieder einlesen', () => {
    const backup = createBackup({ ...DEFAULT_SETTINGS, payAmount: 2500 }, wishes, expenses)
    const restored = parseBackup(JSON.stringify(backup))
    expect(restored).toEqual(backup)
  })

  it('lehnt fremde oder kaputte Dateien mit einer Erklärung ab', () => {
    expect(parseBackup('kein json')).toMatch(/keine Sicherung/)
    expect(parseBackup(JSON.stringify({ app: 'andere-app' }))).toMatch(/keine Sicherung/)
    expect(parseBackup(JSON.stringify({ app: 'was-kostet-mich', version: 1, settings: {} }))).toMatch(/unvollständig/)
    expect(parseBackup(JSON.stringify({ app: 'was-kostet-mich', version: 2 }))).toMatch(/neueren Version/)
  })

  it('bringt ältere gespeicherte Einstellungen auf den aktuellen Stand', () => {
    const old: Partial<typeof DEFAULT_SETTINGS> = { ...DEFAULT_SETTINGS }
    delete old.deposits
    const restored = parseBackup(JSON.stringify({ ...createBackup(DEFAULT_SETTINGS, [], []), settings: old }))
    expect(typeof restored).toBe('object')
    expect((restored as Exclude<typeof restored, string>).settings.deposits).toEqual([])
  })
})
