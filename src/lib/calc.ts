import type { Expense, IncomeMonth, Settings, Wish } from './types'
import { estimateNet, type NetBreakdown } from './salary'

const WEEKS_PER_MONTH = 52 / 12
const DAYS_PER_MONTH = 365.25 / 12
const HISTORY_MONTHS = 3

/** Bruttolohn pro Monat laut Vertrag (Stundenlohn × Stunden oder Festgehalt). */
function contractMonthlyAmount(s: Settings): number {
  return s.payType === 'hourly' ? s.payAmount * s.hoursPerWeek * WEEKS_PER_MONTH : s.payAmount
}

/** Brutto-Netto-Schätzung für den Vertragslohn (nur sinnvoll bei Brutto-Eingabe). */
export function grossBreakdown(s: Settings): NetBreakdown {
  return estimateNet({
    monthlyGross: contractMonthlyAmount(s),
    taxClass: s.taxClass,
    churchTax: s.churchTax,
    hasChildren: s.hasChildren,
  })
}

/** Netto laut Vertrag: direkt eingegeben oder aus dem Brutto geschätzt. */
export function contractMonthlyNet(s: Settings): number {
  return s.amountType === 'net' ? contractMonthlyAmount(s) : grossBreakdown(s).net
}

/** Die letzten eingetragenen Monate, neueste zuerst. */
export function recentIncome(s: Settings, count = HISTORY_MONTHS): IncomeMonth[] {
  return [...s.incomeHistory].sort((a, b) => b.month.localeCompare(a.month)).slice(0, count)
}

export type IncomeSource = 'history' | 'net' | 'estimate'

export function incomeSource(s: Settings): IncomeSource {
  if (recentIncome(s).length) return 'history'
  return s.amountType === 'net' ? 'net' : 'estimate'
}

/** Netto pro Monat: Durchschnitt der letzten echten Monate, sonst laut Vertrag. */
export function monthlyNetIncome(s: Settings): number {
  const recent = recentIncome(s)
  if (!recent.length) return contractMonthlyNet(s)
  return recent.reduce((sum, m) => sum + m.net, 0) / recent.length
}

/** Bezahlte Stunden pro Monat: Durchschnitt der eingetragenen Monate, sonst laut Vertrag. */
function monthlyPaidHours(s: Settings): number {
  const withHours = recentIncome(s).filter((m) => m.hours && m.hours > 0)
  if (withHours.length) return withHours.reduce((sum, m) => sum + m.hours!, 0) / withHours.length
  return s.hoursPerWeek * WEEKS_PER_MONTH
}

/** Stunden, die man im Monat tatsächlich für die Arbeit aufwendet, inklusive Fahrtzeit. */
export function monthlyWorkHours(s: Settings): number {
  const commute = (s.commuteMinutesPerDay / 60) * s.workDaysPerWeek * WEEKS_PER_MONTH
  return monthlyPaidHours(s) + commute
}

/** Echter Stundenlohn: netto, geteilt durch alle Stunden, die die Arbeit kostet. */
export function realHourlyWage(s: Settings): number {
  const hours = monthlyWorkHours(s)
  return hours > 0 ? monthlyNetIncome(s) / hours : 0
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
  return monthlyNetIncome(s) - fixedCostTotal(s) - s.dailyBudget - s.safetyBuffer
}

