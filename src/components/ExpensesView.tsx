import { useRef, useState } from 'react'
import type { Expense, Settings } from '../lib/types'
import { monthAllowance, priceToWorkTime, spentThisMonth } from '../lib/calc'
import { formatEuro, formatWorkTime, newId, parseAmount, todayIso } from '../lib/format'
import { findReceiptTotal, guessShop, recognizeReceipt } from '../lib/receipt'

interface Props {
  settings: Settings
  expenses: Expense[]
  onAdd: (e: Expense) => void
  onRemove: (id: string) => void
}

export function ExpensesView({ settings, expenses, onAdd, onRemove }: Props) {
  const today = new Date()
  const spent = spentThisMonth(expenses, today)
  const monthKey = todayIso(today).slice(0, 7)
  const budget = monthAllowance(settings, monthKey)
  const left = budget - spent
  const thisMonth = expenses.filter((e) => e.date.startsWith(monthKey)).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <section className="card summary">
        <div>
          <small>Alltagsbudget</small>
          <strong>{formatEuro(budget)}</strong>
        </div>
        <div>
          <small>Ausgegeben</small>
          <strong>{formatEuro(spent)}</strong>
        </div>
        <div>
          <small>Noch übrig</small>
          <strong className={left < 0 ? 'negative' : ''}>{formatEuro(left)}</strong>
        </div>
      </section>
      <div className="bar" aria-hidden>
        <span style={{ width: `${Math.min(100, (spent / Math.max(1, budget)) * 100)}%` }} className={left < 0 ? 'over' : ''} />
      </div>

      <ExpenseForm settings={settings} onAdd={onAdd} />

      <h2 className="section-title">Diesen Monat</h2>
      {thisMonth.length === 0 ? (
        <p className="empty">Noch keine Ausgaben in diesem Monat.</p>
      ) : (
        <ul className="expenses">
          {thisMonth.map((e) => (
            <li key={e.id}>
              <div>
                <strong>{e.label}</strong>
                <small>
                  {new Date(e.date).toLocaleDateString('de-DE')} · {formatWorkTime(priceToWorkTime(e.amount, settings))}
                  {e.source === 'receipt' && ' · Bon'}
                  {e.warranty && ' · Garantiebeleg'}
                </small>
              </div>
              <span>{formatEuro(e.amount)}</span>
              <button className="icon" onClick={() => onRemove(e.id)} aria-label="Löschen">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function ExpenseForm({ settings, onAdd }: { settings: Settings; onAdd: (e: Expense) => void }) {
  const [label, setLabel] = useState('')
  const [amountText, setAmountText] = useState('')
  const [source, setSource] = useState<Expense['source']>('manual')
  const [warranty, setWarranty] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const amount = parseAmount(amountText)

  const scan = async (file: File) => {
    setScanning(true)
    setScanError(null)
    try {
      const text = await recognizeReceipt(file)
      const total = findReceiptTotal(text)
      setLabel(guessShop(text))
      setSource('receipt')
      if (total) setAmountText(total.toFixed(2).replace('.', ','))
      else setScanError('Summe nicht gefunden. Bitte Betrag eintippen.')
    } catch {
      setScanError('Bon konnte nicht gelesen werden. Bitte Betrag eintippen.')
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = () => {
    if (!amount || amount <= 0) return
    onAdd({
      id: newId(),
      date: todayIso(),
      label: label.trim() || 'Einkauf',
      amount,
      source,
      warranty: warranty || undefined,
    })
    setLabel('')
    setAmountText('')
    setSource('manual')
    setWarranty(false)
  }

  return (
    <section className="card">
      <h2>Ausgabe eintragen</h2>
      <button className="secondary full" disabled={scanning} onClick={() => fileRef.current?.click()}>
        {scanning ? 'Bon wird gelesen …' : '📷 Kassenbon fotografieren'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
      />
      {scanError && <p className="warning">{scanError}</p>}
      {source === 'receipt' && !scanError && <p className="muted">Erkannt. Bitte Betrag kurz prüfen.</p>}
      <input placeholder="Wofür? (z. B. Supermarkt)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="input-suffix">
        <input inputMode="decimal" placeholder="Betrag" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
        <em>€</em>
      </div>
      {amount ? <p className="preview">= {formatWorkTime(priceToWorkTime(amount, settings))} Arbeit</p> : null}
      <label className="check">
        <input type="checkbox" checked={warranty} onChange={(e) => setWarranty(e.target.checked)} />
        Als Garantiebeleg merken
      </label>
      <button disabled={!amount || amount <= 0} onClick={submit}>
        Eintragen
      </button>
    </section>
  )
}
