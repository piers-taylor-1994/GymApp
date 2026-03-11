import { useState, useEffect, useRef } from 'preact/hooks'
import { activeWorkout, completeExercise, skipToExercise, updateExerciseSets, updateExerciseDuration, finishWorkout, discardWorkout, addExerciseToWorkout, removeExerciseFromWorkout, restTimerDefault } from '../store/store.js'
import db from '../db/db.js'

const TICK_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const DOTS_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
  </svg>
)
const PLUS_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

function formatElapsed(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function formatCountdown(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2,'0')}`
}

// ── Individual set row ──────────────────────────────────────────────────────
function SetRow({ set, setIndex, totalSets, onChange, onRemove }) {
  const kgInvalid   = set.touched && (!set.kg   || parseFloat(set.kg)   <= 0)
  const repsInvalid = set.touched && (!set.reps || parseInt(set.reps)   <= 0)

  return (
    <tr>
      <td class="set-num">{setIndex + 1}</td>
      <td style="font-size:0.8rem;color:var(--text2);">{set.prev || '—'}</td>
      <td>
        <input
          type="number"
          value={set.kg}
          placeholder="0"
          min="0"
          max="999"
          step="0.5"
          style={kgInvalid ? 'border-color:#f87171;' : ''}
          onInput={e => {
            const raw = e.target.value
            const clamped = raw === '' ? '' : Math.min(999, Math.max(0, parseFloat(raw) || 0))
            onChange({ ...set, kg: clamped === '' ? '' : String(clamped), touched: false })
          }}
        />
      </td>
      <td>
        <input
          type="number"
          value={set.reps}
          placeholder="0"
          min="1"
          max="999"
          step="1"
          style={repsInvalid ? 'border-color:#f87171;' : ''}
          onInput={e => {
            const raw = e.target.value
            const clamped = raw === '' ? '' : Math.min(999, Math.max(1, parseInt(raw) || 1))
            onChange({ ...set, reps: clamped === '' ? '' : String(clamped), touched: false })
          }}
        />
      </td>
      <td>
        {totalSets > 1 ? (
          <button
            class="set-done-btn"
            style="color:#f87171;"
            onClick={onRemove}
            title="Remove set"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        ) : (
          <div style="width:32px;height:32px;" />
        )}
      </td>
    </tr>
  )
}

// ── Completed exercise accordion ────────────────────────────────────────────
function CompletedCard({ ex, idx }) {
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState(() => ex.duration || { mins: '', secs: '' })

  // Keep local duration in sync if the exercise object changes externally
  useEffect(() => {
    setDuration(ex.duration || { mins: '', secs: '' })
  }, [ex.duration])

  let meta
  if (ex.type === 'cardio') {
    const mins = parseInt(ex.duration?.mins) || 0
    const secs = parseInt(ex.duration?.secs) || 0
    const total = mins * 60 + secs
    meta = total > 0
      ? `${mins > 0 ? mins + 'm ' : ''}${secs > 0 ? secs + 's' : ''}`.trim() + ' · ' + ex.muscle
      : ex.muscle
  } else {
    const vol = ex.completedVolume ? Math.round(ex.completedVolume).toLocaleString() + ' kg' : ''
    meta = `${ex.completedSets} sets${vol ? ' · ' + vol : ''} · ${ex.muscle}`
  }

  function handleDurationSave() {
    const mins = Math.max(0, parseInt(duration.mins) || 0)
    const secs = Math.min(59, Math.max(0, parseInt(duration.secs) || 0))
    const saved = { mins: String(mins), secs: String(secs) }
    setDuration(saved)
    updateExerciseDuration(idx, saved)
    setOpen(false)
  }

  return (
    <div class="completed-card" onClick={() => !open && setOpen(true)}>
      <div class="completed-card-header">
        <div class="completed-tick">{TICK_SVG}</div>
        <div class="completed-info">
          <div class="completed-name">{ex.name}</div>
          <div class="completed-meta">{meta}</div>
        </div>
        <div class={`completed-chevron${open ? ' open' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
      {ex.type === 'cardio' ? (
        <div class={`completed-detail${open ? ' open' : ''}`} onClick={e => e.stopPropagation()}>
          <div style="display:flex;gap:12px;align-items:flex-end;margin-top:10px;">
            <div style="flex:1;">
              <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;">Minutes</div>
              <input
                type="number"
                min="0"
                max="999"
                step="1"
                placeholder="0"
                value={duration.mins}
                style="text-align:center;font-size:1.1rem;font-weight:700;"
                onInput={e => {
                  const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0)
                  setDuration(d => ({ ...d, mins: val === '' ? '' : String(val) }))
                }}
              />
            </div>
            <div style="font-size:1.4rem;font-weight:700;color:var(--text2);padding-bottom:8px;">:</div>
            <div style="flex:1;">
              <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;">Seconds</div>
              <input
                type="number"
                min="0"
                max="59"
                step="1"
                placeholder="00"
                value={duration.secs}
                style="text-align:center;font-size:1.1rem;font-weight:700;"
                onInput={e => {
                  const val = e.target.value === '' ? '' : Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                  setDuration(d => ({ ...d, secs: val === '' ? '' : String(val) }))
                }}
              />
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn btn-sm btn-ghost" style="flex:1;" onClick={() => { setDuration(ex.duration || { mins: '', secs: '' }); setOpen(false) }}>Cancel</button>
            <button class="btn btn-sm btn-primary" style="flex:1;" onClick={handleDurationSave}>Save</button>
          </div>
        </div>
      ) : (
        <div class={`completed-detail${open ? ' open' : ''}`}>
          <table class="set-table" style="margin-top:4px;">
            <thead>
              <tr>
                <th style="width:32px;">Set</th>
                <th>Prev</th>
                <th style="text-align:center;">kg</th>
                <th style="text-align:center;">Reps</th>
                <th style="width:40px;"></th>
              </tr>
            </thead>
            <tbody>
              {ex.sets.map((s, i) => (
                <tr key={i}>
                  <td class="set-num">{i + 1}</td>
                  <td style="font-size:0.8rem;color:var(--text2);">{s.prev || '—'}</td>
                  <td style="text-align:center;font-size:0.933rem;font-weight:600;">{s.kg || '—'}</td>
                  <td style="text-align:center;font-size:0.933rem;font-weight:600;">{s.reps || '—'}</td>
                  <td><div class="set-done-btn done" style="pointer-events:none;">{TICK_SVG}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Active exercise card ────────────────────────────────────────────────────
function ActiveCard({ ex, idx, onComplete, onAddSet, onRemove }) {
  const [sets, setSets] = useState(() => ex.sets.map(s => ({ ...s })))
  const [menuOpen, setMenuOpen] = useState(false)
  const cardRef = useRef(null)
  const menuRef = useRef(null)

  // Keep sets in sync if the exercise changes (e.g. after skip)
  useEffect(() => {
    setSets(ex.sets.map(s => ({ ...s })))
  }, [ex])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [menuOpen])

  function updateSet(i, updated) {
    const next = [...sets]
    next[i] = updated
    setSets(next)
    updateExerciseSets(idx, next)
  }

  function removeSet(i) {
    const next = sets.filter((_, j) => j !== i)
    setSets(next)
    updateExerciseSets(idx, next)
  }

  function addSet() {
    const last = sets[sets.length - 1]
    const next = [...sets, { kg: last?.kg || '', reps: '', done: false, prev: '—' }]
    setSets(next)
    updateExerciseSets(idx, next)
  }

  return (
    <div class="card" ref={cardRef} style="animation:fadeUp 0.2s ease both;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class={`muscle-dot ${ex.muscleClass}`} style="width:10px;height:10px;"></div>
          <div>
            <div style="font-weight:700;font-size:1rem;">{ex.name}</div>
            <div style="font-size:0.8rem;color:var(--text2);">{ex.muscle} · {ex.equipment}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          {ex.pr && <span class="badge badge-green">PR pace</span>}
          <div style="position:relative;" ref={menuRef}>
            <button
              class="icon-btn"
              style="width:30px;height:30px;"
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
            >
              {DOTS_SVG}
            </button>
            {menuOpen && (
              <div style="position:absolute;right:0;top:36px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:200;min-width:160px;overflow:hidden;">
                <button
                  style="width:100%;padding:12px 16px;text-align:left;font-size:0.867rem;color:#f87171;background:none;border:none;cursor:pointer;display:block;"
                  onClick={() => { setMenuOpen(false); onRemove() }}
                >
                  Remove Exercise
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <table class="set-table">
        <thead>
          <tr>
            <th style="width:32px;">Set</th>
            <th>Prev</th>
            <th>kg</th>
            <th>Reps</th>
            <th style="width:40px;"></th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s, i) => (
            <SetRow
              key={i}
              set={s}
              setIndex={i}
              totalSets={sets.length}
              onChange={updated => updateSet(i, updated)}
              onRemove={() => removeSet(i)}
            />
          ))}
        </tbody>
      </table>

      <button class="btn btn-ghost btn-sm btn-full" style="margin-top:10px;" onClick={addSet}>
        {PLUS_SVG} Add Set
      </button>
      <button class="btn btn-primary btn-full" style="margin-top:8px;" onClick={() => onComplete(sets)}>
        {TICK_SVG} Complete Exercise
      </button>
    </div>
  )
}

// ── Upcoming exercise card ──────────────────────────────────────────────────
function UpcomingCard({ ex, idx, onSkipTo }) {
  const subtitle = ex.type === 'cardio'
    ? `${ex.muscle} · ${ex.equipment}`
    : `${ex.muscle} · ${ex.equipment} · ${ex.sets.length} sets`
  return (
    <div class="card upcoming-card" onClick={() => onSkipTo(idx)}>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class={`muscle-dot ${ex.muscleClass}`} style="width:10px;height:10px;"></div>
          <div>
            <div style="font-weight:600;font-size:0.933rem;">{ex.name}</div>
            <div style="font-size:0.8rem;color:var(--text2);">{subtitle}</div>
          </div>
        </div>
        <span class="badge badge-gray">Up next</span>
      </div>
    </div>
  )
}

// ── Cardio exercise card ────────────────────────────────────────────────────
function CardioCard({ ex, idx, onComplete, onRemove }) {
  const [duration, setDuration] = useState(() => ex.duration || { mins: '', secs: '' })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    setDuration(ex.duration || { mins: '', secs: '' })
  }, [ex])

  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [menuOpen])

  const totalSecs = (parseInt(duration.mins) || 0) * 60 + (parseInt(duration.secs) || 0)
  const canComplete = totalSecs > 0

  return (
    <div class="card" style="animation:fadeUp 0.2s ease both;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class={`muscle-dot ${ex.muscleClass}`} style="width:10px;height:10px;"></div>
          <div>
            <div style="font-weight:700;font-size:1rem;">{ex.name}</div>
            <div style="font-size:0.8rem;color:var(--text2);">{ex.muscle} · {ex.equipment}</div>
          </div>
        </div>
        <div style="position:relative;" ref={menuRef}>
          <button
            class="icon-btn"
            style="width:30px;height:30px;"
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
          >
            {DOTS_SVG}
          </button>
          {menuOpen && (
            <div style="position:absolute;right:0;top:36px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:200;min-width:160px;overflow:hidden;">
              <button
                style="width:100%;padding:12px 16px;text-align:left;font-size:0.867rem;color:#f87171;background:none;border:none;cursor:pointer;display:block;"
                onClick={() => { setMenuOpen(false); onRemove() }}
              >
                Remove Exercise
              </button>
            </div>
          )}
        </div>
      </div>

      <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px;">
        <div style="flex:1;">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;">Minutes</div>
          <input
            type="number"
            min="0"
            max="999"
            step="1"
            placeholder="0"
            value={duration.mins}
            style="text-align:center;font-size:1.2rem;font-weight:700;"
            onInput={e => {
              const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0)
              setDuration(d => ({ ...d, mins: val === '' ? '' : String(val) }))
            }}
          />
        </div>
        <div style="font-size:1.4rem;font-weight:700;color:var(--text2);padding-bottom:8px;">:</div>
        <div style="flex:1;">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;">Seconds</div>
          <input
            type="number"
            min="0"
            max="59"
            step="1"
            placeholder="00"
            value={duration.secs}
            style="text-align:center;font-size:1.2rem;font-weight:700;"
            onInput={e => {
              const val = e.target.value === '' ? '' : Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
              setDuration(d => ({ ...d, secs: val === '' ? '' : String(val) }))
            }}
          />
        </div>
      </div>

      {ex.prevDuration && (() => {
        const pm = parseInt(ex.prevDuration.mins) || 0
        const ps = parseInt(ex.prevDuration.secs) || 0
        const label = pm > 0 && ps > 0 ? `${pm}m ${ps}s` : pm > 0 ? `${pm}m` : `${ps}s`
        return (
          <div style="font-size:0.8rem;color:var(--text2);text-align:center;margin-bottom:12px;">
            Last time: <span style="font-weight:600;color:var(--text);">{label}</span>
          </div>
        )
      })()}

      <button
        class="btn btn-primary btn-full"
        disabled={!canComplete}
        onClick={() => onComplete(duration)}
      >
        {TICK_SVG} Complete
      </button>
    </div>
  )
}

