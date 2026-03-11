import { useRef, useState } from 'preact/hooks'
import {
  theme, setTheme,
  fontLabel, changeFontSize, fontIdx,
  accentIdx, setAccent, ACCENT_PRESETS,
  restTimerDefault, setRestTimerDefault, REST_TIMER_OPTIONS,
} from '../store/store.js'
import db from '../db/db.js'

// ---- Export all data as JSON ----------------------------------------------
async function exportData() {
  const [workouts, workoutExercises, sets, exercises, templates, templateExercises, prs] =
    await Promise.all([
      db.workouts.toArray(),
      db.workoutExercises.toArray(),
      db.sets.toArray(),
      db.exercises.toArray(),
      db.templates.toArray(),
      db.templateExercises.toArray(),
      db.prs.toArray(),
    ])

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    workouts,
    workoutExercises,
    sets,
    exercises,
    templates,
    templateExercises,
    prs,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gymapp-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Import JSON backup --------------------------------------------------
async function importData(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  if (data.version !== 1) throw new Error('Unsupported backup version')

  // Clear existing data
  await Promise.all([
    db.workouts.clear(),
    db.workoutExercises.clear(),
    db.sets.clear(),
    db.exercises.clear(),
    db.templates.clear(),
    db.templateExercises.clear(),
    db.prs.clear(),
  ])

  // Re-insert
  if (data.exercises?.length)         await db.exercises.bulkAdd(data.exercises)
  if (data.templates?.length)         await db.templates.bulkAdd(data.templates)
  if (data.templateExercises?.length) await db.templateExercises.bulkAdd(data.templateExercises)
  if (data.workouts?.length)          await db.workouts.bulkAdd(data.workouts)
  if (data.workoutExercises?.length)  await db.workoutExercises.bulkAdd(data.workoutExercises)
  if (data.sets?.length)              await db.sets.bulkAdd(data.sets)
  if (data.prs?.length)               await db.prs.bulkAdd(data.prs)
}

// ---- Nuke all data -------------------------------------------------------
async function clearAllData() {
  await Promise.all([
    db.workouts.clear(),
    db.workoutExercises.clear(),
    db.sets.clear(),
    db.templates.clear(),
    db.templateExercises.clear(),
    db.prs.clear(),
  ])
  // Re-seed flag so seed runs again
  localStorage.removeItem('gymapp_seeded')
}

// ---- Section separator ---------------------------------------------------
function SectionLabel({ children }) {
  return (
    <div style="font-size:0.733rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text2);padding:4px 0 8px;">
      {children}
    </div>
  )
}

// ---- Settings row --------------------------------------------------------
function SettingsRow({ label, sub, children, first, last }) {
  const radius = `${first ? 'var(--radius) var(--radius)' : '0 0'} ${last ? 'var(--radius) var(--radius)' : '0 0'}`
  return (
    <div style={`background:var(--card);border-radius:${radius};padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:${last ? 'none' : '1px solid var(--border)' };`}>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.933rem;font-weight:500;">{label}</div>
        {sub && <div style="font-size:0.8rem;color:var(--text2);margin-top:2px;">{sub}</div>}
      </div>
      <div style="flex-shrink:0;">{children}</div>
    </div>
  )
}

// ---- Clear data confirm modal --------------------------------------------
function ClearModal({ onConfirm, onClose }) {
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <div class="modal-title">Clear All Data</div>
          <button class="icon-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style="padding:0 20px 20px;color:var(--text2);font-size:0.933rem;line-height:1.5;">
          This will permanently delete all workout history, templates, and personal records. The exercise library will be re-seeded on next launch.<br/><br/>
          <strong style="color:var(--text);">This cannot be undone.</strong>
        </div>
        <div style="padding:0 20px 20px;display:flex;gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onClick={onClose}>Cancel</button>
          <button class="btn btn-danger" style="flex:1;" onClick={onConfirm}>Clear Everything</button>
        </div>
      </div>
    </div>
  )
}

