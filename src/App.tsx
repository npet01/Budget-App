import { useCallback, useState } from 'react'
import type { Expense, Settings, Wish } from './lib/types'
import { useStoredState } from './lib/storage'
import { shiftByExpense } from './lib/calc'
import { newId, todayIso } from './lib/format'
import { SettingsForm } from './components/SettingsForm'
import { DEFAULT_SETTINGS, migrateSettings } from './lib/defaults'
import { MonthsView } from './components/MonthsView'
import { WishesView } from './components/WishesView'
import { ExpensesView } from './components/ExpensesView'
import { BackupCard } from './components/BackupCard'
import type { Backup } from './lib/backup'

type Tab = 'wishes' | 'expenses' | 'months' | 'settings'

/** Liest Produkte, die über das Teilen-Menü (Web Share Target) hereinkommen. */
function readSharedProduct(): { name: string; url: string } | null {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('share')) return null
  const text = params.get('text') ?? ''
  const url = params.get('url') || text.match(/https?:\/\/\S+/)?.[0] || ''
  const name = (params.get('title') || text.replace(url, '')).trim()
  window.history.replaceState(null, '', window.location.pathname)
  return { name, url }
}

export default function App() {
  const [storedSettings, setSettings] = useStoredState<Settings | null>('settings', null)
  const settings = storedSettings && migrateSettings(storedSettings)
  const [wishes, setWishes] = useStoredState<Wish[]>('wishes', [])
  const [expenses, setExpenses] = useStoredState<Expense[]>('expenses', [])
  const [tab, setTab] = useState<Tab>('wishes')
  const [toast, setToast] = useState<string | null>(null)
  const [shared, setShared] = useState(readSharedProduct)
  const clearShared = useCallback(() => setShared(null), [])

  const restore = (backup: Backup) => {
    setSettings(backup.settings)
    setWishes(backup.wishes)
    setExpenses(backup.expenses)
    setTab('wishes')
    setToast('Sicherung eingelesen.')
    window.setTimeout(() => setToast(null), 4000)
  }

  if (!settings) {
    return (
      <main>
        <header className="hero">
          <h1>Was kostet mich das wirklich?</h1>
          <p>Sieh Preise in deiner Arbeitszeit und wann du dir etwas leisten kannst, ohne Schulden zu machen.</p>
          <p className="muted">Alle Daten bleiben auf deinem Gerät.</p>
        </header>
        <SettingsForm initial={DEFAULT_SETTINGS} onDone={(s) => setSettings({ ...s, savingsDate: todayIso() })} />
        <BackupCard onRestore={restore} />
      </main>
    )
  }

  const addExpense = (expense: Expense) => {
    const shifts = shiftByExpense(wishes, settings, expenses, expense, new Date())
      .filter((s) => s.days && s.days > 0)
    setExpenses([...expenses, expense])
    if (shifts.length) {
      const first = shifts[0]
      const others = shifts.length - 1
      const more = others === 1 ? ' und einen weiteren Wunsch' : others > 1 ? ` und ${others} weitere Wünsche` : ''
      setToast(`Das verschiebt „${first.wish.name}“${more} um ${first.days} ${first.days === 1 ? 'Tag' : 'Tage'}.`)
    } else {
      setToast('Eingetragen. Deine Wünsche verschieben sich dadurch nicht.')
    }
    window.setTimeout(() => setToast(null), 5000)
  }

  const markBought = (wish: Wish) => {
    setWishes(wishes.filter((w) => w.id !== wish.id))
    setExpenses([
      ...expenses,
      {
        id: newId(),
        date: todayIso(),
        label: wish.name,
        amount: wish.price,
        source: 'manual',
        wish: true,
        fromPot: wish.saved ? Math.min(wish.saved, wish.price) : undefined,
      },
    ])
    setToast(`Viel Spaß mit „${wish.name}“!`)
    window.setTimeout(() => setToast(null), 4000)
  }

  return (
    <main>
      {tab === 'wishes' && (
        <WishesView
          settings={settings}
          wishes={wishes}
          expenses={expenses}
          setWishes={setWishes}
          setDeposits={(deposits) => setSettings({ ...settings, deposits })}
          onBought={markBought}
          shared={shared}
          clearShared={clearShared}
        />
      )}
      {tab === 'expenses' && (
        <ExpensesView
          settings={settings}
          expenses={expenses}
          onAdd={addExpense}
          onRemove={(id) => setExpenses(expenses.filter((e) => e.id !== id))}
        />
      )}
      {tab === 'months' && (
        <MonthsView
          settings={settings}
          expenses={expenses}
          setIncomeHistory={(incomeHistory) => setSettings({ ...settings, incomeHistory })}
        />
      )}
      {tab === 'settings' && (
        <>
          <SettingsForm
            initial={settings}
            onDone={(s) => {
              // Neuer Kontostand eingetragen: ab heute neu hochrechnen
              setSettings(s.savings !== settings.savings ? { ...s, savingsDate: todayIso() } : s)
              setTab('wishes')
            }}
            onCancel={() => setTab('wishes')}
          />
          <BackupCard data={{ settings, wishes, expenses }} onRestore={restore} />
          <DeleteAll
            onConfirm={() => {
              setSettings(null)
              setWishes([])
              setExpenses([])
            }}
          />
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      <nav className="tabs">
        <button className={tab === 'wishes' ? 'active' : ''} onClick={() => setTab('wishes')}>
          Wünsche
        </button>
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>
          Ausgaben
        </button>
        <button className={tab === 'months' ? 'active' : ''} onClick={() => setTab('months')}>
          Monate
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          Einstellungen
        </button>
      </nav>
    </main>
  )
}

/** Zweistufiges Löschen direkt auf der Seite statt eines Browser-Dialogs. */
function DeleteAll({ onConfirm }: { onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button className="danger full" onClick={() => setAsking(true)}>
        Alle Daten löschen
      </button>
    )
  }
  return (
    <div className="card">
      <p>Gehalt, Wünsche und Ausgaben werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.</p>
      <div className="actions">
        <button className="secondary" onClick={() => setAsking(false)}>
          Behalten
        </button>
        <button className="danger" onClick={onConfirm}>
          Endgültig löschen
        </button>
      </div>
    </div>
  )
}
