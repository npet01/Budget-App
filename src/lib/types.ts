export interface FixedCost {
  id: string
  label: string
  amount: number
}

export interface Settings {
  /** Nettogehalt pro Monat in Euro */
  netIncome: number
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
}

export interface Wish {
  id: string
  name: string
  price: number
  url?: string
  createdAt: string
  /** Bedenkzeit läuft bis zu diesem Zeitpunkt (ISO) */
  thinkUntil?: string
}