// ---- Import confirm modal (destructive) ----------------------------------
function ImportModal({ file, onConfirm, onClose }) {
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <div class="modal-title">Import Backup</div>
          <button class="icon-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style="padding:0 20px 20px;color:var(--text2);font-size:0.933rem;line-height:1.5;">
          Import <strong style="color:var(--text);">{file?.name}</strong>?<br/><br/>
          This will <strong style="color:var(--text);">replace all existing data</strong> with the contents of the backup.
        </div>
        <div style="padding:0 20px 20px;display:flex;gap:10px;">
          <button class="btn btn-ghost" style="flex:1;" onClick={onClose}>Cancel</button>
          <button class="btn btn-primary" style="flex:1;" onClick={onConfirm}>Import</button>
        </div>
      </div>
    </div>
  )
}

// ---- Main screen ---------------------------------------------------------
export function Settings() {
  const fileRef = useRef(null)
  const [importFile, setImportFile] = useState(null)
  const [showClear, setShowClear] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (f) setImportFile(f)
    e.target.value = ''
  }

  async function handleImportConfirm() {
    try {
      await importData(importFile)
      setImportFile(null)
      showToast('Import successful — please reload the app')
    } catch (err) {
      setImportFile(null)
      showToast(`Import failed: ${err.message}`)
    }
  }

  async function handleClearConfirm() {
    await clearAllData()
    setShowClear(false)
    showToast('All data cleared')
  }

  return (
    <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
      <div class="topbar">
        <div class="topbar-title">Settings</div>
      </div>

      <div class="screen-scroll">
        <div class="page-content">

          {/* ---- Appearance ---- */}
          <SectionLabel>Appearance</SectionLabel>

          {/* Theme toggle */}
          <SettingsRow label="Dark Mode" sub="Toggle light / dark theme" first last>
            <label class="toggle">
              <input
                type="checkbox"
                checked={theme.value === 'dark'}
                onChange={e => setTheme(e.target.checked ? 'dark' : 'light')}
              />
              <span class="toggle-slider" />
            </label>
          </SettingsRow>

          {/* ---- Accent colour ---- */}
          <div style="margin-top:16px;">
            <SectionLabel>Accent Colour</SectionLabel>
            <div style="background:var(--card);border-radius:var(--radius);padding:16px;">
              <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">
                {ACCENT_PRESETS.map((p, i) => (
                  <button
                    key={p.name}
                    title={p.name}
                    onClick={() => setAccent(i)}
                    style={`
                      width: 40px; height: 40px;
                      border-radius: 50%;
                      background: ${p.accent};
                      border: 3px solid ${accentIdx.value === i ? '#fff' : 'transparent'};
                      box-shadow: ${accentIdx.value === i ? `0 0 0 3px ${p.accent}` : 'none'};
                      cursor: pointer;
                      transition: transform 0.15s ease, box-shadow 0.15s ease;
                      transform: ${accentIdx.value === i ? 'scale(1.12)' : 'scale(1)'};
                      display: flex; align-items: center; justify-content: center;
                    `}
                  >
                    {accentIdx.value === i && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" style="width:16px;height:16px;"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                ))}
              </div>
              <div style="text-align:center;font-size:0.8rem;color:var(--text2);margin-top:10px;">
                {ACCENT_PRESETS[accentIdx.value].name}
              </div>
            </div>
          </div>

          {/* ---- Font size ---- */}
          <div style="margin-top:16px;">
            <SectionLabel>Text Size</SectionLabel>
            <SettingsRow label="Font Size" sub={fontLabel.value} first last>
              <div style="display:flex;align-items:center;gap:8px;">
                <button
                  class="icon-btn"
                  style="width:34px;height:34px;border:1.5px solid var(--border);border-radius:var(--radius-sm);"
                  onClick={() => changeFontSize(-1)}
                  disabled={fontIdx.value === 0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button
                  class="icon-btn"
                  style="width:34px;height:34px;border:1.5px solid var(--border);border-radius:var(--radius-sm);"
                  onClick={() => changeFontSize(+1)}
                  disabled={fontIdx.value === 6}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </SettingsRow>
          </div>

          {/* ---- Workout ---- */}
          <div style="margin-top:16px;">
            <SectionLabel>Workout</SectionLabel>
            <SettingsRow
              label="Default Rest Timer"
              sub="Duration shown when rest timer starts"
              first
              last
            >
              <div style="display:flex;align-items:center;gap:8px;">
                <button
                  class="icon-btn"
                  style="width:34px;height:34px;border:1.5px solid var(--border);border-radius:var(--radius-sm);"
                  onClick={() => {
                    const i = REST_TIMER_OPTIONS.indexOf(restTimerDefault.value)
                    if (i > 0) setRestTimerDefault(REST_TIMER_OPTIONS[i - 1])
                  }}
                  disabled={REST_TIMER_OPTIONS.indexOf(restTimerDefault.value) === 0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span style="min-width:44px;text-align:center;font-size:0.933rem;font-weight:600;">
                  {restTimerDefault.value >= 60
                    ? `${Math.floor(restTimerDefault.value / 60)}m${restTimerDefault.value % 60 ? ` ${restTimerDefault.value % 60}s` : ''}`
                    : `${restTimerDefault.value}s`}
                </span>
                <button
                  class="icon-btn"
                  style="width:34px;height:34px;border:1.5px solid var(--border);border-radius:var(--radius-sm);"
                  onClick={() => {
                    const i = REST_TIMER_OPTIONS.indexOf(restTimerDefault.value)
                    if (i < REST_TIMER_OPTIONS.length - 1) setRestTimerDefault(REST_TIMER_OPTIONS[i + 1])
                  }}
                  disabled={REST_TIMER_OPTIONS.indexOf(restTimerDefault.value) === REST_TIMER_OPTIONS.length - 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </SettingsRow>
          </div>

          {/* ---- Data management ---- */}
          <div style="margin-top:16px;">
            <SectionLabel>Data</SectionLabel>

            <SettingsRow label="Export Data" sub="Download a JSON backup of all your data" first>
              <button class="btn btn-sm btn-ghost" onClick={exportData}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
            </SettingsRow>

            <SettingsRow label="Import Data" sub="Restore from a JSON backup (replaces all data)">
              <button class="btn btn-sm btn-ghost" onClick={() => fileRef.current?.click()}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                style="display:none;"
                onChange={handleFileChange}
              />
            </SettingsRow>

            <SettingsRow label="Clear All Data" sub="Permanently delete all workouts and records" last>
              <button class="btn btn-sm btn-danger" onClick={() => setShowClear(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                Clear
              </button>
            </SettingsRow>
          </div>

          {/* ---- About ---- */}
          <div style="margin-top:16px;">
            <SectionLabel>About</SectionLabel>
            <div style="background:var(--card);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:4px;">
              <div style="font-size:0.933rem;font-weight:600;">GymApp</div>
              <div style="font-size:0.8rem;color:var(--text2);">Offline-first personal workout tracker</div>
              <div style="font-size:0.8rem;color:var(--text3);margin-top:4px;">Version 1.0.0 · All data stored locally on your device</div>
            </div>
          </div>

          <div style="height:8px;" />
        </div>
      </div>

      {/* Modals */}
      {importFile && (
        <ImportModal
          file={importFile}
          onConfirm={handleImportConfirm}
          onClose={() => setImportFile(null)}
        />
      )}
      {showClear && (
        <ClearModal
          onConfirm={handleClearConfirm}
          onClose={() => setShowClear(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style="
          position:fixed;bottom:calc(var(--tab-height) + 12px);left:50%;transform:translateX(-50%);
          background:var(--bg3);color:var(--text);font-size:0.867rem;font-weight:500;
          padding:10px 18px;border-radius:100px;box-shadow:var(--shadow);
          animation:fadeUp 0.2s ease both;white-space:nowrap;z-index:200;
        ">
          {toast}
        </div>
      )}
    </div>
  )
}
