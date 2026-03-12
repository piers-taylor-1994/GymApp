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

// ── Tab bar icons ────────────────────────────────────────────────────────────
const Icons = {
  home:      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  history:   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  exercises: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="5" x2="6" y2="19"/><line x1="18" y1="5" x2="18" y2="19"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
  progress:  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  settings:  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
}

const TABS = [
  { id: 'home',      label: 'Home'      },
  { id: 'history',   label: 'History'   },
  { id: 'exercises', label: 'Exercises' },
  { id: 'progress',  label: 'Progress'  },
  { id: 'settings',  label: 'Settings'  },
]

// ── Onboarding ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:56px;height:56px;color:var(--accent);"><line x1="6" y1="5" x2="6" y2="19"/><line x1="18" y1="5" x2="18" y2="19"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
    title: 'Welcome to GymApp',
    body: 'Your personal gym tracker. Log workouts, track progress, and build up a streak!',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:56px;height:56px;color:var(--accent);"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
    title: 'Build Templates',
    body: 'Create workout templates for your regular sessions! Push day, pull day, HIIT; then start them in one tap from the home screen.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:56px;height:56px;color:var(--accent);"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    title: 'Track Your Progress',
    body: 'See your strength gains over time with charts and personal records. Your full workout history is always a tap away.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:56px;height:56px;color:var(--accent);"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    title: '100+ Exercises',
    body: 'Choose from over 100 exercises across all muscle groups, including cardio. You can also browse and filter the full library any time.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:56px;height:56px;color:var(--accent);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    title: '100% Offline',
    body: 'No account needed. GymApp works without an internet connection and all your data stays privately on your device — nothing is ever sent to a server.',
  },
]

function Onboarding() {
  const [step, setStep] = useState(0)
  const [nameInput, setNameInput] = useState('')
  const isLastSlide = step === SLIDES.length - 1
  const isNameStep = step === SLIDES.length

  return (
    <div id="app" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;min-height:100dvh;">

      {!isNameStep ? (
        <div
          key={step}
          style="width:100%;max-width:360px;display:flex;flex-direction:column;align-items:center;animation:fadeUp 0.28s ease both;"
        >
          {/* Icon */}
          <div style="margin-bottom:32px;padding:20px;background:var(--accent-muted);border-radius:50%;">
            {SLIDES[step].icon}
          </div>

          {/* Text */}
          <div style="text-align:center;margin-bottom:36px;">
            <div style="font-size:1.4rem;font-weight:700;margin-bottom:10px;line-height:1.25;">{SLIDES[step].title}</div>
            <div style="font-size:0.933rem;color:var(--text2);line-height:1.65;">{SLIDES[step].body}</div>
          </div>

          {/* Dot indicators */}
          <div style="display:flex;gap:6px;margin-bottom:32px;">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: i === step ? 'var(--accent)' : 'var(--border)',
                  transition: 'width 0.25s ease, background 0.25s ease',
                }}
              />
            ))}
          </div>

          <button class="btn btn-primary btn-full" onClick={() => setStep(s => s + 1)}>
            {isLastSlide ? "Let's get started" : 'Next'}
          </button>
        </div>

      ) : (
        <div
          key="name"
          style="width:100%;max-width:360px;display:flex;flex-direction:column;align-items:center;gap:20px;animation:fadeUp 0.28s ease both;"
        >
          <div style="padding:20px;background:var(--accent-muted);border-radius:50%;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:56px;height:56px;color:var(--accent);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div style="text-align:center;">
            <div style="font-size:1.4rem;font-weight:700;margin-bottom:8px;">One last thing</div>
            <div style="font-size:0.933rem;color:var(--text2);">What should we call you?</div>
          </div>
          <input
            type="text"
            placeholder="Your name"
            value={nameInput}
            onInput={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nameInput.trim() && setUserName(nameInput.trim())}
            style="font-size:1rem;text-align:center;width:100%;"
            autoFocus
          />
          <button
            class="btn btn-primary btn-full"
            disabled={!nameInput.trim()}
            onClick={() => setUserName(nameInput.trim())}
          >
            Start training
          </button>
        </div>
      )}

    </div>
  )
}

// ── Main app ─────────────────────────────────────────────────────────────────
export function App() {
  useSeedOnce()
  const tab = useSignal('home')

  const goToWorkout = () => { tab.value = 'workout' }
  const goToTab = (t) => { tab.value = t }
  const showTabBar = tab.value !== 'workout'

  if (!userName.value) return <Onboarding />

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
