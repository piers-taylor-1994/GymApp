import db from './db.js'
import { SEED_EXERCISES, SEED_TEMPLATES } from '../data/exercises.js'
import { useEffect } from 'preact/hooks'

const SEED_VERSION = 3  // increment this whenever new seed exercises are added

export function useSeedOnce() {
  useEffect(() => {
    seedIfNeeded()
  }, [])
}

async function seedIfNeeded() {
  const versionRecord = await db.settings.get('seedVersion')
  const currentVersion = versionRecord ? parseInt(versionRecord.value, 10) : 0

  if (currentVersion >= SEED_VERSION) return

  // Fetch existing exercise names to avoid duplicates
  const existing = await db.exercises.toArray()
  const existingNames = new Set(existing.map(e => e.name))

  const exerciseIds = {}

  // Build a map of existing name -> id for template seeding
  for (const ex of existing) {
    exerciseIds[ex.name] = ex.id
  }

  // Add only new exercises
  for (const ex of SEED_EXERCISES) {
    if (!existingNames.has(ex.name)) {
      const id = await db.exercises.add(ex)
      exerciseIds[ex.name] = id
    }
  }

  // Seed templates only on first run (version 0 -> any)
  if (currentVersion === 0) {
    for (const t of SEED_TEMPLATES) {
      const templateId = await db.templates.add({ name: t.name })
      for (let i = 0; i < t.exercises.length; i++) {
        const exName = t.exercises[i]
        const exerciseId = exerciseIds[exName]
        if (exerciseId) {
          await db.templateExercises.add({ templateId, exerciseId, name: exName, order: i, defaultSets: 3 })
        }
      }
    }
  }

  await db.settings.put({ key: 'seedVersion', value: String(SEED_VERSION) })
}
