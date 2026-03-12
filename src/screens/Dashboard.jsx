import { useEffect, useState } from 'preact/hooks'
import { activeWorkout, startWorkout, userName } from '../store/store.js'
import db from '../db/db.js'
import { WorkoutDetail } from '../components/WorkoutDetail.jsx'

function formatDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function getWeekStreak(workouts) {
  if (!workouts.length) return 0
  const now = new Date()
  let streak = 0
  for (let w = 0; w < 52; w++) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() - w * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    const hasWorkout = workouts.some(wo => {
      const d = new Date(wo.date)
      return d >= weekStart && d < weekEnd
    })
    if (hasWorkout) streak++
    else if (w > 0) break
  }
  return streak
}

export function Dashboard({ onStartWorkout, onNavigate }) {
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [templates, setTemplates] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const [selectedWorkout, setSelectedWorkout] = useState(null)

  useEffect(() => {
    db.workouts.orderBy('date').reverse().limit(5).toArray().then(setRecentWorkouts)
    loadQuickStartTemplates()
  }, [])

  async function loadQuickStartTemplates() {
    // Get recently used template IDs (from workout history), deduped, most recent first
    const recentWorkouts = await db.workouts
      .orderBy('date').reverse()
      .filter(w => !!w.templateId)
      .limit(50)
      .toArray()

    const seenIds = []
    for (const w of recentWorkouts) {
      if (!seenIds.includes(w.templateId)) seenIds.push(w.templateId)
      if (seenIds.length === 5) break
    }

    // Fetch those templates in order
    const recentTemplates = (await Promise.all(seenIds.map(id => db.templates.get(id)))).filter(Boolean)

    // Pad with any remaining templates not already included
    if (recentTemplates.length < 5) {
      const allTemplates = await db.templates.toArray()
      for (const t of allTemplates) {
        if (!seenIds.includes(t.id)) recentTemplates.push(t)
        if (recentTemplates.length === 5) break
      }
    }

    setTemplates(recentTemplates)
  }

  // Elapsed timer if workout active
  useEffect(() => {
    if (!activeWorkout.value) return
    const start = activeWorkout.value.startTime
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [activeWorkout.value])

  const wo = activeWorkout.value
  const weekStreak = getWeekStreak(recentWorkouts)
  const totalWorkouts = recentWorkouts.length // approximate; ideally query all
  const totalVolume = recentWorkouts.reduce((s, w) => s + (w.totalVolume || 0), 0)
  const today = new Date()
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  function formatElapsed(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  async function handleStartTemplate(template) {
    const templateExercises = await db.templateExercises
      .where('templateId').equals(template.id)
      .sortBy('order')
    const exercises = await Promise.all(
      templateExercises.map(async te => {
        const ex = await db.exercises.get(te.exerciseId)
        return { ...ex, defaultSets: te.defaultSets || 3 }
      })
    )
    await startWorkout({ id: template.id, name: template.name, exercises })
    onStartWorkout()
  }

  return (
    <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
      <div class="topbar">
        <div>
          <div class="topbar-title">{greeting}, {userName.value}</div>
          <div style="font-size:0.8rem;color:var(--text2);margin-top:1px;">
            {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      <div class="screen-scroll">
        <div class="page-content">

          {/* Active workout banner */}
          {wo && (
            <div class="active-bar" onClick={onStartWorkout}>
              <div>
                <div class="active-bar-label">Workout in progress</div>
                <div class="active-bar-name">{wo.templateName}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:1.333rem;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;">
                  {formatElapsed(elapsed)}
                </div>
                <div style="font-size:0.733rem;color:rgba(255,255,255,0.7);">Tap to resume</div>
              </div>
            </div>
          )}

          {/* Stats row */}
          <div style="display:flex;gap:10px;min-width:0;width:100%;">
            <div class="stat-card" style="animation:fadeUp 0.25s ease both;animation-delay:0.04s;">
              <div class="stat-val">{weekStreak}</div>
              <div class="stat-label">
                <span class="streak-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </span>
                {' '}Week streak
              </div>
            </div>
            <div class="stat-card" style="animation:fadeUp 0.25s ease both;animation-delay:0.08s;">
              <div class="stat-val">{recentWorkouts.length}</div>
              <div class="stat-label">Recent sessions</div>
            </div>
          </div>

          {/* Quick start */}
          <div style="min-width:0;width:100%;">
            <div class="section-header">
              <div class="section-title">Quick Start</div>
              <button class="btn btn-sm btn-ghost" onClick={() => onNavigate('templates')}>All templates</button>
            </div>
            {templates.length === 0 ? (
              <div class="card" style="text-align:center;padding:24px;color:var(--text2);font-size:0.867rem;">
                No templates yet. Create one in Templates.
              </div>
            ) : (
              <div style="display:flex;gap:10px;overflow-x:auto;overflow-y:visible;padding-bottom:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;">
                {templates.map(t => (
                  <div key={t.id} class="workout-card" style="min-width:140px;flex-shrink:0;" onClick={() => handleStartTemplate(t)}>
                    <div class="workout-card-name">{t.name}</div>
                    <div class="workout-card-meta" style="margin-top:8px;">
                      <button class="btn btn-sm btn-primary" style="width:100%;" onClick={e => { e.stopPropagation(); handleStartTemplate(t) }}>Start</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent workouts */}
          <div>
            <div class="section-header">
              <div class="section-title">Recent Workouts</div>
              <button class="btn btn-sm btn-ghost" onClick={() => onNavigate('history')}>See all</button>
            </div>
            {recentWorkouts.length === 0 ? (
              <div class="empty-state">
                <div class="empty-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="6" y1="5" x2="6" y2="19"/><line x1="18" y1="5" x2="18" y2="19"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                </div>
                <div class="empty-title">No workouts yet</div>
                <div class="empty-sub">Start a session from a template above</div>
              </div>
            ) : (
              <div class="card" style="padding:0 16px;">
                {recentWorkouts.map((w, i) => {
                  const d = new Date(w.date)
                  return (
                    <div key={w.id} class="history-row" style={`animation:slideInLeft 0.22s ease both;animation-delay:${i * 0.04}s`} onClick={() => setSelectedWorkout(w)}>
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
      </div>

      {selectedWorkout && (
        <WorkoutDetail workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />
      )}
    </div>
  )
}
