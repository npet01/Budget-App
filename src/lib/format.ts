import type { WorkTime } from './calc'

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

export const formatEuro = (n: number) => euro.format(n)
export const formatDate = (d: Date) => dateFmt.format(d)

export function formatHours(hours: number): string {
  if (!isFinite(hours)) return '–'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} Min.`
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 60) return `${h + 1} Std.`
  return m > 0 ? `${h} Std. ${m} Min.` : `${h} Std.`
}

export function formatWorkTime(t: WorkTime): string {
  if (!isFinite(t.hours)) return 'Erst Gehalt eintragen'
  if (t.workDays >= 1) {
    const days = t.workDays.toLocaleString('de-DE', { maximumFractionDigits: 1 })
    return `${formatHours(t.hours)} · ${days} Arbeitstage`
  }
  return formatHours(t.hours)
}

/** Akzeptiert "12,99", "12.99", "1.299,00" und "€ 12" */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, '')
  if (!cleaned) return null
  let normalized = cleaned
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(normalized)
  return isFinite(n) ? n : null
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

export const todayIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
