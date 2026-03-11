import { useState, useEffect } from 'preact/hooks'
import db from '../db/db.js'

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio']
const MUSCLE_GROUPS_NO_ALL = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio']
const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Other']

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(totalSecs) {
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0) return `${m}m`
  return `${s}s`
}

// ── Add Exercise Modal ─────────────────────────────────────────────────────
function AddExerciseModal({ onSave, onClose }) {
  const [name, setName]           = useState('')
  const [muscle, setMuscle]       = useState('Chest')
  const [equipment, setEquipment] = useState('Barbell')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const MUSCLE_CLASS_MAP = {
    Chest: 'mc-chest', Back: 'mc-back', Legs: 'mc-legs',
    Shoulders: 'mc-shoulders', Arms: 'mc-arms', Core: 'mc-core',
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      await db.exercises.add({
        name: name.trim(),
        muscle,
        muscleClass: MUSCLE_CLASS_MAP[muscle] || 'mc-full',
        equipment,
      })
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <div class="modal-title">New Exercise</div>
          <button class="icon-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;padding-bottom:20px;">
          <div>
            <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;">Name</div>
            <input
              type="text"
              placeholder="e.g. Bulgarian Split Squat"
              value={name}
              onInput={e => { setName(e.target.value); setError('') }}
              autoFocus
            />
            {error && <div style="font-size:0.8rem;color:#f87171;margin-top:4px;">{error}</div>}
          </div>

          <div>
            <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;">Muscle Group</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              {MUSCLE_GROUPS_NO_ALL.map(g => (
                <button
                  key={g}
                  class={`chip${muscle === g ? ' active' : ''}`}
                  onClick={() => setMuscle(g)}
                >{g}</button>
              ))}
            </div>
          </div>

          <div>
            <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:6px;">Equipment</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              {EQUIPMENT_OPTIONS.map(eq => (
                <button
                  key={eq}
                  class={`chip${equipment === eq ? ' active' : ''}`}
                  onClick={() => setEquipment(eq)}
                >{eq}</button>
              ))}
            </div>
          </div>
        </div>

        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onClick={onClose}>Cancel</button>
          <button
            class="btn btn-primary"
            style="flex:2;"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving…' : 'Add Exercise'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Exercise Detail Sheet ─────────────────────────────────────────────────
