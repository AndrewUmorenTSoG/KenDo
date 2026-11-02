import { describe, presetOf, ruleFor, WEEKDAY_NAMES, type Preset } from '../lib/recurrence'
import type { Recurrence } from '../lib/types'

const presets: [Preset, string][] = [
  ['never', 'Does not repeat'],
  ['daily', 'Every day'],
  ['weekdays', 'Weekdays (Mon–Fri)'],
  ['weekly', 'Weekly, on chosen days'],
  ['fortnightly', 'Every two weeks'],
  ['monthly', 'Monthly'],
  ['custom', 'Custom…'],
]

interface Props {
  rule: Recurrence | null
  date: string
  onChange: (rule: Recurrence | null) => void
  // Pausing only makes sense for a series that already exists.
  canPause: boolean
}

// How often a task repeats, when it stops, and a plain summary of the result.
export default function RepeatPicker({ rule, date, onChange, canPause }: Props) {
  const preset = presetOf(rule)
  const showDays = rule?.unit === 'week' && preset !== 'weekdays'
  const set = (changes: Partial<Recurrence>) => rule && onChange({ ...rule, ...changes })

  function toggleDay(day: number) {
    if (!rule) return
    const days = new Set(rule.weekdays ?? [])
    if (days.has(day)) days.delete(day)
    else days.add(day)
    set({ weekdays: [...days].sort((a, b) => a - b) })
  }

  return (
    <div className="repeat-picker">
      <div className="field">
        <label htmlFor="f-repeat">Repeat</label>
        <select
          id="f-repeat"
          value={preset}
          disabled={!date}
          onChange={(e) => onChange(ruleFor(e.target.value as Preset, date, rule))}
        >
          {presets.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {rule && preset === 'custom' && (
        <div className="repeat-every">
          <label htmlFor="f-every">Every</label>
          <input
            id="f-every"
            type="number"
            min={1}
            max={52}
            value={rule.every}
            onChange={(e) => set({ every: Math.min(52, Math.max(1, Number(e.target.value) || 1)) })}
          />
          <select aria-label="Repeat unit" value={rule.unit} onChange={(e) => set({ unit: e.target.value as Recurrence['unit'] })}>
            <option value="day">{rule.every === 1 ? 'day' : 'days'}</option>
            <option value="week">{rule.every === 1 ? 'week' : 'weeks'}</option>
            <option value="month">{rule.every === 1 ? 'month' : 'months'}</option>
          </select>
        </div>
      )}

      {rule && showDays && (
        <div className="weekday-toggles" role="group" aria-label="Repeat on">
          {WEEKDAY_NAMES.map((name, day) => (
            <button
              key={name}
              type="button"
              aria-pressed={!!rule.weekdays?.includes(day)}
              aria-label={name}
              onClick={() => toggleDay(day)}
            >
              {name.slice(0, 2)}
            </button>
          ))}
        </div>
      )}

      {rule && (
        <div className="repeat-end">
          <label className="repeat-check">
            <input type="checkbox" checked={!!rule.end} onChange={(e) => set({ end: e.target.checked ? date : null })} />
            Ends on
          </label>
          {rule.end && (
            <input
              type="date"
              aria-label="Last date"
              min={date}
              value={rule.end}
              onChange={(e) => set({ end: e.target.value || null })}
            />
          )}
          {canPause && (
            <label className="repeat-check">
              <input type="checkbox" checked={!!rule.paused} onChange={(e) => set({ paused: e.target.checked })} />
              Pause
            </label>
          )}
        </div>
      )}

      {rule && (
        <p className="repeat-summary" aria-live="polite">
          {rule.unit === 'week' && !rule.weekdays?.length ? 'Choose at least one day.' : describe(rule)}
          {rule.paused && ' No new ones until you resume it.'}
        </p>
      )}
    </div>
  )
}
