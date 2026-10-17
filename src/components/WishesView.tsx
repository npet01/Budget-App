import { useEffect, useState } from 'react'
import type { Expense, Settings, Wish } from '../lib/types'
import { availableToday, monthlySurplus, planWishes, priceToWorkTime, realHourlyWage } from '../lib/calc'
import { formatDate, formatEuro, formatWorkTime, newId, parseAmount, todayIso } from '../lib/format'

interface Props {
  settings: Settings
  wishes: Wish[]
  expenses: Expense[]
  setWishes: (w: Wish[]) => void
  onBought: (wish: Wish) => void
  shared: { name: string; url: string } | null
  clearShared: () => void
}

const THINK_HOURS = 48

export function WishesView({ settings, wishes, expenses, setWishes, onBought, shared, clearShared }: Props) {
  const today = new Date()
  const plans = planWishes(wishes, settings, expenses, today)
  const surplus = monthlySurplus(settings)

  return (
    <>
      <section className="card summary">
        <div>
          <small>Dein echter Stundenlohn</small>
          <strong>{formatEuro(realHourlyWage(settings))}</strong>
        </div>
        <div>
          <small>Heute für Wünsche frei</small>
          <strong>{formatEuro(Math.max(0, availableToday(settings, expenses, today)))}</strong>
        </div>
        <div>
          <small>Pro Monat dazu</small>
          <strong className={surplus <= 0 ? 'negative' : ''}>{formatEuro(surplus)}</strong>
        </div>
      </section>

      {surplus <= 0 && (
        <p className="warning">
          Nach Fixkosten, Alltagsbudget und Puffer bleibt nichts übrig. Wünsche wären nur mit Schulden möglich.
        </p>
      )}

      <WishForm settings={settings} shared={shared} clearShared={clearShared} onAdd={(w) => setWishes([...wishes, w])} />

      {plans.length === 0 ? (
        <p className="empty">
          Noch keine Wünsche. Trag oben etwas ein oder teile ein Produkt aus einer Shop-App mit dieser App.
        </p>
      ) : (
        <ul className="wishes">
          {plans.map(({ wish, affordableFrom, affordableNow }, i) => {
            const thinking = wish.thinkUntil && new Date(wish.thinkUntil) > today
            return (
              <li key={wish.id} className="card wish">
                <div className="wish-head">
                  <div>
                    <h3>{wish.url ? <a href={wish.url} target="_blank" rel="noreferrer">{wish.name}</a> : wish.name}</h3>
                    <span className="price">{formatEuro(wish.price)}</span>
                  </div>
                  <div className="reorder">
                    <button className="icon" disabled={i === 0} onClick={() => setWishes(move(wishes, i, i - 1))} aria-label="Nach oben">
                      ↑
                    </button>
                    <button className="icon" disabled={i === wishes.length - 1} onClick={() => setWishes(move(wishes, i, i + 1))} aria-label="Nach unten">
                      ↓
                    </button>
                  </div>
                </div>
                <p className="worktime">{formatWorkTime(priceToWorkTime(wish.price, settings))} Arbeit</p>
                <p className={affordableNow ? 'status ok' : affordableFrom ? 'status' : 'status negative'}>
                  {affordableNow
                    ? 'Jetzt leistbar, ohne Schulden'
                    : affordableFrom
                      ? `Leistbar ab ${formatDate(affordableFrom)}`
                      : 'Mit deinem Plan nicht ohne Schulden leistbar'}
                </p>
                {thinking && (
                  <p className="thinking">Bedenkzeit läuft noch bis {formatDate(new Date(wish.thinkUntil!))}. Willst du es dann immer noch?</p>
                )}
                <div className="actions small">
                  <button className="secondary" onClick={() => setWishes(wishes.filter((w) => w.id !== wish.id))}>
                    Brauch ich nicht
                  </button>
                  <button disabled={!affordableNow || Boolean(thinking)} onClick={() => onBought(wish)}>
                    Gekauft
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function move<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

function WishForm({
  settings,
  onAdd,
  shared,
  clearShared,
}: {
  settings: Settings
  onAdd: (w: Wish) => void
  shared: Props['shared']
  clearShared: () => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [priceText, setPriceText] = useState('')
  const [think, setThink] = useState(true)

  useEffect(() => {
    if (shared) {
      setName(shared.name)
      setUrl(shared.url)
      clearShared()
    }
  }, [shared, clearShared])

  const price = parseAmount(priceText)
  const valid = name.trim() && price && price > 0

  const submit = () => {
    if (!valid) return
    const now = new Date()
    onAdd({
      id: newId(),
      name: name.trim(),
      price: price!,
      url: url.trim() || undefined,
      createdAt: todayIso(now),
      thinkUntil: think ? new Date(now.getTime() + THINK_HOURS * 3_600_000).toISOString() : undefined,
    })
    setName('')
    setUrl('')
    setPriceText('')
  }

  return (
    <section className="card">
      <h2>Was wünschst du dir?</h2>
      <input placeholder="z. B. Winterjacke" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="input-suffix">
        <input inputMode="decimal" placeholder="Preis" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
        <em>€</em>
      </div>
      {url && <small className="muted link">Link: {url}</small>}
      {price ? <p className="preview">= {formatWorkTime(priceToWorkTime(price, settings))} Arbeit</p> : null}
      <label className="check">
        <input type="checkbox" checked={think} onChange={(e) => setThink(e.target.checked)} />
        48 Stunden Bedenkzeit
      </label>
      <button disabled={!valid} onClick={submit}>
        Auf die Wunschliste
      </button>
    </section>
  )
}
