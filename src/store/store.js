import { signal, computed } from '@preact/signals'
import db from '../db/db.js'

// ===== THEME =====
export const theme = signal(
  localStorage.getItem('theme') || 'dark'
)
export function setTheme(t) {
  theme.value = t
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem('theme', t)
}
// Apply on load
document.documentElement.setAttribute('data-theme', theme.value)

// ===== FONT SIZE =====
const FONT_SIZES  = [12, 13, 14, 15, 16, 17, 18]
const FONT_LABELS = ['XS', 'Small', 'Small', 'Medium', 'Large', 'Large', 'XL']
export const fontIdx = signal(
  parseInt(localStorage.getItem('fontIdx') ?? '3', 10)
)
export const fontSize = computed(() => FONT_SIZES[fontIdx.value])
export const fontLabel = computed(() => `${FONT_LABELS[fontIdx.value]} (${FONT_SIZES[fontIdx.value]}px)`)
export function changeFontSize(delta) {
  const next = Math.max(0, Math.min(FONT_SIZES.length - 1, fontIdx.value + delta))
  fontIdx.value = next
  document.documentElement.style.setProperty('--font-size-base', FONT_SIZES[next] + 'px')
  localStorage.setItem('fontIdx', next)
}
// Apply on load
document.documentElement.style.setProperty('--font-size-base', fontSize.value + 'px')

// ===== ACCENT COLOUR =====
export const ACCENT_PRESETS = [
  { name: 'Violet',  accent: '#8b5cf6', light: '#a78bfa', dark: '#6d28d9', muted: 'rgba(139,92,246,0.15)' },
  { name: 'Blue',    accent: '#3b82f6', light: '#60a5fa', dark: '#1d4ed8', muted: 'rgba(59,130,246,0.15)'  },
  { name: 'Cyan',    accent: '#06b6d4', light: '#22d3ee', dark: '#0e7490', muted: 'rgba(6,182,212,0.15)'   },
  { name: 'Green',   accent: '#22c55e', light: '#4ade80', dark: '#15803d', muted: 'rgba(34,197,94,0.15)'   },
  { name: 'Rose',    accent: '#f43f5e', light: '#fb7185', dark: '#be123c', muted: 'rgba(244,63,94,0.15)'   },
  { name: 'Orange',  accent: '#f97316', light: '#fb923c', dark: '#c2410c', muted: 'rgba(249,115,22,0.15)'  },
  { name: 'Pink',    accent: '#ec4899', light: '#f472b6', dark: '#9d174d', muted: 'rgba(236,72,153,0.15)'  },
]
export const accentIdx = signal(
  parseInt(localStorage.getItem('accentIdx') ?? '0', 10)
)
export function setAccent(idx) {
  accentIdx.value = idx
  const p = ACCENT_PRESETS[idx]
  const root = document.documentElement
  root.style.setProperty('--accent',       p.accent)
  root.style.setProperty('--accent-light', p.light)
  root.style.setProperty('--accent-dark',  p.dark)
  root.style.setProperty('--accent-muted', p.muted)
  localStorage.setItem('accentIdx', idx)
}
// Apply on load
setAccent(accentIdx.value)

// ===== REST TIMER DEFAULT =====
export const REST_TIMER_OPTIONS = [30, 45, 60, 90, 120, 180, 300]
export const restTimerDefault = signal(
  parseInt(localStorage.getItem('restTimerDefault') ?? '90', 10)
)
export function setRestTimerDefault(secs) {
  restTimerDefault.value = secs
  localStorage.setItem('restTimerDefault', secs)
}

// ===== ACTIVE WORKOUT =====
// null when no workout in progress
export const activeWorkout = signal(null)
// { templateId, templateName, startTime, exercises: [...] }
// Each exercise: { id, name, muscle, muscleClass, equipment, pr, state, sets: [...], completedVolume }
// set: { kg, reps, done, prev }

// Returns { prevSets: [{kg,reps},...] } for strength, or { prevDuration: {mins,secs} } for cardio
// based on the most recent completed workout containing this exercise.
async function getLastExerciseData(exerciseId, type) {
  if (!exerciseId) return {}
  // Find the most recent workoutExercise for this exercise
  const allWE = await db.workoutExercises
    .where('exerciseId').equals(exerciseId)
    .toArray()
  if (!allWE.length) return {}
  // Fetch parent workouts to sort by date
  const workoutIds = [...new Set(allWE.map(we => we.workoutId))]
  const workouts = await db.workouts.bulkGet(workoutIds)
  const sorted = allWE
    .map(we => ({ we, wo: workouts.find(w => w?.id === we.workoutId) }))
    .filter(x => x.wo)
    .sort((a, b) => new Date(b.wo.date) - new Date(a.wo.date))
  if (!sorted.length) return {}
  const lastWE = sorted[0].we
  if (type === 'cardio') {
    const sets = await db.sets.where('workoutExerciseId').equals(lastWE.id).toArray()
    if (!sets.length) return {}
    const totalSecs = sets[0].reps || 0
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return { prevDuration: { mins: String(mins), secs: String(secs) } }
  } else {
    const sets = await db.sets.where('workoutExerciseId').equals(lastWE.id).toArray()
    return { prevSets: sets.map(s => ({ kg: s.kg, reps: s.reps })) }
  }
}

