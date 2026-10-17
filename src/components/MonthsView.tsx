import { useState } from 'react'
import type { Expense, IncomeMonth, Settings } from '../lib/types'
import { incomeSource, monthKey, monthOverview, monthlyNetIncome, realHourlyWage, recentIncome } from '../lib/calc'
import { formatEuro, formatHours, parseAmount } from '../lib/format'

interface Props {
  settings: Settings
  expenses: Expense[]
  setIncomeHistory: (history: IncomeMonth[]) => void
}

const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
const formatMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return monthName.format(new Date(y, m - 1, 1))
}

/** Der Vormonat ist meist der letzte, für den es eine Abrechnung gibt. */
function previousMonth(today: Date, back = 1): string {
  return monthKey(new Date(today.getFullYear(), today.getMonth() - back, 1))
}

const SOURCE_TEXT = {
  history: 'Durchschnitt deiner letzten eingetragenen Monate',
  net: 'Dein eingegebenes Netto',
  estimate: 'Geschätzt aus deinem Brutto',
}

export function MonthsView({ settings, expenses, setIncomeHistory }: Props) {
  const today = new Date()
  const overview = monthOverview(settings, expenses, today)
  const recent = recentIncome(settings)
  const missing = [1, 2, 3].map((n) => previousMonth(today, n)).find((m) => !settings.incomeHistory.some((h) => h.month === m))

  const save = (entry: IncomeMonth) =>
    setIncomeHistory([...settings.incomeHistory.filter((h) => h.month !== entry.month), entry])

  return (
    <>
      <section className="card summary">
        <div>
          <small>Netto pro Monat</small>
          <strong>{formatEuro(monthlyNetIncome(settings))}</strong>
        </div>
        <div>
          <small>Echter Stundenlohn</small>
          <strong>{formatEuro(realHourlyWage(settings))}</strong>
        </div>
        <div>
          <small>Eingetragen</small>
          <strong>{recent.length} von 3</strong>
        </div>
      </section>
      <p className="muted">Gerechnet wird mit: {SOURCE_TEXT[incomeSource(settings)]}.</p>

      <IncomeForm
        key={missing ?? 'none'}
        initialMonth={missing ?? previousMonth(today)}
        maxMonth={monthKey(today)}
        askHours={settings.payType === 'hourly'}
        onSave={save}
      />

      <h2 className="section-title">Deine Monate</h2>
      <ul className="months">
        {overview.map((m) => {
          const used = m.income + m.extra > 0 ? Math.min(100, ((m.fixedCosts + m.spent) / (m.income + m.extra)) * 100) : 100
          return (
            <li key={m.month} className="card month">
              <div className="month-head">
                <h3>{formatMonth(m.month)}</h3>
                {m.incomeIsActual ? (
                  <button
                    className="icon"
                    onClick={() => setIncomeHistory(settings.incomeHistory.filter((h) => h.month !== m.month))}
                    aria-label={`Einkommen ${formatMonth(m.month)} löschen`}
                  >
                    ×
                  </button>
                ) : (
                  <span className="tag">erwartet</span>
                )}
              </div>
              <div className="breakdown">
                <div>
                  <span>Netto{m.hours ? ` · ${formatHours(m.hours)} gearbeitet` : ''}</span>
                  <span>{formatEuro(m.income)}</span>
                </div>
                {m.extra > 0 && (
                  <div>
                    <span>Extra bekommen</span>
                    <span>+ {formatEuro(m.extra)}</span>
                  </div>
                )}
                <div>
                  <span>Fixkosten</span>
                  <span>− {formatEuro(m.fixedCosts)}</span>
                </div>
                <div>
                  <span>Eingetragene Ausgaben</span>
                  <span>− {formatEuro(m.spent)}</span>
                </div>
                <div className="total">
                  <span>Übrig</span>
                  <span className={m.left < 0 ? 'negative' : ''}>{formatEuro(m.left)}</span>
                </div>
              </div>
              <div className="bar" aria-hidden>
                <span style={{ width: `${used}%` }} className={m.left < 0 ? 'over' : ''} />
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function IncomeForm({
  initialMonth,
  maxMonth,
  askHours,
  onSave,
}: {
  initialMonth: string
  maxMonth: string
  askHours: boolean
  onSave: (entry: IncomeMonth) => void
}) {
  const [month, setMonth] = useState(initialMonth)
  const [netText, setNetText] = useState('')
  const [hoursText, setHoursText] = useState('')
  const net = parseAmount(netText)
  const hours = parseAmount(hoursText)

  return (
    <section className="card">
      <h2>Was kam wirklich an?</h2>
      <p className="muted">
        Trag aus deinen Lohnabrechnungen das Netto der letzten Monate ein. Die App rechnet dann mit dem Durchschnitt der letzten 3.
      </p>
      <label className="field">
        <span>Monat</span>
        <input type="month" value={month} max={maxMonth} onChange={(e) => setMonth(e.target.value)} />
      </label>
      <div className="input-suffix">
        <input inputMode="decimal" placeholder="Netto ausgezahlt" value={netText} onChange={(e) => setNetText(e.target.value)} />
        <em>€</em>
      </div>
      <div className="input-suffix">
        <input
          inputMode="decimal"
          placeholder={askHours ? 'Gearbeitete Stunden' : 'Gearbeitete Stunden (optional)'}
          value={hoursText}
          onChange={(e) => setHoursText(e.target.value)}
        />
        <em>Std.</em>
      </div>
      <button
        disabled={!month || !net || net <= 0}
        onClick={() => {
          onSave({ month, net: net!, hours: hours && hours > 0 ? hours : undefined })
          setNetText('')
          setHoursText('')
        }}
      >
        Monat speichern
      </button>
    </section>
  )
}
