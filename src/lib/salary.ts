/**
 * Grobe Brutto-Netto-Schätzung für Arbeitnehmer in Deutschland, Stand 2026.
 *
 * Quellen: Einkommensteuertarif nach § 32a EStG für 2026
 * (https://www.finanz-tools.de/einkommensteuer/berechnung-formeln/2026),
 * Beitragssätze und Bemessungsgrenzen 2026 (Haufe, Arbeitskammer des Saarlandes).
 *
 * Bewusst vereinfacht: keine Midijob-Gleitzone, keine Kinderfreibeträge,
 * Zusatzbeitrag der Krankenkasse als Durchschnitt. Ergebnis ist eine
 * Schätzung; wer seine Lohnabrechnung hat, trägt besser das Netto ein.
 */

export type TaxClass = 1 | 2 | 3 | 4 | 5 | 6

export interface GrossInput {
  monthlyGross: number
  taxClass: TaxClass
  churchTax: boolean
  hasChildren: boolean
}

const GRUNDFREIBETRAG = 12_348
const ARBEITNEHMER_PAUSCHBETRAG = 1_230
const SONDERAUSGABEN_PAUSCHBETRAG = 36
const ENTLASTUNGSBETRAG_ALLEINERZIEHENDE = 4_260
const MINIJOB_GRENZE = 603

const BBG_KV_MONTH = 5_812.5
const BBG_RV_MONTH = 8_450

const RV = 0.093
const AV = 0.013
const KV = 0.073 + 0.0145
const PV_WITH_CHILDREN = 0.018
const PV_CHILDLESS = 0.024

const SOLI_FREIGRENZE = 20_350

/** Einkommensteuer nach Grundtarif 2026 für ein zu versteuerndes Jahreseinkommen. */
export function incomeTax2026(zvE: number): number {
  const x = Math.floor(Math.max(0, zvE))
  let tax: number
  if (x <= GRUNDFREIBETRAG) tax = 0
  else if (x <= 17_799) {
    const y = (x - GRUNDFREIBETRAG) / 10_000
    tax = (914.51 * y + 1_400) * y
  } else if (x <= 69_878) {
    const z = (x - 17_799) / 10_000
    tax = (173.1 * z + 2_397) * z + 1_034.87
  } else if (x <= 277_825) tax = 0.42 * x - 11_135.63
  else tax = 0.45 * x - 19_470.38
  return Math.floor(tax)
}

/** Lohnsteuer pro Jahr je Steuerklasse (vereinfacht nach § 39b EStG). */
function annualWageTax(zvE: number, taxClass: TaxClass): number {
  switch (taxClass) {
    case 3:
      return 2 * incomeTax2026(zvE / 2)
    case 5:
    case 6: {
      // Steuerklasse V/VI: doppelter Unterschied zwischen 125 % und 75 %, mindestens 14 %
      const diff = 2 * (incomeTax2026(zvE * 1.25) - incomeTax2026(zvE * 0.75))
      return Math.max(diff, 0.14 * zvE)
    }
    default:
      return incomeTax2026(zvE)
  }
}

export interface NetBreakdown {
  gross: number
  socialSecurity: number
  wageTax: number
  soli: number
  churchTax: number
  net: number
}

/** Schätzt das monatliche Netto aus dem monatlichen Brutto. */
export function estimateNet(input: GrossInput): NetBreakdown {
  const gross = Math.max(0, input.monthlyGross)
  if (gross <= MINIJOB_GRENZE) {
    return { gross, socialSecurity: 0, wageTax: 0, soli: 0, churchTax: 0, net: gross }
  }

  const kvBase = Math.min(gross, BBG_KV_MONTH)
  const rvBase = Math.min(gross, BBG_RV_MONTH)
  const pv = input.hasChildren ? PV_WITH_CHILDREN : PV_CHILDLESS
  const rvAv = rvBase * (RV + AV)
  const kvPv = kvBase * (KV + pv)
  const socialSecurity = rvAv + kvPv

  // Vorsorgepauschale: Arbeitnehmeranteile zu Renten-, Kranken- und Pflegeversicherung
  const vorsorge = (rvBase * RV + kvPv) * 12
  const annualGross = gross * 12
  const sixth = input.taxClass === 6
  let zvE = annualGross - vorsorge
  if (!sixth) zvE -= ARBEITNEHMER_PAUSCHBETRAG + SONDERAUSGABEN_PAUSCHBETRAG
  if (input.taxClass === 2) zvE -= ENTLASTUNGSBETRAG_ALLEINERZIEHENDE

  const annualTax = annualWageTax(zvE, input.taxClass)
  const soliLimit = input.taxClass === 3 ? 2 * SOLI_FREIGRENZE : SOLI_FREIGRENZE
  const annualSoli = annualTax <= soliLimit ? 0 : Math.min(annualTax * 0.055, (annualTax - soliLimit) * 0.119)
  const annualChurch = input.churchTax ? annualTax * 0.09 : 0

  const wageTax = annualTax / 12
  const soli = annualSoli / 12
  const churchTax = annualChurch / 12
  const net = gross - socialSecurity - wageTax - soli - churchTax
  return { gross, socialSecurity, wageTax, soli, churchTax, net }
}
