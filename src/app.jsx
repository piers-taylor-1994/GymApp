import { useSignal } from '@preact/signals'
import { activeWorkout, userName, setUserName } from './store/store.js'
import { useSeedOnce } from './db/seed.js'
import { useState } from 'preact/hooks'
import { Dashboard } from './screens/Dashboard.jsx'
import { ActiveWorkout } from './screens/ActiveWorkout.jsx'
import { ExerciseLibrary } from './screens/ExerciseLibrary.jsx'
import { History } from './screens/History.jsx'
import { Progress } from './screens/Progress.jsx'
import { Templates } from './screens/Templates.jsx'
import { Settings } from './screens/Settings.jsx'

// Tab bar SVG icons
const Icons = {
  home: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  history: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  exercises: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="5" x2="6" y2="19"/><line x1="18" y1="5" x2="18" y2="19"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
  progress: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  settings: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
}

const TABS = [
  { id: 'home',      label: 'Home'      },
  { id: 'history',   label: 'History'   },
  { id: 'exercises', label: 'Exercises' },
  { id: 'progress',  label: 'Progress'  },
  { id: 'settings',  label: 'Settings'  },
]

export function App() {
  useSeedOnce()
  const tab = useSignal('home')
  const [nameInput, setNameInput] = useState('')

  const goToWorkout = () => { tab.value = 'workout' }
  const goToTab = (t) => { tab.value = t }

  const showTabBar = tab.value !== 'workout'

  // Show name prompt on first launch
  if (!userName.value) {
    return (
      <div id="app" style="display:flex;align-items:center;justify-content:center;padding:32px;">
        <div class="card" style="width:100%;max-width:340px;padding:32px 24px;display:flex;flex-direction:column;gap:20px;animation:popIn 0.25s ease both;">
          <div>
            <div style="font-size:1.467rem;font-weight:700;margin-bottom:6px;">Welcome to GymApp</div>
            <div style="font-size:0.933rem;color:var(--text2);">What should we call you?</div>
          </div>
          <input
            type="text"
            placeholder="Your name"
            value={nameInput}
            onInput={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nameInput.trim() && setUserName(nameInput.trim())}
            style="font-size:1rem;"
            autoFocus
          />
          <button
            class="btn btn-primary btn-full"
            disabled={!nameInput.trim()}
            onClick={() => setUserName(nameInput.trim())}
          >
            Let's go
          </button>
        </div>
      </div>
    )
  }

  return (
    <div id="app">
      {tab.value === 'home'      && <Dashboard onStartWorkout={goToWorkout} onNavigate={goToTab} />}
      {tab.value === 'workout'   && <ActiveWorkout onFinish={() => goToTab('history')} onDiscard={() => goToTab('home')} />}
      {tab.value === 'history'   && <History />}
      {tab.value === 'exercises' && <ExerciseLibrary />}
      {tab.value === 'progress'  && <Progress />}
      {tab.value === 'templates' && <Templates onStartWorkout={goToWorkout} />}
      {tab.value === 'settings'  && <Settings />}

      {showTabBar && (
        <nav class="tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              class={`tab-btn${tab.value === t.id ? ' active' : ''}`}
              onClick={() => goToTab(t.id)}
            >
              {Icons[t.id]}
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
