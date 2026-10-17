import { useState } from 'react'
import type { FixedCost, Settings } from '../lib/types'
import { formatEuro, newId, parseAmount } from '../lib/format'
import { realHourlyWage } from '../lib/calc'


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

  const steps = [
    <>
      <h2>Was verdienst du?</h2>
      <p className="muted">Damit rechnet die App Preise in deine Arbeitszeit um.</p>
      {numberField('netIncome', 'Nettogehalt pro Monat', 'Was wirklich auf deinem Konto ankommt.')}
      {numberField('hoursPerWeek', 'Arbeitsstunden pro Woche', undefined, 'Std.')}
      {numberField('workDaysPerWeek', 'Arbeitstage pro Woche', undefined, 'Tage')}
      {numberField('commuteMinutesPerDay', 'Fahrtzeit pro Arbeitstag (hin und zurück)', 'Zählt mit, weil du diese Zeit für die Arbeit opferst.', 'Min.')}
      {s.netIncome > 0 && (
        <p className="highlight">Dein echter Stundenlohn: {formatEuro(realHourlyWage(s))}</p>
      )}
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
          disabled={step === 0 && (s.netIncome <= 0 || s.hoursPerWeek <= 0)}
          onClick={() => (last ? onDone(s) : setStep(step + 1))}
        >
          {last ? 'Fertig' : 'Weiter'}
        </button>
      </div>
    </div>
  )
}
