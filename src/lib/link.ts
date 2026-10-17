/** Findet den ersten Web-Link in eingefügtem Text, z. B. aus „Teilen → Kopieren“ einer Shop-App. */
export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"]+/i)
  return match ? safeUrl(match[0]) : null
}

/** Nur echte Web-Adressen; verhindert z. B. javascript:-Links. */
export function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/** Kurzer Shopname für den Knopf, z. B. „amazon.de“. */
export function shopName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^(www|m)\./, '')
  } catch {
    return 'Shop'
  }
}

/**
 * Rät einen Produktnamen aus dem Link. Viele Shops schreiben ihn in die
 * Adresse, z. B. amazon.de/Samsung-55-Zoll-Fernseher/dp/B0C…
 */
export function nameFromUrl(url: string): string {
  let path: string
  try {
    path = decodeURIComponent(new URL(url).pathname)
  } catch {
    return ''
  }
  const words = (segment: string) => segment.replace(/\.html?$/i, '').split(/[-_+]+/).filter(Boolean)
  // Der längste Abschnitt mit mehreren Wörtern ist meist der Produktname
  const best = path
    .split('/')
    .map(words)
    .filter((w) => w.length >= 2 && w.some((part) => /[a-zäöüß]{3,}/i.test(part)))
    .sort((a, b) => b.length - a.length)[0]
  if (!best) return ''
  const name = best.join(' ')
  return name.charAt(0).toUpperCase() + name.slice(1)
}
