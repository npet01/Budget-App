import { describe, expect, it } from 'vitest'
import { estimateNet, incomeTax2026 } from './salary'
import { monthOverview, monthlyNetIncome, realHourlyWage } from './calc'
import { DEFAULT_SETTINGS, migrateSettings } from './defaults'
import type { Settings } from './types'

describe('Einkommensteuer 2026', () => {
  it('bis zum Grundfreibetrag ist sie null', () => {
    expect(incomeTax2026(12_348)).toBe(0)
  })

  it('folgt den Tarifzonen', () => {
    // Zone 3: z = (40.000 − 17.799) / 10.000
    const z = (40_000 - 17_799) / 10_000
    expect(incomeTax2026(40_000)).toBe(Math.floor((173.1 * z + 2_397) * z + 1_034.87))
    expect(incomeTax2026(100_000)).toBe(Math.floor(0.42 * 100_000 - 11_135.63))
  })
})

describe('Brutto-Netto-Schätzung', () => {
  const base = { monthlyGross: 3_000, taxClass: 1 as const, churchTax: false, hasChildren: false }

  it('liegt bei 3.000 € brutto, Klasse I, im üblichen Bereich', () => {
    const r = estimateNet(base)
    expect(r.socialSecurity).toBeCloseTo(3_000 * 0.2175, 2)
    expect(r.net).toBeGreaterThan(2_000)
    expect(r.net).toBeLessThan(2_150)
  })

  it('Klasse III gibt mehr Netto als I, Klasse V weniger', () => {
    const one = estimateNet(base).net
    expect(estimateNet({ ...base, taxClass: 3 }).net).toBeGreaterThan(one)
    expect(estimateNet({ ...base, taxClass: 5 }).net).toBeLessThan(one)
  })

  it('Kirchensteuer und Kinderlosigkeit kosten Netto', () => {
    const one = estimateNet(base).net
    expect(estimateNet({ ...base, churchTax: true }).net).toBeLessThan(one)
    expect(estimateNet({ ...base, hasChildren: true }).net).toBeGreaterThan(one)
  })

  it('Minijob bleibt abgabenfrei', () => {
    expect(estimateNet({ ...base, monthlyGross: 550 }).net).toBe(550)
  })
})

describe('Einkommen aus echten Monaten', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, payType: 'hourly', amountType: 'gross', payAmount: 15, commuteMinutesPerDay: 0 }

  it('ohne eingetragene Monate wird aus dem Stundenlohn geschätzt', () => {
    const gross = 15 * 40 * (52 / 12)
    expect(monthlyNetIncome(settings)).toBeCloseTo(estimateNet({ monthlyGross: gross, taxClass: 1, churchTax: false, hasChildren: false }).net, 5)
  })

  it('nutzt den Durchschnitt der letzten drei Monate', () => {
    const s = {
      ...settings,
      incomeHistory: [
        { month: '2026-06', net: 9_999 },
        { month: '2026-07', net: 1_800 },
        { month: '2026-08', net: 2_100 },
        { month: '2026-09', net: 1_950 },
      ],
    }
    expect(monthlyNetIncome(s)).toBeCloseTo((1_800 + 2_100 + 1_950) / 3, 5)
  })

  it('rechnet mit den tatsächlich gearbeiteten Stunden', () => {
    const s = { ...settings, incomeHistory: [{ month: '2026-09', net: 1_500, hours: 100 }] }
    expect(realHourlyWage(s)).toBeCloseTo(15, 5)
  })

  it('Monatsübersicht zieht Fixkosten und Ausgaben ab', () => {
    const s = {
      ...settings,
      fixedCosts: [{ id: 'm', label: 'Miete', amount: 700 }],
      incomeHistory: [{ month: '2026-09', net: 2_000 }],
    }
    const months = monthOverview(s, [{ id: 'e', date: '2026-09-12', label: 'Einkauf', amount: 300, source: 'manual' }], new Date(2026, 9, 17))
    const sept = months.find((m) => m.month === '2026-09')!
    expect(sept.left).toBe(1_000)
    expect(months[0].month).toBe('2026-10')
    expect(months[0].incomeIsActual).toBe(false)
  })
})

describe('Alte Einstellungen', () => {
  it('werden mit dem Netto als Festgehalt übernommen', () => {
    const old = { ...DEFAULT_SETTINGS, netIncome: 1_900 } as Settings & { netIncome: number }
    delete (old as Partial<Settings>).payType
    const migrated = migrateSettings(old)
    expect(migrated.payType).toBe('salary')
    expect(migrated.amountType).toBe('net')
    expect(migrated.payAmount).toBe(1_900)
    expect('netIncome' in migrated).toBe(false)
  })
})
