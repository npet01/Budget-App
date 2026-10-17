import type { Expense, Settings, Wish } from './types'

const WEEKS_PER_MONTH = 52 / 12
const DAYS_PER_MONTH = 365.25 / 12

/** Stunden, die man im Monat tatsächlich für die Arbeit aufwendet, inklusive Fahrtzeit. */
export function monthlyWorkHours(s: Settings): number {
  const paid = s.hoursPerWeek * WEEKS_PER_MONTH
  const commute = (s.commuteMinutesPerDay / 60) * s.workDaysPerWeek * WEEKS_PER_MONTH
  return paid + commute
}

/** Echter Stundenlohn: netto, geteilt durch alle Stunden, die die Arbeit kostet. */
export function realHourlyWage(s: Settings): number {
  const hours = monthlyWorkHours(s)
  return hours > 0 ? s.netIncome / hours : 0
}

export function hoursPerWorkDay(s: Settings): number {
  return s.workDaysPerWeek > 0 ? monthlyWorkHours(s) / (s.workDaysPerWeek * WEEKS_PER_MONTH) : 0
}

export interface WorkTime {
  hours: number
  workDays: number
}

export function priceToWorkTime(price: number, s: Settings): WorkTime {
  const wage = realHourlyWage(s)
  const hours = wage > 0 ? price / wage : Infinity
  const perDay = hoursPerWorkDay(s)
  return { hours, workDays: perDay > 0 ? hours / perDay : Infinity }
}

export function fixedCostTotal(s: Settings): number {
  return s.fixedCosts.reduce((sum, c) => sum + c.amount, 0)
}

/** Was pro Monat für Wünsche übrig bleibt, wenn das Alltagsbudget eingehalten wird. */
export function monthlySurplus(s: Settings): number {
  return s.netIncome - fixedCostTotal(s) - s.dailyBudget - s.safetyBuffer
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Alltagsausgaben im laufenden Monat; gekaufte Wünsche zählen nicht dazu. */
export function spentThisMonth(expenses: Expense[], today: Date): number {
  const key = monthKey(today)
  return expenses
    .filter((e) => !e.wish && e.date.startsWith(key))
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * Geld, das heute für Wünsche bereitsteht: das Ersparte am Stichtag, plus der
 * seitdem tageweise angefallene Überschuss. Abgezogen werden gekaufte Wünsche
 * und, pro Kalendermonat, Alltagsausgaben über dem Alltagsbudget. Weniger
 * ausgegeben zählt bewusst nicht als Plus, weil nicht jede Ausgabe eingetragen
 * wird; so bleibt die Rechnung auf der sicheren Seite.
 */
export function availableToday(s: Settings, expenses: Expense[], today: Date): number {
  const start = parseIsoDate(s.savingsDate)
  const elapsed = Math.max(0, daysBetween(start, today))
  const since = expenses.filter((e) => e.date >= s.savingsDate)
  const wishSpend = since.filter((e) => e.wish).reduce((sum, e) => sum + e.amount, 0)
  return s.savings + (monthlySurplus(s) / DAYS_PER_MONTH) * elapsed - overspend(s, since, start) - wishSpend
}

function overspend(s: Settings, expenses: Expense[], start: Date): number {
  const byMonth = new Map<string, number>()
  for (const e of expenses) {
    if (e.wish) continue
    const key = e.date.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + e.amount)
  }
  let total = 0
  for (const [key, spent] of byMonth) {
    // Im Startmonat gilt nur der Teil des Budgets ab dem Stichtag
    let allowance = s.dailyBudget
    if (key === monthKey(start)) {
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
      allowance *= (daysInMonth - start.getDate() + 1) / daysInMonth
    }
    total += Math.max(0, spent - allowance)
  }
  return total
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export interface WishPlan {
  wish: Wish
  /** Summe aller Wünsche bis einschließlich diesem, in Reihenfolge der Liste */
  cumulative: number
  /** null = mit dem aktuellen Plan nie ohne Schulden leistbar */
  affordableFrom: Date | null
  affordableNow: boolean
}

/**
 * Plant die Wünsche in Listenreihenfolge: Ein Wunsch ist leistbar, sobald das
 * verfügbare Geld alle Wünsche davor und ihn selbst abdeckt.
 */
export function planWishes(
  wishes: Wish[],
  s: Settings,
  expenses: Expense[],
  today: Date,
): WishPlan[] {
  const available = availableToday(s, expenses, today)
  const perDay = monthlySurplus(s) / DAYS_PER_MONTH
  let cumulative = 0
  return wishes.map((wish) => {
    cumulative += wish.price
    const missing = cumulative - available
    if (missing <= 0) {
      return { wish, cumulative, affordableFrom: startOfDay(today), affordableNow: true }
    }
    if (perDay <= 0) {
      return { wish, cumulative, affordableFrom: null, affordableNow: false }
    }
    const days = Math.ceil(missing / perDay)
    return { wish, cumulative, affordableFrom: addDays(today, days), affordableNow: false }
  })
}

/** Um wie viele Tage sich jeder Wunsch durch eine zusätzliche Ausgabe verschiebt. */
export function shiftByExpense(
  wishes: Wish[],
  s: Settings,
  expenses: Expense[],
  extra: Expense,
  today: Date,
): { wish: Wish; days: number | null }[] {
  const before = planWishes(wishes, s, expenses, today)
  const after = planWishes(wishes, s, [...expenses, extra], today)
  return before.map((b, i) => {
    const a = after[i]
    if (!b.affordableFrom || !a.affordableFrom) return { wish: b.wish, days: null }
    return { wish: b.wish, days: daysBetween(b.affordableFrom, a.affordableFrom) }
  })
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, days: number): Date {
  const r = startOfDay(d)
  r.setDate(r.getDate() + days)
  return r
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000)
}
