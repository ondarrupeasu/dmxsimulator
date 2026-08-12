import { useShowStore } from '../../store/showStore'
import type { EffectType } from '../../engine/effects'

const TYPE_LABELS: Record<EffectType, string> = {
  circle: 'Pan/Tilt circle',
  colourCycle: 'Colour cycle',
  dimmerWave: 'Dimmer wave',
}

function FxSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="fx-row">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="num">{format ? format(value) : value}</span>
    </div>
  )
}

/** Create + tune effects (Avolites "shapes"): add one on the current selection,
 *  then adjust its speed / size / spread live. */
export function EffectsPanel() {
  const effects = useShowStore((s) => s.effects)
  const addEffect = useShowStore((s) => s.addEffect)
  const updateEffect = useShowStore((s) => s.updateEffect)
  const removeEffect = useShowStore((s) => s.removeEffect)
  const selCount = useShowStore((s) => s.selection.length)

  return (
    <div className="fx-panel">
      <div className="section-label">Effects (shapes)</div>
      <div className="fx-add">
        {(['circle', 'colourCycle', 'dimmerWave'] as EffectType[]).map((tp) => (
          <button key={tp} disabled={!selCount} onClick={() => addEffect(tp)} title={selCount ? '' : 'Select fixtures first'}>
            ＋ {TYPE_LABELS[tp]}
          </button>
        ))}
      </div>
      {effects.length === 0 && (
        <div className="prog-empty">
          {selCount ? 'Add a shape above — it runs on your selection.' : 'Select fixtures, then add a shape.'}
        </div>
      )}
      {effects.map((e) => (
        <div className="fx-card" key={e.id}>
          <div className="fx-head">
            <span className="fx-type">{TYPE_LABELS[e.type]}</span>
            <span className="fx-meta">{e.fixtureIds.length} fixtures</span>
            <button className="fx-del" title="Remove effect" onClick={() => removeEffect(e.id)}>
              ✕
            </button>
          </div>
          <FxSlider
            label="Speed"
            value={e.speed}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${v.toFixed(2)} Hz`}
            onChange={(v) => updateEffect(e.id, { speed: v })}
          />
          {e.type === 'circle' && (
            <FxSlider
              label="Size"
              value={e.size}
              min={0}
              max={127}
              step={1}
              onChange={(v) => updateEffect(e.id, { size: v })}
            />
          )}
          <FxSlider
            label="Spread"
            value={e.spread}
            min={0}
            max={6.28}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => updateEffect(e.id, { spread: v })}
          />
        </div>
      ))}
    </div>
  )
}
