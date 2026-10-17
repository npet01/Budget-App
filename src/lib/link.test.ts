import { describe, expect, it } from 'vitest'
import { extractUrl, nameFromUrl, safeUrl, shopName } from './link'

describe('Produktlinks', () => {
  it('findet den Link in geteiltem Text', () => {
    expect(extractUrl('Schau mal: https://www.amazon.de/dp/B0ABC123 cool, oder?')).toBe('https://www.amazon.de/dp/B0ABC123')
    expect(extractUrl('kein Link hier')).toBeNull()
  })

  it('lässt nur Web-Adressen zu', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('https://shop.de/x')).toBe('https://shop.de/x')
  })

  it('zeigt einen kurzen Shopnamen', () => {
    expect(shopName('https://www.otto.de/p/irgendwas')).toBe('otto.de')
  })

  it('rät den Produktnamen aus der Adresse', () => {
    expect(nameFromUrl('https://www.amazon.de/Samsung-GQ55Q60D-Zoll-Fernseher/dp/B0CW5ZFT5S')).toBe('Samsung GQ55Q60D Zoll Fernseher')
    expect(nameFromUrl('https://www.zalando.de/nike-sportswear-air-force-1-sneaker-low.html')).toBe('Nike sportswear air force 1 sneaker low')
    expect(nameFromUrl('https://www.amazon.de/dp/B0CW5ZFT5S')).toBe('')
  })
})
