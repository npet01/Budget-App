export interface FixedCost {
  id: string
  label: string
  amount: number
}

import type { TaxClass } from './salary'

/** Was tatsächlich in einem Monat auf dem Konto ankam. */
export interface IncomeMonth {
  /** YYYY-MM */
  month: string
  net: number
  /** Tatsächlich gearbeitete Stunden, falls bekannt (wichtig bei Stundenlohn) */
  hours?: number
}

export interface Settings {
  /** Festgehalt pro Monat oder Bezahlung pro Stunde */
  payType: 'salary' | 'hourly'
  /** Ob payAmount brutto oder netto ist */
  amountType: 'gross' | 'net'
  /** Monatsgehalt bzw. Stundenlohn in Euro */
  payAmount: number
  taxClass: TaxClass
  churchTax: boolean
  hasChildren: boolean
  /** Echte Nettoeinkommen der letzten Monate; haben Vorrang vor der Schätzung */
  incomeHistory: IncomeMonth[]
  /** Vertraglich bezahlte Arbeitsstunden pro Woche */
  hoursPerWeek: number
  /** Unbezahlte Zeit pro Arbeitstag, die trotzdem für die Arbeit draufgeht (Fahrt, Umziehen) */
  commuteMinutesPerDay: number
  workDaysPerWeek: number
  fixedCosts: FixedCost[]
  /** Geplante Ausgaben für den Alltag (Essen, Freizeit) pro Monat */
  dailyBudget: number
  /** Was am Monatsende mindestens übrig bleiben soll */
  safetyBuffer: number
  /** Bereits angespartes Geld, das für Wünsche verwendet werden darf */
  savings: number
  /** Stichtag, an dem "savings" galt (YYYY-MM-DD); ab da wird hochgerechnet */
  savingsDate: string
}

export interface Expense {
  id: string
  /** ISO-Datum YYYY-MM-DD */
  date: string
  label: string
  amount: number
  source: 'manual' | 'receipt'
  warranty?: boolean
  /** Gekaufter Wunsch: zählt nicht gegen das Alltagsbudget */
  wish?: boolean
  /** Teil des Preises, der aus dem Spartopf des Wunsches bezahlt wurde */
  fromPot?: number
}

export interface Wish {
  id: string
  name: string
  price: number
  url?: string
  createdAt: string
  /** Bedenkzeit läuft bis zu diesem Zeitpunkt (ISO) */
  thinkUntil?: string
  /** Extra für genau diesen Wunsch zurückgelegt (Spartopf), zusätzlich zum Plan */
  saved?: number
  /** Bis wann man den Wunsch haben möchte (YYYY-MM-DD) */
  targetDate?: string
}
