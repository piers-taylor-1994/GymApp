import { useEffect, useRef, useState } from 'preact/hooks'
import { Chart } from 'chart.js/auto'
import db from '../db/db.js'
import { fontSize } from '../store/store.js'

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
]

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()) // Sunday
  return d
}

function weekLabel(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Returns ISO date string (YYYY-MM-DD) for a date
function toDateStr(date) {
  return new Date(date).toISOString().slice(0, 10)
}

export function Progress() {
  const strengthRef = useRef(null)
  const volumeRef = useRef(null)
  const strengthChart = useRef(null)
  const volumeChart = useRef(null)

  const [periodIdx, setPeriodIdx] = useState(1) // default 3M
  const [heatVisible, setHeatVisible] = useState(false)
  const [heatmapData, setHeatmapData] = useState([]) // array of {dateStr, count} for last 56 days (8 weeks)
  const [strengthExercise, setStrengthExercise] = useState(null) // { name, data: [{label, kg}] }
  const [hasStrengthData, setHasStrengthData] = useState(false)
  const [hasVolumeData, setHasVolumeData] = useState(false)

  const days = PERIODS[periodIdx].days

  // ── Load all chart data ────────────────────────────────────────────────────
  useEffect(() => {
    loadData()
  }, [days, fontSize.value])

  async function loadData() {
    const since = new Date(Date.now() - days * 86400000)

    // All workouts in range
    const workouts = await db.workouts
      .where('date').above(since.toISOString())
      .sortBy('date')

    // ── Volume chart: weekly totals ──────────────────────────────────────────
    const weekMap = new Map()
    for (const w of workouts) {
      const weekStart = startOfWeek(new Date(w.date))
      const key = weekStart.toISOString()
      weekMap.set(key, { label: weekLabel(weekStart), vol: (weekMap.get(key)?.vol || 0) + (w.totalVolume || 0) })
    }
    const volumeData = Array.from(weekMap.values())
    setHasVolumeData(volumeData.length > 0)

    // ── Strength chart: best exercise by total logged sets ───────────────────
    // Find exercise with most logged sets overall (most data = most meaningful chart)
    const allWorkoutIds = workouts.map(w => w.id)
    let bestExercise = null
    let bestData = []

    if (allWorkoutIds.length > 0) {
      // Get all workoutExercises for these workouts
      const wes = await db.workoutExercises
        .where('workoutId').anyOf(allWorkoutIds)
        .toArray()

      // Count sets per exerciseId
      const exerciseSetsCount = new Map()
      for (const we of wes) {
        const sets = await db.sets.where('workoutExerciseId').equals(we.id).toArray()
        if (sets.length > 0) {
          exerciseSetsCount.set(we.exerciseId, (exerciseSetsCount.get(we.exerciseId) || 0) + sets.length)
        }
      }

      if (exerciseSetsCount.size > 0) {
        // Pick exercise with most total sets
        const bestExId = [...exerciseSetsCount.entries()].sort((a, b) => b[1] - a[1])[0][0]
        const exRecord = await db.exercises.get(bestExId)

        // For each workout containing this exercise, find max weight
        const strengthPoints = []
        for (const w of workouts) {
          const we = wes.find(we => we.workoutId === w.id && we.exerciseId === bestExId)
          if (!we) continue
          const sets = await db.sets.where('workoutExerciseId').equals(we.id).toArray()
          if (sets.length === 0) continue
          const maxKg = Math.max(...sets.map(s => s.kg || 0))
          if (maxKg > 0) {
            const d = new Date(w.date)
            strengthPoints.push({
              label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
              kg: maxKg,
            })
          }
        }

        if (strengthPoints.length > 0) {
          bestExercise = exRecord?.name || 'Exercise'
          bestData = strengthPoints
          setHasStrengthData(true)
        } else {
          setHasStrengthData(false)
        }
      } else {
        setHasStrengthData(false)
      }
    } else {
      setHasStrengthData(false)
    }

    setStrengthExercise(bestExercise ? { name: bestExercise, data: bestData } : null)

    // ── Heatmap: last 56 days (8 weeks × 7 days) ────────────────────────────
    const workoutDays = new Set(
      (await db.workouts.toArray()).map(w => toDateStr(w.date))
    )
    const heatCells = []
    for (let i = 55; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = toDateStr(d)
      heatCells.push({ dateStr: key, count: workoutDays.has(key) ? 1 : 0 })
    }
    setHeatmapData(heatCells)
    setTimeout(() => setHeatVisible(true), 80)

    // ── Draw charts ──────────────────────────────────────────────────────────
    drawCharts(
      bestExercise ? { name: bestExercise, data: bestData } : null,
      volumeData
    )
  }

  function drawCharts(strengthEx, volumeData) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b5cf6'
    const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    const textColor = dark ? '#a0a0b8' : '#555568'
    const basePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-base')) || 15
    const tickSize = Math.round(basePx * 0.733) // ~0.733rem, matches .timer-label scale

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: tickSize } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: tickSize } } },
      },
      elements: { point: { radius: 4, hoverRadius: 6 } },
    }

    // Strength chart
    strengthChart.current?.destroy()
    strengthChart.current = null
    if (strengthRef.current && strengthEx && strengthEx.data.length > 0) {
      strengthChart.current = new Chart(strengthRef.current, {
        type: 'line',
        data: {
          labels: strengthEx.data.map(d => d.label),
          datasets: [{
            data: strengthEx.data.map(d => d.kg),
            borderColor: accent,
            backgroundColor: hexToRgba(accent, 0.15),
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointBackgroundColor: accent,
          }],
        },
        options: {
          ...baseOpts,
          scales: {
            ...baseOpts.scales,
            y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => v + ' kg' } },
          },
        },
      })
    }

    // Volume chart
    volumeChart.current?.destroy()
    volumeChart.current = null
    if (volumeRef.current && volumeData.length > 0) {
      volumeChart.current = new Chart(volumeRef.current, {
        type: 'bar',
        data: {
          labels: volumeData.map(d => d.label),
          datasets: [{
            data: volumeData.map(d => d.vol),
            backgroundColor: hexToRgba(accent, 0.55),
            borderColor: accent,
            borderWidth: 1.5,
            borderRadius: 6,
          }],
        },
        options: {
          ...baseOpts,
          scales: {
            ...baseOpts.scales,
            y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: v => v + ' kg' } },
          },
        },
      })
    }
  }

  useEffect(() => {
    return () => {
      strengthChart.current?.destroy()
      volumeChart.current?.destroy()
    }
  }, [])

  // Count workouts per day for heatmap intensity
  function heatLevel(count) {
    if (count === 0) return 0
    return 1 // currently 0 or 1 workouts per day; extend if needed
  }

  return (
    <div style="display:flex;flex-direction:column;flex:1;min-height:0;">
      <div class="topbar">
        <div class="topbar-title">Progress</div>
        <div class="topbar-actions">
          <div class="filter-chips" style="gap:6px;">
            {PERIODS.map((p, i) => (
              <button
                key={p.label}
                class={`chip${i === periodIdx ? ' active' : ''}`}
                style="padding:4px 10px;"
                onClick={() => { setPeriodIdx(i); setHeatVisible(false) }}
              >{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div class="screen-scroll">
        <div class="page-content">

          {/* Strength chart */}
          <div class="card">
            <div class="section-header">
              <div class="section-title">
                {strengthExercise ? `Strength — ${strengthExercise.name}` : 'Strength'}
              </div>
            </div>
            {hasStrengthData ? (
              <div class="chart-container"><canvas ref={strengthRef}></canvas></div>
            ) : (
              <div style="text-align:center;padding:32px 16px;color:var(--text2);font-size:0.867rem;">
                No strength data yet. Complete some workouts to see your progress.
              </div>
            )}
          </div>

          {/* Volume chart */}
          <div class="card">
            <div class="section-header">
              <div class="section-title">Weekly Volume</div>
            </div>
            {hasVolumeData ? (
              <div class="chart-container"><canvas ref={volumeRef}></canvas></div>
            ) : (
              <div style="text-align:center;padding:32px 16px;color:var(--text2);font-size:0.867rem;">
                No volume data yet. Complete some workouts to see your weekly totals.
              </div>
            )}
          </div>

          {/* Heatmap */}
          <div class="card">
            <div class="section-header">
              <div class="section-title">Workout Frequency</div>
              <span class="badge badge-gray">Last 8 weeks</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style="flex:1;text-align:center;font-size:0.667rem;color:var(--text3);">{d}</div>
              ))}
            </div>
            <div class="heatmap">
              {heatmapData.map((cell, i) => (
                <div
                  key={i}
                  class={`heatmap-cell${cell.count > 0 ? ' hm-3' : ''}${heatVisible ? ' visible' : ''}`}
                  style={heatVisible ? { transitionDelay: (i * 10) + 'ms' } : {}}
                  title={cell.dateStr}
                ></div>
              ))}
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:10px;justify-content:flex-end;">
              <span style="font-size:0.733rem;color:var(--text3);">Rest</span>
              <div class="heatmap-cell visible" style="width:12px;height:12px;opacity:1;transform:none;transition:none;"></div>
              <div class="heatmap-cell hm-3 visible" style="width:12px;height:12px;opacity:1;transform:none;transition:none;"></div>
              <span style="font-size:0.733rem;color:var(--text3);">Trained</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
