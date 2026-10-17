import { describe, expect, it } from 'vitest'
import { findReceiptTotal, guessShop } from './receipt'

describe('Kassenbon', () => {
  it('nimmt den Betrag aus der Summen-Zeile', () => {
    const text = `REWE Markt GmbH
Milch 1,19
Brot 2,49
Kaffee 12,99
SUMME EUR 16,67
Bar 20,00
Rückgeld 3,33`
    expect(findReceiptTotal(text)).toBe(16.67)
    expect(guessShop(text)).toBe('REWE Markt GmbH')
  })

  it('ignoriert Zwischensumme und MwSt', () => {
    const text = `Zwischensumme 10,00
MwSt 19% 1,60
Zu zahlen 11,60`
    expect(findReceiptTotal(text)).toBe(11.6)
  })

  it('erkennt Tausenderpunkte', () => {
    expect(findReceiptTotal('Gesamt 1.299,00')).toBe(1299)
  })

  it('nimmt sonst den größten Betrag', () => {
    expect(findReceiptTotal('Artikel 3,50\nArtikel 7,20')).toBe(7.2)
  })

  it('gibt null zurück, wenn kein Betrag erkannt wird', () => {
    expect(findReceiptTotal('unleserlich')).toBeNull()
  })
})
