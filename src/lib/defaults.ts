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
  workDaysPerWeek: 5,
  fixedCosts: [],
  dailyBudget: 400,
  safetyBuffer: 50,
  savings: 0,
  savingsDate: todayIso(),
  deposits: [],
}

/** Übernimmt Einstellungen aus der ersten Version, die nur ein Nettogehalt kannte. */
export function migrateSettings(stored: Settings & { netIncome?: number; commuteMinutesPerDay?: number }): Settings {
  // Die Fahrtzeit wird nicht mehr mitgerechnet
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { commuteMinutesPerDay, ...current } = stored
  if (current.payType) return current.deposits ? current : { ...current, deposits: [] }
  const { netIncome, ...rest } = current
  return {
    ...DEFAULT_SETTINGS,
    ...rest,
    payType: 'salary',
    amountType: 'net',
    payAmount: netIncome ?? 0,
  }
}
