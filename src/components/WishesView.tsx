import { useEffect, useState } from 'react'
import type { Deposit, Expense, Settings, Wish } from '../lib/types'
import { availableToday, currentMonth, monthAllowance, monthKey, spentThisMonth, surplusPerDay, extraPerDayForTarget, monthlySurplus, parseIsoDate, planWishes, realHourlyWage, type WishPlan } from '../lib/calc'
import { formatDate, formatEuro, newId, parseAmount, todayIso } from '../lib/format'

interface Props {
  settings: Settings
  wishes: Wish[]
  expenses: Expense[]
  setWishes: (w: Wish[]) => void
  setDeposits: (d: Deposit[]) => void
  onBought: (wish: Wish) => void
  shared: { name: string; url: string } | null
  clearShared: () => void
}

const THINK_HOURS = 48
const EXTRA_OPTIONS = [1, 2, 5, 10]
const POT_STEPS = [5, 10, 20, 50]

export function WishesView({ settings, wishes, expenses, setWishes, setDeposits, onBought, shared, clearShared }: Props) {
  const today = new Date()
  const plans = planWishes(wishes, settings, expenses, today)
  const surplus = monthlySurplus(settings)
  const month = currentMonth(settings, expenses, today)
  const budget = monthAllowance(settings, monthKey(today))
  const budgetLeft = budget - spentThisMonth(expenses, today)
  const perDay = surplusPerDay(settings)
  const [open, setOpen] = useState<string | null>(null)
  const update = (id: string, patch: Partial<Wish>) => setWishes(wishes.map((w) => (w.id === id ? { ...w, ...patch } : w)))

  return (
    <>
      <section className="card">
        <h2>Diesen Monat</h2>
        <div className="breakdown">
          <div>
            <span>Netto{month.incomeIsActual ? '' : ' (erwartet)'}</span>
            <span>{formatEuro(month.income)}</span>
          </div>
          {month.extra > 0 && (
            <div>
              <span>Extra bekommen</span>
              <span>+ {formatEuro(month.extra)}</span>
            </div>
          )}
          <div>
            <span>Feste Ausgaben</span>
            <span>− {formatEuro(month.fixedCosts)}</span>
          </div>
          <div>
            <span>Sonstige Ausgaben bisher</span>
            <span>− {formatEuro(month.spent)}</span>
          </div>
          <div className="total">
            <span>Restgeld diesen Monat</span>
            <span className={month.left < 0 ? 'negative' : ''}>{formatEuro(month.left)}</span>
          </div>
        </div>
        <p className="muted">
          Davon noch im Alltagsbudget:{' '}
          <strong className={budgetLeft < 0 ? 'negative' : ''}>
            {formatEuro(budgetLeft)} von {formatEuro(budget)}
          </strong>
        </p>
      </section>

      <section className="card summary">
        <div>
          <small>Dein echter Stundenlohn</small>
          <strong>{formatEuro(realHourlyWage(settings))}</strong>
        </div>
        <div>
          <small>Heute für Wünsche frei</small>
          <strong>{formatEuro(Math.max(0, availableToday(settings, expenses, today)))}</strong>
          {perDay > 0 && <small className="grow">+ {formatEuro(perDay)} pro Tag</small>}
        </div>
        <div>
          <small>Pro Monat dazu</small>
          <strong className={surplus <= 0 ? 'negative' : ''}>{formatEuro(surplus)}</strong>
        </div>
      </section>

      <AddMoney settings={settings} setDeposits={setDeposits} />

      {surplus <= 0 && (
        <p className="warning">
          Nach Fixkosten, Alltagsbudget und Puffer bleibt nichts übrig. Wünsche gehen nur mit extra Zurücklegen oder mit Schulden.
        </p>
      )}

      <WishForm
        queued={wishes.length > 0}
        daysFor={(price) => {
          const all = planWishes([...wishes, { id: 'neu', name: '', price, createdAt: todayIso() }], settings, expenses, today)
          return all[all.length - 1].daysLeft
        }}
        shared={shared} clearShared={clearShared} onAdd={(w) => setWishes([...wishes, w])} />

      {plans.length === 0 ? (
        <p className="empty">
          Noch keine Wünsche. Trag oben etwas ein oder teile ein Produkt aus einer Shop-App mit dieser App.
        </p>
      ) : (
        <ul className="wishes">
          {plans.map((plan, i) => {
            const { wish, affordableFrom, affordableNow, daysLeft } = plan
            const thinking = wish.thinkUntil && new Date(wish.thinkUntil) > today
            const saved = wish.saved ?? 0
            const target = wish.targetDate ? parseIsoDate(wish.targetDate) : null
            const needed = target ? extraPerDayForTarget(plan, settings, today, target) : null
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
                <p className={affordableNow ? 'worktime ok' : affordableFrom ? 'worktime' : 'worktime negative'}>{daysText(daysLeft)}</p>
                {affordableFrom && !affordableNow && <p className="status">bis zum Kauf, also am {formatDate(affordableFrom)}</p>}
                {!affordableFrom && <p className="status">Dein Plan reicht dafür nicht. Leg extra Geld zurück oder trag Geld ein, das dazukommt.</p>}
                {saved > 0 && (
                  <div className="pot">
                    <div className="bar" aria-hidden>
                      <span style={{ width: `${Math.min(100, (saved / wish.price) * 100)}%` }} />
                    </div>
                    <small>
                      {formatEuro(saved)} von {formatEuro(wish.price)} zurückgelegt
                    </small>
                  </div>
                )}
                {target && !affordableNow && (
                  <p className="faster">{targetText(target, needed)}</p>
                )}
                {thinking && (
                  <p className="thinking">Bedenkzeit läuft noch bis {formatDate(new Date(wish.thinkUntil!))}. Willst du es dann immer noch?</p>
                )}
                {open === wish.id && (
                  <SavePanel
                    wish={wish}
                    plan={plan}
                    settings={settings}
                    expenses={expenses}
                    wishes={wishes}
                    index={i}
                    onChange={(patch) => update(wish.id, patch)}
                  />
                )}
                <div className="actions small">
                  <button className="secondary" onClick={() => setOpen(open === wish.id ? null : wish.id)} aria-expanded={open === wish.id}>
                    {open === wish.id ? 'Fertig' : 'Sparen'}
                  </button>
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

function daysText(days: number | null): string {
  if (days === null) return 'Ohne Schulden nicht drin'
  if (days === 0) return 'Jetzt leistbar, ohne Schulden'
  return days === 1 ? 'Noch 1 Tag' : `Noch ${days} Tage`
}

function AddMoney({ settings, setDeposits }: { settings: Settings; setDeposits: (d: Deposit[]) => void }) {
  const [open, setOpen] = useState(false)
  const [amountText, setAmountText] = useState('')
  const [label, setLabel] = useState('')
  const amount = parseAmount(amountText)
  const recent = settings.deposits.filter((d) => d.date >= settings.savingsDate).slice(-5).reverse()

  if (!open) {
    return (
      <button className="secondary" onClick={() => setOpen(true)}>
        + Geld hinzufügen
      </button>
    )
  }
  return (
    <section className="card">
      <h2>Geld dazubekommen?</h2>
      <p className="muted">Zum Beispiel zum Geburtstag, Rückzahlungen oder ein Nebenjob. Es zählt sofort für deine Wünsche.</p>
      <div className="input-suffix">
        <input inputMode="decimal" placeholder="Betrag" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
        <em>€</em>
      </div>
      <input placeholder="Wofür? z. B. Geburtstag" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="actions">
        <button className="secondary" onClick={() => setOpen(false)}>
          Schließen
        </button>
        <button
          disabled={!amount || amount <= 0}
          onClick={() => {
            setDeposits([...settings.deposits, { id: newId(), date: todayIso(), label: label.trim() || 'Extra', amount: amount! }])
            setAmountText('')
            setLabel('')
          }}
        >
          Hinzufügen
        </button>
      </div>
      {recent.length > 0 && (
        <ul className="deposits">
          {recent.map((d) => (
            <li key={d.id}>
              <span>
                {d.label} · {formatDate(parseIsoDate(d.date))}
              </span>
              <span>+ {formatEuro(d.amount)}</span>
              <button className="icon" onClick={() => setDeposits(settings.deposits.filter((x) => x.id !== d.id))} aria-label={`${d.label} löschen`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function targetText(target: Date, needed: number | null): string {
  const date = formatDate(target)
  if (needed === null) return `Dein Wunschdatum ${date} ist schon vorbei.`
  if (needed === 0) return `Bis ${date} klappt es mit deinem Plan.`
  return `Für ${date} musst du ab heute ${formatEuro(needed)} pro Tag extra zurücklegen.`
}

function SavePanel({
  wish,
  plan,
  settings,
  expenses,
  wishes,
  index,
  onChange,
}: {
  wish: Wish
  plan: WishPlan
  settings: Settings
  expenses: Expense[]
  wishes: Wish[]
  index: number
  onChange: (patch: Partial<Wish>) => void
}) {
  const saved = wish.saved ?? 0
  const [extra, setExtra] = useState(0)
  const faster = extra > 0 && !plan.affordableNow ? planWishes(wishes, settings, expenses, new Date(), extra)[index].daysLeft : null
  const fewer = faster !== null && plan.daysLeft !== null ? plan.daysLeft - faster : null
  const setSaved = (n: number) => onChange({ saved: Math.max(0, Math.round(n * 100) / 100) || undefined })

  return (
    <div className="save-panel">
      <label className="field">
        <span>Schon extra für „{wish.name}“ zurückgelegt</span>
        <div className="input-suffix">
          {/* key setzt das Feld zurück, wenn die Schnelltasten den Betrag ändern */}
          <input
            key={saved}
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={saved ? String(saved).replace('.', ',') : ''}
            onBlur={(e) => setSaved(parseAmount(e.target.value) ?? 0)}
          />
          <em>€</em>
        </div>
      </label>
      <div className="chips">
        {POT_STEPS.map((n) => (
          <button key={n} className="chip" onClick={() => setSaved(saved + n)}>
            + {formatEuro(n)}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Bis wann möchtest du es haben?</span>
        <input
          type="date"
          value={wish.targetDate ?? ''}
          min={todayIso()}
          onChange={(e) => onChange({ targetDate: e.target.value || undefined })}
        />
      </label>

      {!plan.affordableNow && (
        <div className="field">
          <span>Was wäre, wenn du extra zurücklegst?</span>
          <div className="chips">
            {EXTRA_OPTIONS.map((n) => (
              <button key={n} className={extra === n ? 'chip on' : 'chip'} aria-pressed={extra === n} onClick={() => setExtra(extra === n ? 0 : n)}>
                {formatEuro(n)} / Tag
              </button>
            ))}
          </div>
          {faster !== null && (
            <small className="faster">
              Dann noch {faster === 1 ? '1 Tag' : `${faster} Tage`}
              {fewer ? `, also ${fewer === 1 ? '1 Tag' : `${fewer} Tage`} weniger` : ''}
            </small>
          )}
        </div>
      )}
    </div>
  )
}

function previewText(days: number | null, queued: boolean): string {
  if (days === null) return 'Mit deinem Plan ohne Schulden nicht drin'
  if (days === 0) return 'Sofort leistbar'
  // Neue Wünsche kommen ans Ende der Liste, also nach allen anderen dran
  return `Noch ${days === 1 ? '1 Tag' : `${days} Tage`} bis zum Kauf${queued ? ', nach deinen anderen Wünschen' : ''}`
}

function move<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

function WishForm({
  queued,
  daysFor,
  onAdd,
  shared,
  clearShared,
}: {
  queued: boolean
  daysFor: (price: number) => number | null
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
      {price ? <p className="preview">{previewText(daysFor(price), queued)}</p> : null}
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
