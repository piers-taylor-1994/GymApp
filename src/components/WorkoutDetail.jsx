import { useState, useEffect } from 'preact/hooks'
import db from '../db/db.js'

function formatDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatCardioTime(totalSecs) {
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0) return `${m}m`
  return `${s}s`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function WorkoutDetail({ workout, onClose }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const wes = await db.workoutExercises
        .where('workoutId').equals(workout.id)
        .toArray()
      const enriched = await Promise.all(wes.map(async we => {
        const sets    = await db.sets.where('workoutExerciseId').equals(we.id).toArray()
        const exRecord = we.exerciseId ? await db.exercises.get(we.exerciseId) : null
        const isCardio = exRecord?.type === 'cardio'
        const vol = isCardio ? 0 : sets.reduce((s, set) => s + (set.kg || 0) * (set.reps || 0), 0)
        return { ...we, sets, volume: Math.round(vol), isCardio }
      }))
      setExercises(enriched)
      setLoading(false)
    }
    load()
  }, [workout.id])

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal"
        style="max-height:90dvh;display:flex;flex-direction:column;padding:0;overflow:hidden;"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style="padding:20px 20px 0;flex-shrink:0;">
          <div class="modal-header" style="padding-bottom:4px;">
            <div>
              <div style="font-size:1.1rem;font-weight:700;">{workout.name}</div>
              <div style="font-size:0.8rem;color:var(--text2);margin-top:2px;">{formatDate(workout.date)}</div>
            </div>
            <button class="icon-btn" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Stats row */}
          <div style="display:flex;gap:8px;margin:14px 0 16px;">
            <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
              <div style="font-size:1.1rem;font-weight:700;">{workout.exerciseCount}</div>
              <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Exercises</div>
            </div>
            <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
              <div style="font-size:1.1rem;font-weight:700;">{(workout.totalVolume || 0).toLocaleString()} kg</div>
              <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Volume</div>
            </div>
            <div style="flex:1;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 12px;">
              <div style="font-size:1.1rem;font-weight:700;">{formatDuration(workout.duration || 0)}</div>
              <div style="font-size:0.733rem;color:var(--text2);margin-top:2px;">Duration</div>
            </div>
          </div>

          <div style="font-size:0.733rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text2);margin-bottom:10px;">
            Exercises
          </div>
        </div>

        {/* Scrollable exercise list */}
        <div style="flex:1;overflow-y:auto;padding:0 20px 24px;">
          {loading ? (
            <div style="text-align:center;padding:32px;color:var(--text2);font-size:0.867rem;">Loading…</div>
          ) : exercises.length === 0 ? (
            <div style="text-align:center;padding:32px;color:var(--text2);font-size:0.867rem;">No exercise data recorded.</div>
          ) : (
            <div style="display:flex;flex-direction:column;gap:10px;">
              {exercises.map((ex, i) => (
                <div key={i} style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px 14px;">
                  {ex.isCardio ? (
                    <>
                      <div style="font-weight:600;font-size:0.933rem;margin-bottom:6px;">{ex.name}</div>
                      <div style="font-size:0.867rem;color:var(--text2);">
                        {ex.sets[0] ? formatCardioTime(ex.sets[0].reps || 0) : 'No duration recorded'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <div style="font-weight:600;font-size:0.933rem;">{ex.name}</div>
                        <div style="font-size:0.8rem;color:var(--text2);">{ex.volume.toLocaleString()} kg</div>
                      </div>
                      {ex.sets.length > 0 ? (
                        <div style="display:flex;flex-direction:column;gap:3px;">
                          {ex.sets.map((s, j) => (
                            <div key={j} style="display:flex;gap:8px;font-size:0.8rem;">
                              <span style="color:var(--text3);min-width:40px;">Set {j + 1}</span>
                              <span style="font-weight:600;">{s.kg} kg</span>
                              <span style="color:var(--text2);">×</span>
                              <span style="font-weight:600;">{s.reps} reps</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style="font-size:0.8rem;color:var(--text2);">No sets recorded</div>
                      )}
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