export function monthKey(date: Date): string {
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
  // Was aus einem Spartopf bezahlt wurde, war nie Teil des Plans
  const wishSpend = since.filter((e) => e.wish).reduce((sum, e) => sum + e.amount - (e.fromPot ?? 0), 0)
  const deposits = s.deposits.filter((d) => d.date >= s.savingsDate).reduce((sum, d) => sum + d.amount, 0)
  return s.savings + deposits + (monthlySurplus(s) / DAYS_PER_MONTH) * elapsed - overspend(s, since, start) - wishSpend
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

/** Was nach dem Spartopf noch fehlt. */
export function wishRemaining(wish: Wish): number {
  return Math.max(0, wish.price - (wish.saved ?? 0))
}

export interface WishPlan {
  wish: Wish
  /** Summe aller noch offenen Beträge bis einschließlich diesem Wunsch, in Reihenfolge der Liste */
  cumulative: number
  /** Wie viel dafür heute noch fehlt */
  missing: number
  /** null = mit dem aktuellen Plan nie ohne Schulden leistbar */
  affordableFrom: Date | null
  /** Kalendertage bis zum Kauf (0 = heute), null = nie */
  daysLeft: number | null
  affordableNow: boolean
}

/**
 * Plant die Wünsche in Listenreihenfolge: Ein Wunsch ist leistbar, sobald das
 * verfügbare Geld alle Wünsche davor und ihn selbst abdeckt. `extraPerDay` ist
 * Geld, das man ab heute zusätzlich täglich zur Seite legt.
 */
export function planWishes(
  wishes: Wish[],
  s: Settings,
  expenses: Expense[],
  today: Date,
  extraPerDay = 0,
): WishPlan[] {
  const available = availableToday(s, expenses, today)
  const perDay = monthlySurplus(s) / DAYS_PER_MONTH + extraPerDay
  let cumulative = 0
  return wishes.map((wish) => {
    const remaining = wishRemaining(wish)
    // Ein voller Spartopf wartet auf keinen anderen Wunsch
    if (remaining === 0) {
      return { wish, cumulative, missing: 0, affordableFrom: startOfDay(today), daysLeft: 0, affordableNow: true }
    }
    cumulative += remaining
    const missing = cumulative - available
    if (missing <= 0) {
      return { wish, cumulative, missing: 0, affordableFrom: startOfDay(today), daysLeft: 0, affordableNow: true }
    }
    if (perDay <= 0) {
      return { wish, cumulative, missing, affordableFrom: null, daysLeft: null, affordableNow: false }
    }
    const days = Math.ceil(missing / perDay)
    return { wish, cumulative, missing, affordableFrom: addDays(today, days), daysLeft: days, affordableNow: false }
  })
}

/**
 * Wie viel man ab heute täglich extra zurücklegen müsste, damit ein Wunsch bis
 * zum Wunschdatum leistbar ist. 0 = klappt schon mit dem Plan, null = Datum vorbei.
 */
export function extraPerDayForTarget(plan: WishPlan, s: Settings, today: Date, target: Date): number | null {
  const days = daysBetween(today, target)
  if (plan.missing <= 0) return 0
  if (days <= 0) return null
  const perDay = Math.max(0, monthlySurplus(s) / DAYS_PER_MONTH)
  return Math.max(0, (plan.missing - perDay * days) / days)
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

/** Der laufende Monat aus der Monatsübersicht. */
export function currentMonth(s: Settings, expenses: Expense[], today: Date): MonthOverview {
  const key = monthKey(today)
  return monthOverview(s, expenses, today, Infinity).find((m) => m.month === key)!
}

export interface MonthOverview {
  /** YYYY-MM */
  month: string
  income: number
  /** false = kein echter Wert eingetragen, es wird mit dem erwarteten Netto gerechnet */
  incomeIsActual: boolean
  /** Extra Geld in diesem Monat, z. B. Geschenke */
  extra: number
  hours?: number
  fixedCosts: number
  /** Alltagsausgaben plus gekaufte Wünsche */
  spent: number
  left: number
}

/** Monatsübersicht für alle Monate mit Einkommen oder Ausgaben, neueste zuerst. */
export function monthOverview(s: Settings, expenses: Expense[], today: Date, limit = 6): MonthOverview[] {
  const months = new Set<string>([monthKey(today)])
  s.incomeHistory.forEach((m) => months.add(m.month))
  s.deposits.forEach((d) => months.add(d.date.slice(0, 7)))
  expenses.forEach((e) => months.add(e.date.slice(0, 7)))
  const fixed = fixedCostTotal(s)
  const expected = monthlyNetIncome(s)
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit)
    .map((month) => {
      const entry = s.incomeHistory.find((m) => m.month === month)
      const income = entry ? entry.net : expected
      const spent = expenses.filter((e) => e.date.startsWith(month)).reduce((sum, e) => sum + e.amount, 0)
      const extra = s.deposits.filter((d) => d.date.startsWith(month)).reduce((sum, d) => sum + d.amount, 0)
      return {
        month,
        income,
        incomeIsActual: Boolean(entry),
        extra,
        hours: entry?.hours,
        fixedCosts: fixed,
        spent,
        left: income + extra - fixed - spent,
      }
    })
}
