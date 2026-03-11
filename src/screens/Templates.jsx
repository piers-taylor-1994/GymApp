import { useEffect, useState } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import { startWorkout } from '../store/store.js'
import db from '../db/db.js'

const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core']

// ---- Helper: load template with exercises from DB -------------------------
async function loadTemplateWithExercises(template) {
  const tes = await db.templateExercises
    .where('templateId').equals(template.id)
    .sortBy('order')
  const exercises = await Promise.all(
    tes.map(async te => {
      const ex = await db.exercises.get(te.exerciseId)
      return { ...ex, defaultSets: te.defaultSets || 3, templateExerciseId: te.id }
    })
  )
  return { ...template, exercises }
}

// ---- Add/Edit Template Modal ----------------------------------------------
function TemplateModal({ template, onSave, onClose }) {
  const [name, setName] = useState(template?.name ?? '')
  const [exercises, setExercises] = useState(template?.exercises ?? [])
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('')
  const [saving, setSaving] = useState(false)
  const [movingIdx, setMovingIdx] = useState(null)  // index of item that just moved INTO this position
  const [movingDir, setMovingDir] = useState(null)  // 'up' | 'down'

  useEffect(() => {
    db.exercises.orderBy('name').toArray().then(setAllExercises)
  }, [])

  const filtered = allExercises.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
    const matchMuscle = !muscle || e.muscle === muscle
    return matchSearch && matchMuscle
  })

  function addExercise(ex) {
    if (exercises.find(e => e.id === ex.id)) return
    setExercises(prev => [...prev, { ...ex, defaultSets: 3 }])
  }

  function removeExercise(id) {
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  function changeSets(id, delta) {
    setExercises(prev => prev.map(e =>
      e.id === id ? { ...e, defaultSets: Math.max(1, Math.min(10, (e.defaultSets || 3) + delta)) } : e
    ))
  }

  function moveExercise(idx, dir) {
    const next = [...exercises]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setExercises(next)
    // The item that just moved INTO `swap` position plays the animation
    setMovingIdx(swap)
    setMovingDir(dir === -1 ? 'up' : 'down')
    setTimeout(() => setMovingIdx(null), 300)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      let templateId
      if (template?.id) {
        await db.templates.update(template.id, { name: name.trim() })
        await db.templateExercises.where('templateId').equals(template.id).delete()
        templateId = template.id
      } else {
        templateId = await db.templates.add({ name: name.trim() })
      }
      for (let i = 0; i < exercises.length; i++) {
        await db.templateExercises.add({
          templateId,
          exerciseId: exercises[i].id,
          order: i,
          defaultSets: exercises[i].defaultSets || 3,
        })
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={e => e.stopPropagation()} style="max-height:90dvh;display:flex;flex-direction:column;">
        <div class="modal-header">
          <div class="modal-title">{template?.id ? 'Edit Template' : 'New Template'}</div>
          <button class="icon-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Single scrollable body: name + selected exercises + picker */}
        <div style="flex:1;overflow-y:auto;min-height:0;">

          {/* Template name */}
          <div style="padding:0 20px 12px;">
            <input
              type="text"
              placeholder="Template name"
              value={name}
              onInput={e => setName(e.target.value)}
              style="font-size:1rem;font-weight:600;"
            />
          </div>

          {/* Selected exercises */}
          {exercises.length > 0 && (
            <div style="padding:0 20px 12px;">
              <div style="font-size:0.8rem;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
                Exercises ({exercises.length})
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                {exercises.map((ex, i) => (
                  <div
                    key={ex.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: 'var(--bg3)', borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px', overflow: 'hidden',
                      animation: movingIdx === i
                        ? `${movingDir === 'up' ? 'reorderUp' : 'reorderDown'} 0.22s cubic-bezier(0.4,0,0.2,1) both`
                        : 'none',
                    }}
                  >
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:0.867rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{ex.name}</div>
                      <div style="font-size:0.733rem;color:var(--text2);">{ex.muscle}</div>
                    </div>
                    {/* Set count stepper — hidden for cardio */}
                    {ex.type !== 'cardio' && (
                      <div style="display:flex;align-items:center;gap:4px;">
                        <button class="icon-btn" style="width:24px;height:24px;" onClick={() => changeSets(ex.id, -1)}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <span style="font-size:0.8rem;font-weight:700;min-width:18px;text-align:center;">{ex.defaultSets}</span>
                        <button class="icon-btn" style="width:24px;height:24px;" onClick={() => changeSets(ex.id, +1)}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <span style="font-size:0.733rem;color:var(--text2);margin-left:2px;">sets</span>
                      </div>
                    )}
                    {/* Divider between stepper and reorder */}
                    <div style="width:1px;height:28px;background:var(--border);flex-shrink:0;" />
                    {/* Move up/down */}
                    <div style="display:flex;flex-direction:column;gap:2px;">
                      <button class="icon-btn" style={`width:20px;height:20px;opacity:${i === 0 ? '0.3' : '1'}`} onClick={() => moveExercise(i, -1)} disabled={i === 0}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <button class="icon-btn" style={`width:20px;height:20px;opacity:${i === exercises.length - 1 ? '0.3' : '1'}`} onClick={() => moveExercise(i, +1)} disabled={i === exercises.length - 1}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>
                    <button class="icon-btn" onClick={() => removeExercise(ex.id)} style="color:var(--text3);">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exercise picker — sticky header so search+filters stay visible while scrolling */}
          <div style="position:sticky;top:0;z-index:1;background:var(--bg2);padding:0 20px 8px;border-top:1px solid var(--border);">
            <div style="font-size:0.8rem;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;padding-top:12px;">
              Add Exercises
            </div>
            <input
              type="search"
              placeholder="Search exercises..."
              value={search}
              onInput={e => setSearch(e.target.value)}
              style="margin-bottom:8px;"
            />
            <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;margin-bottom:8px;">
              <button
                class={`chip${!muscle ? ' active' : ''}`}
                onClick={() => setMuscle('')}
              >All</button>
              {MUSCLE_GROUPS.map(g => (
                <button
                  key={g}
                  class={`chip${muscle === g ? ' active' : ''}`}
                  onClick={() => setMuscle(muscle === g ? '' : g)}
                >{g}</button>
              ))}
            </div>
          </div>

          {/* Exercise list */}
          <div style="padding:0 20px 20px;">
            {filtered.length === 0 ? (
              <div style="text-align:center;padding:20px;color:var(--text2);font-size:0.867rem;">No exercises found</div>
            ) : (
              <div style="display:flex;flex-direction:column;gap:4px;">
                {filtered.map(ex => {
                  const added = exercises.some(e => e.id === ex.id)
                  return (
                    <div
                      key={ex.id}
                      style={`display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-sm);background:${added ? 'var(--accent-muted)' : 'var(--bg3)'};cursor:pointer;transition:background var(--transition);`}
                      onClick={() => added ? removeExercise(ex.id) : addExercise(ex)}
                    >
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:0.867rem;font-weight:500;">{ex.name}</div>
                        <div style="font-size:0.733rem;color:var(--text2);">{ex.muscle} · {ex.equipment}</div>
                      </div>
                      {added ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" style="width:18px;height:18px;flex-shrink:0;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        <div style="padding:12px 20px 20px;border-top:1px solid var(--border);display:flex;gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onClick={onClose}>Cancel</button>
          <button
            class="btn btn-primary"
            style="flex:2;"
            onClick={handleSave}
            disabled={saving || !name.trim() || exercises.length === 0}
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Delete Confirm Modal -------------------------------------------------
function DeleteModal({ name, onConfirm, onClose }) {
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <div class="modal-title">Delete Template</div>
          <button class="icon-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style="padding:0 20px 20px;color:var(--text2);font-size:0.933rem;line-height:1.5;">
          Delete <strong style="color:var(--text);">{name}</strong>? This cannot be undone.
        </div>
        <div style="padding:0 20px 20px;display:flex;gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onClick={onClose}>Cancel</button>
          <button class="btn btn-danger" style="flex:1;" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ---- Template Card --------------------------------------------------------
function TemplateCard({ template, onStart, onEdit, onDelete, style }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div class="card" style={`padding:0;overflow:hidden;${style || ''}`}>
      <div style="padding:16px 16px 12px;display:flex;align-items:flex-start;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:1rem;font-weight:700;">{template.name}</div>
          <div style="font-size:0.8rem;color:var(--text2);margin-top:2px;">
            {template.exercises?.length ?? 0} exercises
          </div>
        </div>
        <button
          class="btn btn-sm btn-primary"
          onClick={() => onStart(template)}
          style="flex-shrink:0;"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start
        </button>
      </div>

      {/* Exercise preview chips */}
      {template.exercises?.length > 0 && (
        <div style="padding:0 16px 12px;display:flex;flex-wrap:wrap;gap:4px;">
          {(expanded ? template.exercises : template.exercises.slice(0, 4)).map(ex => (
            <span key={ex.id} class={`muscle-chip ${ex.muscleClass || ''}`} style="font-size:0.733rem;">
              {ex.name}
            </span>
          ))}
          {!expanded && template.exercises.length > 4 && (
            <button
              style="background:none;border:none;cursor:pointer;font-size:0.733rem;color:var(--accent);padding:0 4px;"
              onClick={() => setExpanded(true)}
            >+{template.exercises.length - 4} more</button>
          )}
        </div>
      )}

      {/* Actions row */}
      <div style="border-top:1px solid var(--border);display:flex;">
        <button
          style="flex:1;padding:10px;background:none;border:none;border-right:1px solid var(--border);cursor:pointer;font-size:0.8rem;color:var(--text2);display:flex;align-items:center;justify-content:center;gap:6px;transition:color var(--transition);"
          onClick={() => onEdit(template)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button
          style="flex:1;padding:10px;background:none;border:none;cursor:pointer;font-size:0.8rem;color:var(--text3);display:flex;align-items:center;justify-content:center;gap:6px;transition:color var(--transition);"
          onClick={() => onDelete(template)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Delete
        </button>
      </div>
    </div>
  )
}

// ---- Main Screen ----------------------------------------------------------
export function Templates({ onStartWorkout }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const editTarget = useSignal(null)   // null | template object (with exercises)
  const deleteTarget = useSignal(null) // null | template object
  const showNew = useSignal(false)

  async function loadTemplates() {
    const ts = await db.templates.toArray()
    const withExercises = await Promise.all(ts.map(loadTemplateWithExercises))

    // Sort: most-recently-used first, then unused templates in insertion order
    const recentWorkouts = await db.workouts
      .orderBy('date').reverse()
      .filter(w => !!w.templateId)
      .toArray()
    const seenIds = []
    for (const w of recentWorkouts) {
      if (!seenIds.includes(w.templateId)) seenIds.push(w.templateId)
    }
    withExercises.sort((a, b) => {
      const ai = seenIds.indexOf(a.id)
      const bi = seenIds.indexOf(b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

    setTemplates(withExercises)
    setLoading(false)
  }

  useEffect(() => { loadTemplates() }, [])

  async function handleStart(template) {
    await startWorkout({ id: template.id, name: template.name, exercises: template.exercises })
    onStartWorkout?.()
  }

  async function handleDelete(template) {
    await db.templateExercises.where('templateId').equals(template.id).delete()
    await db.templates.delete(template.id)
    deleteTarget.value = null
    loadTemplates()
  }

  return (
    <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
      <div class="topbar">
        <div class="topbar-title">Templates</div>
        <div class="topbar-actions">
          <button class="icon-btn" onClick={() => { showNew.value = true }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div class="screen-scroll">
        <div class="page-content">
          {loading ? (
            <div style="text-align:center;padding:48px;color:var(--text2);font-size:0.867rem;">Loading…</div>
          ) : templates.length === 0 ? (
            <div class="empty-state">
              <div class="empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              </div>
              <div class="empty-title">No templates yet</div>
              <div class="empty-sub">Tap + to create your first workout template</div>
              <button class="btn btn-primary" style="margin-top:16px;" onClick={() => { showNew.value = true }}>
                Create Template
              </button>
            </div>
          ) : (
            <div style="display:flex;flex-direction:column;gap:12px;">
              {templates.map((t, i) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  style={`animation:fadeUp 0.22s ease both;animation-delay:${i * 0.05}s`}
                  onStart={handleStart}
                  onEdit={async (tmpl) => {
                    const full = await loadTemplateWithExercises(tmpl)
                    editTarget.value = full
                  }}
                  onDelete={t => { deleteTarget.value = t }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New template modal */}
      {showNew.value && (
        <TemplateModal
          onSave={() => { showNew.value = false; loadTemplates() }}
          onClose={() => { showNew.value = false }}
        />
      )}

      {/* Edit template modal */}
      {editTarget.value && (
        <TemplateModal
          template={editTarget.value}
          onSave={() => { editTarget.value = null; loadTemplates() }}
          onClose={() => { editTarget.value = null }}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget.value && (
        <DeleteModal
          name={deleteTarget.value.name}
          onConfirm={() => handleDelete(deleteTarget.value)}
          onClose={() => { deleteTarget.value = null }}
        />
      )}
    </div>
  )
}
