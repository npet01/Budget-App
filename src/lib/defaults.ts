import type { Settings } from './types'
import { todayIso } from './format'

export const DEFAULT_SETTINGS: Settings = {
  payType: 'salary',
  amountType: 'net',
  payAmount: 0,
  taxClass: 1,
  churchTax: false,
  hasChildren: false,
  incomeHistory: [],
  hoursPerWeek: 40,
  commuteMinutesPerDay: 30,
  workDaysPerWeek: 5,
  fixedCosts: [],
  dailyBudget: 400,
  safetyBuffer: 50,
  savings: 0,
  savingsDate: todayIso(),
}

/** Übernimmt Einstellungen aus der ersten Version, die nur ein Nettogehalt kannte. */
export function migrateSettings(stored: Settings & { netIncome?: number }): Settings {
  if (stored.payType) return stored
  const { netIncome, ...rest } = stored
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    payType: 'salary',
    amountType: 'net',
    payAmount: netIncome ?? 0,
  }
}
