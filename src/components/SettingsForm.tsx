import { useState } from 'react'
import type { FixedCost, Settings } from '../lib/types'
import { formatEuro, newId, parseAmount } from '../lib/format'
import { grossBreakdown, monthlyNetIncome, realHourlyWage } from '../lib/calc'
import type { TaxClass } from '../lib/salary'


const TAX_CLASSES: [TaxClass, string][] = [
  [1, 'I – ledig'],
  [2, 'II – alleinerziehend'],
  [3, 'III – verheiratet, mehr verdienend'],
  [4, 'IV – verheiratet, ähnlich verdienend'],
  [5, 'V – verheiratet, weniger verdienend'],
  [6, 'VI – Zweitjob'],
]

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

const COST_SUGGESTIONS = ['Miete', 'Strom', 'Handy', 'Internet', 'Versicherungen', 'Streaming', 'Fitnessstudio', 'Auto / Ticket']

interface Props {
  initial: Settings
  onDone: (s: Settings) => void
  onCancel?: () => void
}

export function SettingsForm({ initial, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0)
  const [s, setS] = useState<Settings>(initial)
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS((prev) => ({ ...prev, [key]: value }))

  const numberField = (key: keyof Settings, label: string, hint?: string, suffix = '€') => (
    <label className="field">
      <span>{label}</span>
      <div className="input-suffix">
        <input
          inputMode="decimal"
          defaultValue={s[key] ? String(s[key]).replace('.', ',') : ''}
          onChange={(e) => set(key, (parseAmount(e.target.value) ?? 0) as never)}
        />
        <em>{suffix}</em>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  )

  const updateCost = (id: string, patch: Partial<FixedCost>) =>
    set('fixedCosts', s.fixedCosts.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const hourly = s.payType === 'hourly'
  const gross = s.amountType === 'gross'
  const amountLabel = `${hourly ? 'Stundenlohn' : 'Gehalt pro Monat'} (${gross ? 'brutto' : 'netto'})`
  const breakdown = gross ? grossBreakdown(s) : null

  const steps = [
    <>
      <h2>Was verdienst du?</h2>
      <p className="muted">Damit rechnet die App Preise in deine Arbeitszeit um.</p>
      <Segmented
        label="Wie wirst du bezahlt?"
        value={s.payType}
        options={[
          ['salary', 'Festgehalt'],
          ['hourly', 'Stundenlohn'],
        ]}
        onChange={(v) => set('payType', v)}
      />
      <Segmented
        label="Dein Betrag ist"
        value={s.amountType}
        options={[
          ['gross', 'Brutto'],
          ['net', 'Netto'],
        ]}
        onChange={(v) => set('amountType', v)}
      />
      {/* key erzwingt ein neues Feld, wenn sich die Bedeutung des Betrags ändert */}
      <div key={`${s.payType}-${s.amountType}`}>{numberField('payAmount', amountLabel, undefined, hourly ? '€/Std.' : '€')}</div>
      {gross && (
        <>
          <label className="field">
            <span>Steuerklasse</span>
            <select value={s.taxClass} onChange={(e) => set('taxClass', Number(e.target.value) as TaxClass)}>
              {TAX_CLASSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={s.churchTax} onChange={(e) => set('churchTax', e.target.checked)} />
            Ich zahle Kirchensteuer
          </label>
          <label className="check">
            <input type="checkbox" checked={s.hasChildren} onChange={(e) => set('hasChildren', e.target.checked)} />
            Ich habe Kinder (günstigere Pflegeversicherung)
          </label>
        </>
      )}
      {numberField('hoursPerWeek', 'Arbeitsstunden pro Woche', undefined, 'Std.')}
      {numberField('workDaysPerWeek', 'Arbeitstage pro Woche', undefined, 'Tage')}
      {numberField('commuteMinutesPerDay', 'Fahrtzeit pro Arbeitstag (hin und zurück)', 'Zählt mit, weil du diese Zeit für die Arbeit opferst.', 'Min.')}
      {breakdown && breakdown.gross > 0 && (
        <div className="breakdown">
          <div>
            <span>Brutto im Monat</span>
            <span>{formatEuro(breakdown.gross)}</span>
          </div>
          <div>
            <span>Sozialabgaben</span>
            <span>− {formatEuro(breakdown.socialSecurity)}</span>
          </div>
          <div>
            <span>Lohnsteuer{breakdown.soli + breakdown.churchTax > 0 ? ', Soli, Kirche' : ''}</span>
            <span>− {formatEuro(breakdown.wageTax + breakdown.soli + breakdown.churchTax)}</span>
          </div>
          <div className="total">
            <span>Geschätztes Netto</span>
            <span>{formatEuro(breakdown.net)}</span>
          </div>
          <small>Schätzung für 2026. Genauer wird es, wenn du unter „Monate“ einträgst, was wirklich ankam.</small>
        </div>
      )}
      {s.incomeHistory.length > 0 && (
        <p className="muted">Die App rechnet mit dem Durchschnitt deiner eingetragenen Monate: {formatEuro(monthlyNetIncome(s))} netto.</p>
      )}
      {monthlyNetIncome(s) > 0 && <p className="highlight">Dein echter Stundenlohn: {formatEuro(realHourlyWage(s))}</p>}
    </>,
    <>
      <h2>Feste Kosten</h2>
      <p className="muted">Alles, was jeden Monat sicher abgeht.</p>
      {s.fixedCosts.map((c) => (
        <div className="cost-row" key={c.id}>
          <input value={c.label} onChange={(e) => updateCost(c.id, { label: e.target.value })} aria-label="Bezeichnung" />
          <input
            inputMode="decimal"
            defaultValue={c.amount ? String(c.amount).replace('.', ',') : ''}
            placeholder="0,00"
            onChange={(e) => updateCost(c.id, { amount: parseAmount(e.target.value) ?? 0 })}
            aria-label={`Betrag ${c.label}`}
          />
          <button className="icon" onClick={() => set('fixedCosts', s.fixedCosts.filter((x) => x.id !== c.id))} aria-label="Entfernen">
            ×
          </button>
        </div>
      ))}
      <div className="chips">
        {COST_SUGGESTIONS.filter((l) => !s.fixedCosts.some((c) => c.label === l)).map((label) => (
          <button key={label} className="chip" onClick={() => set('fixedCosts', [...s.fixedCosts, { id: newId(), label, amount: 0 }])}>
            + {label}
          </button>
        ))}
        <button className="chip" onClick={() => set('fixedCosts', [...s.fixedCosts, { id: newId(), label: 'Sonstiges', amount: 0 }])}>
          + Eigene
        </button>
      </div>
    </>,
    <>
      <h2>Alltag und Puffer</h2>
      {numberField('dailyBudget', 'Budget für Alltag pro Monat', 'Essen, Einkäufe, Freizeit. Kassenbons zählen dagegen.')}
      {numberField('safetyBuffer', 'Sicherheitspuffer pro Monat', 'Bleibt immer übrig, damit du nie ins Minus rutschst.')}
      {numberField('savings', 'Schon gespart', 'Geld, das du für Wünsche ausgeben darfst.')}
    </>,
  ]

  const last = step === steps.length - 1
  return (
    <div className="card onboarding">
      <div className="steps">
        {steps.map((_, i) => (
          <span key={i} className={i <= step ? 'dot active' : 'dot'} />
        ))}
      </div>
      {steps[step]}
      <div className="actions">
        {step > 0 ? (
          <button className="secondary" onClick={() => setStep(step - 1)}>
            Zurück
          </button>
        ) : (
          onCancel && (
            <button className="secondary" onClick={onCancel}>
              Abbrechen
            </button>
          )
        )}
        <button
          disabled={step === 0 && (monthlyNetIncome(s) <= 0 || s.hoursPerWeek <= 0)}
          onClick={() => (last ? onDone(s) : setStep(step + 1))}
        >
          {last ? 'Fertig' : 'Weiter'}
        </button>
      </div>
    </div>
  )
}
