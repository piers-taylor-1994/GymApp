import { useState, useEffect } from 'preact/hooks'
import db from '../db/db.js'
import { WorkoutDetail } from '../components/WorkoutDetail.jsx'

function formatDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function History() {
  const [workouts, setWorkouts] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    db.workouts.orderBy('date').reverse().toArray().then(setWorkouts)
  }, [])

  return (
    <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
      <div class="topbar">
        <div class="topbar-title">History</div>
      </div>

      <div class="screen-scroll">
        <div class="page-content">
          {workouts.length === 0 ? (
            <div class="empty-state">
              <div class="empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div class="empty-title">No workouts yet</div>
              <div class="empty-sub">Completed sessions will appear here</div>
            </div>
          ) : (
            <div class="card" style="padding:0 16px;">
              {workouts.map((w, i) => {
                const d = new Date(w.date)
                return (
                  <div
                    key={w.id}
                    class="history-row"
                    style={`animation:slideInLeft 0.22s ease both;animation-delay:${Math.min(i, 8) * 0.04}s`}
                    onClick={() => setSelected(w)}
                  >
                    <div class="history-date">
                      <div class="h-day">{d.getDate()}</div>
                      <div class="h-month">{d.toLocaleDateString('en-GB', { month: 'short' })}</div>
                    </div>
                    <div style="flex:1;min-width:0;">
                      <div class="history-name">{w.name}</div>
                      <div class="history-meta">
                        {w.exerciseCount} exercises · {(w.totalVolume || 0).toLocaleString()} kg · {formatDuration(w.duration || 0)}
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;color:var(--text3);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <WorkoutDetail workout={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
