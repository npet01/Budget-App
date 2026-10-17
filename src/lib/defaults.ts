import type { Settings } from './types'
import { todayIso } from './format'

export const DEFAULT_SETTINGS: Settings = {
  netIncome: 0,
  hoursPerWeek: 40,
  commuteMinutesPerDay: 30,
  workDaysPerWeek: 5,
  fixedCosts: [],
  dailyBudget: 400,
  safetyBuffer: 50,
  savings: 0,
  savingsDate: todayIso(),
}
