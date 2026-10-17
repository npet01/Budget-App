const TOTAL_WORDS = /(summe|gesamt|zu zahlen|zahlbetrag|total|endbetrag|betrag)/i
const AMOUNT = /(\d{1,4}(?:\.\d{3})*[.,]\d{2})(?!\d)/g

function toNumber(raw: string): number {
  return Number(raw.replace(/\.(?=\d{3}[.,])/g, '').replace(',', '.'))
}

/**
 * Findet den Gesamtbetrag im erkannten Text eines Kassenbons. Bevorzugt Zeilen
 * mit "Summe", "Gesamt" oder "Zu zahlen"; sonst der größte Betrag auf dem Bon.
 */
export function findReceiptTotal(text: string): number | null {
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!TOTAL_WORDS.test(line) || /zwischensumme|mwst|ust|steuer|netto/i.test(line)) continue
    const amounts = [...line.matchAll(AMOUNT)].map((m) => toNumber(m[1]))
    if (amounts.length) return amounts[amounts.length - 1]
  }
  const all = [...text.matchAll(AMOUNT)].map((m) => toNumber(m[1]))
  return all.length ? Math.max(...all) : null
}

/** Name des Geschäfts: meist die erste Zeile mit Buchstaben. */
export function guessShop(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /[a-zäöü]{3,}/i.test(l))
  return line ? line.slice(0, 40) : 'Einkauf'
}

/** Texterkennung läuft komplett im Browser; das Foto verlässt das Gerät nicht. */
export async function recognizeReceipt(image: File): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('deu')
  try {
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}
