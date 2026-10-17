import { describe, expect, it } from 'vitest'
import { availableToday, planWishes, priceToWorkTime, realHourlyWage, shiftByExpense } from './calc'
import type { Expense, Settings, Wish } from './types'

const settings: Settings = {
  payType: 'salary',
  amountType: 'net',
  payAmount: 2000,
  taxClass: 1,
  churchTax: false,
  hasChildren: false,
  incomeHistory: [],
  hoursPerWeek: 40,
  commuteMinutesPerDay: 0,
  workDaysPerWeek: 5,
  fixedCosts: [{ id: 'm', label: 'Miete', amount: 800 }],
  dailyBudget: 600,
  safetyBuffer: 100,
  savings: 200,
  savingsDate: '2026-10-01',
}

const wish = (id: string, price: number): Wish => ({ id, name: id, price, createdAt: '2026-10-01' })
const day = (iso: string) => new Date(`${iso}T12:00:00`)

describe('Stundenlohn', () => {
  it('teilt Netto durch die Monatsstunden', () => {
    expect(realHourlyWage(settings)).toBeCloseTo(2000 / (40 * 52 / 12), 5)
  })

  it('rechnet Fahrtzeit als Arbeitszeit mit', () => {
    const withCommute = { ...settings, commuteMinutesPerDay: 60 }
    expect(realHourlyWage(withCommute)).toBeLessThan(realHourlyWage(settings))
  })

  it('rechnet Preise in Stunden und Arbeitstage um', () => {
    const t = priceToWorkTime(realHourlyWage(settings) * 16, settings)
    expect(t.hours).toBeCloseTo(16, 5)
    expect(t.workDays).toBeCloseTo(2, 5)
  })
})

describe('Wunschplanung', () => {
  it('am Stichtag ist nur das Ersparte verfügbar', () => {
    expect(availableToday(settings, [], day('2026-10-01'))).toBe(200)
  })

  it('ein Wunsch unter dem Ersparten ist sofort leistbar', () => {
    const [p] = planWishes([wish('a', 150)], settings, [], day('2026-10-01'))
    expect(p.affordableNow).toBe(true)
  })

  it('plant Wünsche nacheinander: der zweite kommt später', () => {
    const [a, b] = planWishes([wish('a', 300), wish('b', 300)], settings, [], day('2026-10-01'))
    expect(a.affordableFrom!.getTime()).toBeLessThan(b.affordableFrom!.getTime())
  })

  it('ohne Überschuss ist ein Wunsch nie leistbar', () => {
    const broke = { ...settings, dailyBudget: 1100 }
    const [p] = planWishes([wish('a', 500)], broke, [], day('2026-10-01'))
    expect(p.affordableFrom).toBeNull()
  })

  it('Alltagsausgaben innerhalb des Budgets verschieben nichts', () => {
    const small: Expense = { id: 'x', date: '2026-10-10', label: 'Brot', amount: 5, source: 'manual' }
    const [shift] = shiftByExpense([wish('a', 800)], settings, [], small, day('2026-10-10'))
    expect(shift.days).toBe(0)
  })

  it('ein großer Einkauf innerhalb des Monatsbudgets verschiebt nichts', () => {
    const shop: Expense = { id: 'x', date: '2026-10-02', label: 'Großeinkauf', amount: 300, source: 'receipt' }
    const [shift] = shiftByExpense([wish('a', 800)], settings, [], shop, day('2026-10-02'))
    expect(shift.days).toBe(0)
  })

  it('Ausgaben über dem Monatsbudget verschieben den Wunsch nach hinten', () => {
    const big: Expense = { id: 'x', date: '2026-10-10', label: 'Konzert', amount: 700, source: 'receipt' }
    const [shift] = shiftByExpense([wish('a', 800)], settings, [], big, day('2026-10-10'))
    expect(shift.days).toBeGreaterThan(0)
  })

  it('im Startmonat zählt nur das anteilige Budget', () => {
    const late = { ...settings, savingsDate: '2026-10-17' }
    const shop: Expense = { id: 'x', date: '2026-10-17', label: 'Einkauf', amount: 500, source: 'manual' }
    // 15 von 31 Tagen: Budget 600 × 15/31 ≈ 290 €, also gut 210 € drüber
    expect(availableToday(late, [shop], day('2026-10-17'))).toBeCloseTo(200 - (500 - 600 * 15 / 31), 5)
  })

  it('gekaufte Wünsche gehen vom verfügbaren Geld ab', () => {
    const bought: Expense = { id: 'w', date: '2026-10-01', label: 'a', amount: 150, source: 'manual', wish: true }
    expect(availableToday(settings, [bought], day('2026-10-01'))).toBe(50)
  })
})