export async function startWorkout(template) {
  const exercisesWithPrev = await Promise.all(
    template.exercises.map(async ex => {
      const prev = await getLastExerciseData(ex.id, ex.type)
      if (ex.type === 'cardio') {
        return {
          ...ex,
          state: 'upcoming',
          duration: { mins: '', secs: '' },
          completedVolume: 0,
          completedSets: 0,
          prevDuration: prev.prevDuration || null,
        }
      } else {
        const prevSets = prev.prevSets || []
        const sets = Array.from({ length: ex.defaultSets ?? 3 }, (_, i) => ({
          kg: ex.lastKg ?? '',
          reps: ex.lastReps ?? '',
          done: false,
          prev: prevSets[i] ? `${prevSets[i].kg}kg × ${prevSets[i].reps}` : '—',
        }))
        return {
          ...ex,
          state: 'upcoming',
          sets,
          completedVolume: 0,
          completedSets: 0,
        }
      }
    })
  )
  activeWorkout.value = {
    templateId: template.id ?? null,
    templateName: template.name,
    startTime: Date.now(),
    exercises: exercisesWithPrev,
  }
  if (activeWorkout.value.exercises.length > 0) {
    activeWorkout.value.exercises[0].state = 'active'
  }
}

export async function completeExercise(idx, setsOrDuration) {
  const w = { ...activeWorkout.value }
  const ex = { ...w.exercises[idx] }
  ex.state = 'done'

  if (ex.type === 'cardio') {
    // setsOrDuration is { mins, secs }
    ex.duration = setsOrDuration
    const totalSecs = (parseInt(setsOrDuration.mins) || 0) * 60 + (parseInt(setsOrDuration.secs) || 0)
    ex.completedSets = totalSecs > 0 ? 1 : 0
    ex.completedVolume = 0
  } else {
    const sets = setsOrDuration
    ex.completedSets = sets.filter(s => s.done || (s.kg && s.reps)).length
    ex.completedVolume = sets.reduce((sum, s) => {
      const kg = parseFloat(s.kg) || 0
      const reps = parseFloat(s.reps) || 0
      return sum + (kg * reps)
    }, 0)
    ex.sets = sets

    // Check for PR (best weight or best volume set)
    const validSets = sets.filter(s => s.kg && s.reps)
    if (validSets.length > 0 && ex.id) {
      const existingPRs = await db.prs.where('exerciseId').equals(ex.id).toArray()
      const prWeight = existingPRs.find(p => p.type === 'weight')
      const prVol    = existingPRs.find(p => p.type === 'volume')
      const sessionBestKg  = Math.max(...validSets.map(s => parseFloat(s.kg)))
      const sessionBestVol = Math.max(...validSets.map(s => parseFloat(s.kg) * parseInt(s.reps)))
      ex.pr = (!prWeight || sessionBestKg > prWeight.value) || (!prVol || sessionBestVol > prVol.value)
    }
  }

  w.exercises = [...w.exercises]
  w.exercises[idx] = ex

  // Activate next upcoming
  const nextIdx = w.exercises.findIndex(e => e.state === 'upcoming')
  if (nextIdx >= 0) {
    w.exercises[nextIdx] = { ...w.exercises[nextIdx], state: 'active' }
  }
  activeWorkout.value = w
}

export function skipToExercise(idx, currentSets) {
  const w = { ...activeWorkout.value }
  const exercises = [...w.exercises]

  // Save current active state
  const activeIdx = exercises.findIndex(e => e.state === 'active')
  if (activeIdx >= 0 && currentSets) {
    exercises[activeIdx] = { ...exercises[activeIdx], state: 'done', sets: currentSets,
      completedSets: currentSets.filter(s => s.kg && s.reps).length,
      completedVolume: currentSets.reduce((sum, s) => sum + (parseFloat(s.kg)||0) * (parseFloat(s.reps)||0), 0),
    }
  }
  exercises[idx] = { ...exercises[idx], state: 'active' }
  w.exercises = exercises
  activeWorkout.value = w
}

export function updateExerciseSets(idx, sets) {
  const w = { ...activeWorkout.value }
  const exercises = [...w.exercises]
  exercises[idx] = { ...exercises[idx], sets }
  w.exercises = exercises
  activeWorkout.value = w
}