// ── Rest timer ──────────────────────────────────────────────────────────────
function RestTimer() {
  const defaultSecs = restTimerDefault.value
  const [secs, setSecs] = useState(defaultSecs)
  const [total, setTotal] = useState(defaultSecs)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => {
      setSecs(s => {
        if (s <= 1) { setRunning(false); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [running])

  function addTime(s) {
    setSecs(prev => {
      const next = Math.min(prev + s, 600)
      setTotal(t => Math.max(t, next))
      return next
    })
    setRunning(true)
  }

  return (
    <div class="card card-sm" style="background:rgba(139,92,246,0.1);border-color:var(--accent);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:0.8rem;color:var(--text2);">Rest Timer</div>
          <div style="font-size:1.867rem;font-weight:700;color:var(--accent-light);letter-spacing:-0.5px;font-variant-numeric:tabular-nums;">
            {formatCountdown(secs)}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm btn-secondary" onClick={() => addTime(30)}>+30s</button>
          <button class="btn btn-sm btn-secondary" onClick={() => { setSecs(0); setRunning(false) }}>Skip</button>
        </div>
      </div>
      <div class="progress-bar-wrap" style="margin-top:10px;">
        <div class="progress-bar-fill" style={{ width: (secs / total * 100) + '%' }}></div>
      </div>
    </div>
  )
}

// ── Add Exercise to Workout Modal ────────────────────────────────────────────
const MUSCLE_GROUPS_FILTER = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio']

function AddExerciseToWorkoutModal({ onAdd, onClose }) {
  const [exercises, setExercises] = useState([])
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('All')

  useEffect(() => {
    db.exercises.toArray().then(setExercises)
  }, [])

  const filtered = exercises.filter(ex => {
    const matchMuscle = filter === 'All' || ex.muscle === filter
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase())
    return matchMuscle && matchSearch
  })

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal"
        style="max-height:85dvh;display:flex;flex-direction:column;padding:0;overflow:hidden;"
        onClick={e => e.stopPropagation()}
      >
        <div style="padding:20px 20px 0;flex-shrink:0;">
          <div class="modal-header" style="padding-bottom:12px;">
            <div class="modal-title">Add Exercise</div>
            <button class="icon-btn" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="search-bar" style="margin-bottom:10px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search exercises…"
              value={search}
              onInput={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div class="filter-chips" style="margin-bottom:12px;overflow-x:auto;flex-wrap:nowrap;">
            {MUSCLE_GROUPS_FILTER.map(g => (
              <button
                key={g}
                class={`chip${filter === g ? ' active' : ''}`}
                onClick={() => setFilter(g)}
              >{g}</button>
            ))}
          </div>
        </div>

        <div style="flex:1;overflow-y:auto;padding:0 8px 20px;">
          {filtered.map(ex => (
            <div
              key={ex.id}
              class="exercise-row"
              style="padding:12px 12px;cursor:pointer;"
              onClick={() => { onAdd(ex); onClose() }}
            >
              <div class={`muscle-dot ${ex.muscleClass}`}></div>
              <div class="exercise-name">{ex.name}</div>
              <div class="exercise-muscle">{ex.muscle} · {ex.equipment}</div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;color:var(--text3);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style="text-align:center;padding:32px;color:var(--text2);font-size:0.867rem;">No exercises found</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ─────────────────────────────────────────────────────────────
export function ActiveWorkout({ onFinish, onDiscard }) {
  const [showFinishModal, setShowFinishModal]   = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [showAddExModal, setShowAddExModal]     = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const wo = activeWorkout.value
  useEffect(() => {
    if (!wo) return
    const start = wo.startTime
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    setElapsed(Math.floor((Date.now() - start) / 1000))
    return () => clearInterval(iv)
  }, [wo?.startTime])

  if (!wo) return null

  const exercises = wo.exercises
  const done = exercises.filter(e => e.state === 'done').length
  const total = exercises.length
  const volume = exercises.reduce((s, e) => s + (e.completedVolume || 0), 0)

  async function handleComplete(idx, sets) {
    await completeExercise(idx, sets)
    // Scroll to next active after re-render
    setTimeout(() => {
      const nextIdx = activeWorkout.value?.exercises.findIndex(e => e.state === 'active')
      if (nextIdx >= 0) {
        document.getElementById(`ex-${nextIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  async function handleFinish() {
    await finishWorkout()
    setShowFinishModal(false)
    onFinish()
  }

  function handleDiscard() {
    discardWorkout()
    setShowDiscardModal(false)
    onDiscard()
  }

  return (
    <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
      {/* Topbar */}
      <div class="topbar">
        <div>
          <div class="topbar-title">{wo.templateName}</div>
          <div style="font-size:0.8rem;color:var(--text2);margin-top:2px;">{done} of {total} exercises</div>
        </div>
        <div class="topbar-actions">
          <button class="icon-btn" onClick={() => setShowFinishModal(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button class="icon-btn" onClick={() => setShowDiscardModal(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div class="screen-scroll">
        <div class="page-content">

          {/* Timer bar */}
          <div class="timer-bar">
            <div>
              <div class="timer-val">{formatElapsed(elapsed)}</div>
              <div class="timer-label">Elapsed time</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.933rem;font-weight:600;color:var(--text);">{Math.round(volume).toLocaleString()} kg</div>
              <div class="timer-label">Volume so far</div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <div style="font-size:0.8rem;color:var(--text2);">Progress</div>
              <div style="font-size:0.8rem;color:var(--accent-light);font-weight:600;">{done}/{total} exercises</div>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style={{ width: (done / total * 100) + '%' }}></div>
            </div>
          </div>

          {/* Rest timer */}
          <RestTimer />

          {/* Exercise list */}
          <div style="display:flex;flex-direction:column;gap:10px;">
            {exercises.map((ex, idx) => {
              if (ex.state === 'done') return <CompletedCard key={idx} ex={ex} idx={idx} />
              if (ex.state === 'active') return (
                <div key={idx} id={`ex-${idx}`}>
                  {ex.type === 'cardio' ? (
                    <CardioCard
                      ex={ex}
                      idx={idx}
                      onComplete={duration => handleComplete(idx, duration)}
                      onRemove={() => removeExerciseFromWorkout(idx)}
                    />
                  ) : (
                    <ActiveCard
                      ex={ex}
                      idx={idx}
                      onComplete={sets => handleComplete(idx, sets)}
                      onAddSet={() => {}}
                      onRemove={() => removeExerciseFromWorkout(idx)}
                    />
                  )}
                </div>
              )
              return <UpcomingCard key={idx} ex={ex} idx={idx} onSkipTo={skipToExercise} />
            })}
          </div>

          {/* Add exercise button */}
          <button class="btn btn-secondary btn-full" onClick={() => setShowAddExModal(true)}>
            {PLUS_SVG} Add Exercise
          </button>

        </div>
      </div>

      {/* Finish modal */}
      {showFinishModal && (
        <div class="modal-backdrop open" onClick={e => e.target === e.currentTarget && setShowFinishModal(false)}>
          <div class="modal">
            <div class="modal-handle"></div>
            <div class="modal-title">Finish Workout?</div>
            <p style="color:var(--text2);font-size:0.933rem;margin-bottom:20px;">
              {done} of {total} exercises completed · {Math.round(volume).toLocaleString()} kg volume · {formatElapsed(elapsed)}
            </p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <button class="btn btn-primary btn-full" onClick={handleFinish}>Save Workout</button>
              <button class="btn btn-ghost btn-full" onClick={() => setShowFinishModal(false)}>Keep Going</button>
            </div>
          </div>
        </div>
      )}

      {/* Discard modal */}
      {showDiscardModal && (
        <div class="modal-backdrop open" onClick={e => e.target === e.currentTarget && setShowDiscardModal(false)}>
          <div class="modal">
            <div class="modal-handle"></div>
            <div class="modal-title">Discard Workout?</div>
            <p style="color:var(--text2);font-size:0.933rem;margin-bottom:20px;">
              All progress will be lost. This cannot be undone.
            </p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <button class="btn btn-danger btn-full" onClick={handleDiscard}>Discard</button>
              <button class="btn btn-ghost btn-full" onClick={() => setShowDiscardModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Exercise modal */}
      {showAddExModal && (
        <AddExerciseToWorkoutModal
          onAdd={ex => addExerciseToWorkout(ex)}
          onClose={() => setShowAddExModal(false)}
        />
      )}
    </div>
  )
}
