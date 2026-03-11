import Dexie from 'dexie'

export const db = new Dexie('GymApp')

db.version(1).stores({
  // workouts: completed workout sessions
  workouts: '++id, date, templateId',
  // workoutExercises: exercises within a completed workout
  workoutExercises: '++id, workoutId, exerciseId',
  // sets: individual logged sets
  sets: '++id, workoutExerciseId',
  // exercises: the exercise library
  exercises: '++id, name, muscle, equipment',
  // templates: saved workout plans
  templates: '++id, name',
  // templateExercises: exercises within a template
  templateExercises: '++id, templateId, exerciseId, order',
  // prs: personal records per exercise
  prs: '++id, exerciseId, type', // type: 'weight' | 'volume' | 'reps'
  // settings: key/value store
  settings: 'key',
})

export default db
