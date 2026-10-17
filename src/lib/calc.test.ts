import { describe, expect, it } from 'vitest'
import { addDays, availableToday, currentMonth, monthAllowance, surplusPerDay, extraPerDayForTarget, planWishes, priceToWorkTime, realHourlyWage, shiftByExpense } from './calc'
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
  deposits: [],
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

describe('Schneller sparen', () => {
  it('extra Geld pro Tag holt einen Wunsch nach vorne', () => {
    const today = day('2026-10-01')
    const [normal] = planWishes([wish('a', 500)], settings, [], today)
    const [faster] = planWishes([wish('a', 500)], settings, [], today, 5)
    // Überschuss 500 €/Monat ≈ 16,43 €/Tag, mit 5 € mehr ≈ 21,43 €/Tag; es fehlen 300 €, also 19 statt 15 Tage
    expect(normal.affordableFrom).toEqual(addDays(today, 19))
    expect(faster.affordableFrom).toEqual(addDays(today, 15))
  })

  it('macht einen Wunsch ohne Überschuss erst möglich', () => {
    const broke = { ...settings, dailyBudget: 1100 }
    const [p] = planWishes([wish('a', 500)], broke, [], day('2026-10-01'), 10)
    expect(p.affordableFrom).not.toBeNull()
  })
})

describe('Spartopf pro Wunsch', () => {
  it('zieht das Zurückgelegte vom Preis ab', () => {
    const today = day('2026-10-01')
    const [p] = planWishes([{ ...wish('a', 500), saved: 300 }], settings, [], today)
    expect(p.affordableNow).toBe(true)
  })

  it('ein voller Topf ist sofort leistbar, auch hinter teuren Wünschen', () => {
    const [, b] = planWishes([wish('a', 5000), { ...wish('b', 80), saved: 80 }], settings, [], day('2026-10-01'))
    expect(b.affordableNow).toBe(true)
  })

  it('beim Kauf zählt nur der Teil außerhalb des Topfs gegen das Ersparte', () => {
    const bought: Expense = { id: 'k', date: '2026-10-01', label: 'a', amount: 150, source: 'manual', wish: true, fromPot: 100 }
    expect(availableToday(settings, [bought], day('2026-10-01'))).toBe(150)
  })
})

describe('Wunschdatum', () => {
  const today = day('2026-10-01')

  it('rechnet aus, wie viel pro Tag extra nötig ist', () => {
    const [p] = planWishes([wish('a', 1000)], settings, [], today)
    // es fehlen 800 €, der Plan bringt in 10 Tagen etwa 164 €
    const perDay = 500 / (365.25 / 12)
    expect(extraPerDayForTarget(p, settings, today, addDays(today, 10))).toBeCloseTo((800 - perDay * 10) / 10, 5)
  })

  it('ist 0, wenn der Plan schon reicht, und null für ein vergangenes Datum', () => {
    const [p] = planWishes([wish('a', 300)], settings, [], today)
    expect(extraPerDayForTarget(p, settings, today, addDays(today, 60))).toBe(0)
    expect(extraPerDayForTarget(p, settings, today, addDays(today, -1))).toBeNull()
  })
})

describe('Laufender Monat', () => {
  it('zeigt Fixkosten, Ausgaben bisher und Restgeld', () => {
    const spent: Expense[] = [
      { id: '1', date: '2026-10-03', label: 'Einkauf', amount: 120, source: 'manual' },
      { id: '2', date: '2026-09-28', label: 'alt', amount: 50, source: 'manual' },
    ]
    const m = currentMonth(settings, spent, day('2026-10-10'))
    expect(m.fixedCosts).toBe(800)
    expect(m.spent).toBe(120)
    expect(m.left).toBe(2000 - 800 - 120)
  })
})

describe('Geld hinzufügen', () => {
  const gift = { id: 'g', date: '2026-10-05', label: 'Geburtstag', amount: 100 }

  it('zählt zum freien Geld und verkürzt die Wartezeit', () => {
    const today = day('2026-10-05')
    const withGift = { ...settings, deposits: [gift] }
    expect(availableToday(withGift, [], today) - availableToday(settings, [], today)).toBeCloseTo(100, 5)
    const [before] = planWishes([wish('a', 800)], settings, [], today)
    const [after] = planWishes([wish('a', 800)], withGift, [], today)
    expect(after.daysLeft!).toBeLessThan(before.daysLeft!)
  })

  it('zählt nicht, wenn es vor dem Stichtag des Ersparten lag', () => {
    const old = { ...settings, deposits: [{ ...gift, date: '2026-09-20' }] }
    expect(availableToday(old, [], day('2026-10-01'))).toBe(200)
  })

  it('erscheint im Monat als Extra und erhöht das Restgeld', () => {
    const m = currentMonth({ ...settings, deposits: [gift] }, [], day('2026-10-10'))
    expect(m.extra).toBe(100)
    expect(m.left).toBe(2000 + 100 - 800)
  })
})

describe('Alltagsbudget und Tagesbetrag', () => {
  it('gilt im Startmonat nur anteilig, danach voll', () => {
    const s = { ...settings, dailyBudget: 400, savingsDate: '2026-10-17' }
    expect(monthAllowance(s, '2026-10')).toBeCloseTo((400 * 15) / 31, 5)
    expect(monthAllowance(s, '2026-11')).toBe(400)
  })

  it('verteilt den Monatsüberschuss auf die Tage', () => {
    expect(surplusPerDay(settings)).toBeCloseTo(500 / (365.25 / 12), 5)
  })
})