export function updateExerciseDuration(idx, duration) {
  const w = { ...activeWorkout.value }
  const exercises = [...w.exercises]
  const ex = { ...exercises[idx], duration }
  const totalSecs = (parseInt(duration.mins) || 0) * 60 + (parseInt(duration.secs) || 0)
  ex.completedSets = totalSecs > 0 ? 1 : 0
  exercises[idx] = ex
  w.exercises = exercises
  activeWorkout.value = w
}

export async function finishWorkout() {
  const w = activeWorkout.value
  if (!w) return

  const duration = Math.floor((Date.now() - w.startTime) / 1000)
  const totalVolume = w.exercises.reduce((sum, ex) => sum + (ex.completedVolume || 0), 0)

  const workoutId = await db.workouts.add({
    date: new Date(w.startTime).toISOString(),
    templateId: w.templateId,
    name: w.templateName,
    duration,
    totalVolume: Math.round(totalVolume),
    exerciseCount: w.exercises.filter(ex => ex.state === 'done').length,
  })

  for (const ex of w.exercises.filter(e => e.state === 'done')) {
    const weId = await db.workoutExercises.add({
      workoutId,
      exerciseId: ex.id,
      name: ex.name,
    })

    if (ex.type === 'cardio') {
      // Store duration as a single set row: kg = 0, reps = total seconds
      const totalSecs = (parseInt(ex.duration?.mins) || 0) * 60 + (parseInt(ex.duration?.secs) || 0)
      if (totalSecs > 0) {
        await db.sets.add({ workoutExerciseId: weId, kg: 0, reps: totalSecs })
      }
      continue
    }

    for (const set of ex.sets) {
      if (set.kg && set.reps) {
        await db.sets.add({ workoutExerciseId: weId, kg: parseFloat(set.kg), reps: parseInt(set.reps) })
      }
    }

    // ── PR tracking ──────────────────────────────────────────────────────────
    const validSets = ex.sets.filter(s => s.kg && s.reps)
    if (validSets.length === 0) continue

    const sessionBestKg     = Math.max(...validSets.map(s => parseFloat(s.kg)))
    const sessionBestReps   = Math.max(...validSets.map(s => parseInt(s.reps)))
    const sessionBestVol    = Math.max(...validSets.map(s => parseFloat(s.kg) * parseInt(s.reps)))

    const existingPRs = await db.prs.where('exerciseId').equals(ex.id).toArray()
    const prByType    = Object.fromEntries(existingPRs.map(p => [p.type, p]))

    async function upsertPR(type, value) {
      const existing = prByType[type]
      if (!existing) {
        await db.prs.add({ exerciseId: ex.id, type, value, date: new Date().toISOString() })
      } else if (value > existing.value) {
        await db.prs.update(existing.id, { value, date: new Date().toISOString() })
      }
    }

    await upsertPR('weight', sessionBestKg)
    await upsertPR('reps',   sessionBestReps)
    await upsertPR('volume', sessionBestVol)
  }

  activeWorkout.value = null
}

export function discardWorkout() {
  activeWorkout.value = null
}

export function removeExerciseFromWorkout(idx) {
  const w = { ...activeWorkout.value }
  const exercises = w.exercises.filter((_, i) => i !== idx)
  // If we removed the active exercise, activate the next upcoming (or previous upcoming)
  const hadActive = !exercises.some(e => e.state === 'active')
  if (hadActive) {
    const nextUpcoming = exercises.findIndex(e => e.state === 'upcoming')
    if (nextUpcoming >= 0) exercises[nextUpcoming] = { ...exercises[nextUpcoming], state: 'active' }
  }
  w.exercises = exercises
  activeWorkout.value = w
}

export async function addExerciseToWorkout(exercise, defaultSets = 3) {
  const w = { ...activeWorkout.value }
  const prev = await getLastExerciseData(exercise.id, exercise.type)
  let newEx
  if (exercise.type === 'cardio') {
    newEx = {
      ...exercise,
      state: 'upcoming',
      completedVolume: 0,
      completedSets: 0,
      duration: { mins: '', secs: '' },
      prevDuration: prev.prevDuration || null,
    }
  } else {
    const prevSets = prev.prevSets || []
    newEx = {
      ...exercise,
      state: 'upcoming',
      completedVolume: 0,
      completedSets: 0,
      sets: Array.from({ length: defaultSets }, (_, i) => ({
        kg: '',
        reps: '',
        done: false,
        prev: prevSets[i] ? `${prevSets[i].kg}kg × ${prevSets[i].reps}` : '—',
      })),
    }
  }
  // If nothing is active, make this the active exercise
  const hasActive = w.exercises.some(e => e.state === 'active')
  if (!hasActive) newEx.state = 'active'
  w.exercises = [...w.exercises, newEx]
  activeWorkout.value = w
}