function ExerciseDetail({ exercise, onClose }) {
  const [history, setHistory] = useState([]) // [{date, sets: [{kg,reps}]}]
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      // Find all workoutExercises for this exercise
      const wes = await db.workoutExercises
        .where('exerciseId').equals(exercise.id)
        .toArray()

      const entries = await Promise.all(wes.map(async we => {
        const workout = await db.workouts.get(we.workoutId)
        const sets    = await db.sets.where('workoutExerciseId').equals(we.id).toArray()
        return workout ? { date: workout.date, sets } : null
      }))

      const sorted = entries
        .filter(Boolean)
        .filter(e => e.sets.length > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date))

      setHistory(sorted)
      setLoading(false)
    }
    load()
  }, [exercise.id])

  const isCardio = exercise.type === 'cardio'

  const bestSet = !isCardio && history.flatMap(e => e.sets).reduce((best, s) => {
    return (!best || s.kg > best.kg) ? s : best
  }, null)

  const totalSets   = history.reduce((n, e) => n + e.sets.length, 0)
  const totalVolume = !isCardio && history.flatMap(e => e.sets).reduce((s, set) => s + (set.kg || 0) * (set.reps || 0), 0)
  const totalCardioSecs = isCardio && history.flatMap(e => e.sets).reduce((s, set) => s + (set.reps || 0), 0)
  const bestCardioSecs  = isCardio && Math.max(0, ...history.flatMap(e => e.sets).map(s => s.reps || 0))

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal"
        style="max-height:85dvh;display:flex;flex-direction:column;padding:0;overflow:hidden;"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style="padding:20px 20px 0;flex-shrink:0;">
          <div class="modal-header" style="padding-bottom:12px;">
            <div>
              <div style="font-size:1.2rem;font-weight:700;">{exercise.name}</div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                <div class={`muscle-dot ${exercise.muscleClass}`}></div>
                <span style="font-size:0.8rem;color:var(--text2);">{exercise.muscle} · {exercise.equipment}</span>
              </div>
            </div>
            <button class="icon-btn" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Stats row */}
          {!loading && history.length > 0 && (
            <div style="display:flex;gap:8px;margin-bottom:16px;">
              {isCardio ? (
                <>
                  <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
                    <div style="font-size:1.2rem;font-weight:700;">{bestCardioSecs > 0 ? formatDuration(bestCardioSecs) : '—'}</div>
                    <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Best session</div>
                  </div>
                  <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
                    <div style="font-size:1.2rem;font-weight:700;">{history.length}</div>
                    <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Sessions</div>
                  </div>
                  <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
                    <div style="font-size:1.2rem;font-weight:700;">{totalCardioSecs > 0 ? formatDuration(totalCardioSecs) : '—'}</div>
                    <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Total time</div>
                  </div>
                </>
              ) : (
                <>
                  <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
                    <div style="font-size:1.2rem;font-weight:700;">{bestSet ? bestSet.kg + ' kg' : '—'}</div>
                    <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Best weight</div>
                  </div>
                  <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
                    <div style="font-size:1.2rem;font-weight:700;">{history.length}</div>
                    <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Sessions</div>
                  </div>
                  <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
                    <div style="font-size:1.2rem;font-weight:700;">{totalVolume > 0 ? Math.round(totalVolume / 1000) + 't' : '—'}</div>
                    <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Total vol.</div>
                  </div>
                </>
              )}
            </div>
          )}

          <div style="font-size:0.733rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text2);margin-bottom:10px;">
            History
          </div>
        </div>

        {/* Scrollable history */}
        <div style="flex:1;overflow-y:auto;padding:0 20px 24px;">
          {loading ? (
            <div style="text-align:center;padding:32px;color:var(--text2);font-size:0.867rem;">Loading…</div>
          ) : history.length === 0 ? (
            <div style="text-align:center;padding:32px;color:var(--text2);font-size:0.867rem;">
              No history yet — add this exercise to a workout to get started.
            </div>
          ) : (
            <div style="display:flex;flex-direction:column;gap:10px;">
              {history.map((entry, i) => (
                <div key={i} style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px 14px;">
                  <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:8px;">
                    {formatDate(entry.date)}
                  </div>
                  {isCardio ? (
                    <div style="font-size:0.933rem;font-weight:700;">
                      {entry.sets[0] ? formatDuration(entry.sets[0].reps || 0) : '—'}
                    </div>
                  ) : (
                    <>
                      <div style="display:flex;flex-direction:column;gap:4px;">
                        {entry.sets.map((s, j) => (
                          <div key={j} style="display:flex;gap:8px;font-size:0.867rem;">
                            <span style="color:var(--text3);min-width:40px;">Set {j + 1}</span>
                            <span style="font-weight:600;">{s.kg} kg</span>
                            <span style="color:var(--text2);">×</span>
                            <span style="font-weight:600;">{s.reps} reps</span>
                            <span style="color:var(--text2);margin-left:auto;">{Math.round(s.kg * s.reps)} kg vol</span>
                          </div>
                        ))}
                      </div>
                      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text2);">
                        {entry.sets.length} sets ·{' '}
                        {Math.round(entry.sets.reduce((s, set) => s + set.kg * set.reps, 0)).toLocaleString()} kg volume
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────
export function ExerciseLibrary() {
  const [exercises, setExercises]       = useState([])
  const [filter, setFilter]             = useState('All')
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState(null) // exercise object for detail sheet
  const [showAddModal, setShowAddModal] = useState(false)

  function loadExercises() {
    db.exercises.toArray().then(setExercises)
  }

  useEffect(() => { loadExercises() }, [])

  const filtered = exercises.filter(ex => {
    const matchMuscle = filter === 'All' || ex.muscle === filter
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase()) || ex.muscle.toLowerCase().includes(search.toLowerCase())
    return matchMuscle && matchSearch
  })

  const grouped = MUSCLE_GROUPS.slice(1).map(group => ({
    group,
    exercises: filtered.filter(ex => ex.muscle === group),
  })).filter(g => g.exercises.length > 0)

  return (
    <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
      <div class="topbar">
        <div class="topbar-title">Exercises</div>
        <div class="topbar-actions">
          <button class="icon-btn" onClick={() => setShowAddModal(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div class="screen-scroll">
        <div class="page-content">

          <div class="search-bar">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search exercises…"
              value={search}
              onInput={e => setSearch(e.target.value)}
            />
          </div>

          <div class="filter-chips">
            {MUSCLE_GROUPS.map(g => (
              <button
                key={g}
                class={`chip${filter === g ? ' active' : ''}`}
                onClick={() => setFilter(g)}
              >{g}</button>
            ))}
          </div>

          {grouped.length === 0 ? (
            <div class="empty-state">
              <div class="empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div class="empty-title">No exercises found</div>
              <div class="empty-sub">Try a different search, or tap + to add one</div>
            </div>
          ) : (
            grouped.map(({ group, exercises: exList }) => (
              <div key={group} class="card exercise-group">
                <div class="section-header" style="margin-bottom:4px;">
                  <div class="section-title">{group}</div>
                  <span class="badge badge-gray">{exList.length}</span>
                </div>
                {exList.map(ex => (
                  <div key={ex.id} class="exercise-row" onClick={() => setSelected(ex)}>
                    <div class={`muscle-dot ${ex.muscleClass}`}></div>
                    <div class="exercise-name">{ex.name}</div>
                    <div class="exercise-muscle">{ex.equipment}</div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;color:var(--text3);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            ))
          )}

        </div>
      </div>

      {/* Exercise detail sheet */}
      {selected && (
        <ExerciseDetail
          exercise={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Add exercise modal */}
      {showAddModal && (
        <AddExerciseModal
          onSave={() => { setShowAddModal(false); loadExercises() }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
