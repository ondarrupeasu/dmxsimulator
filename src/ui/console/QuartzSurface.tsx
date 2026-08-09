import { useState } from 'react'
import { useShowStore } from '../../store/showStore'
import { useSelectedValue, useSelectionFunctions } from './useSelectedValue'

/**
 * Avolites Quartz — faithful surface (work in progress).
 *
 * Mirrors the Quartz's real workflow: programmer keys (Locate/Clear), an
 * attribute bank (Intensity/Position/Colour/Gobo/Beam) that re-targets the three
 * wheels, quick colour palettes, and the 10 playback faders. Encoders and Locate
 * already drive the show; palettes/cues on the playback deck arrive with the
 * cue-list engine.
 */

// Each attribute maps the 3 wheels to channel functions (first present wins).
const ATTRIBUTES: { name: string; wheels: string[][] }[] = [
  { name: 'Intensity', wheels: [['dimmer']] },
  { name: 'Position', wheels: [['pan'], ['tilt']] },
  { name: 'Colour', wheels: [['red', 'colorWheel'], ['green'], ['blue', 'white']] },
  { name: 'Gobo', wheels: [['gobo'], ['goboRotation']] },
  { name: 'Beam', wheels: [['prism'], ['shutter'], ['zoom', 'focus']] },
]

function Wheel({ label, fn }: { label: string; fn: string }) {
  const value = useSelectedValue(fn)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  return (
    <div className="q-wheel">
      <div className="q-wheel-dial" style={{ ['--v' as string]: `${(value / 255) * 270 - 135}deg` }}>
        <span className="q-wheel-tick" />
      </div>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        onChange={(e) => setByFn(fn, Number(e.target.value))}
      />
      <div className="q-wheel-label">{label}</div>
      <div className="q-wheel-val">{value}</div>
    </div>
  )
}

export function QuartzSurface() {
  const [attr, setAttr] = useState('Intensity')
  const selection = useShowStore((s) => s.selection)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const present = useSelectionFunctions()

  const active = ATTRIBUTES.find((a) => a.name === attr) ?? ATTRIBUTES[0]
  // Resolve each wheel to the first candidate function present in the selection.
  const wheels = active.wheels
    .map((cands) => cands.find((fn) => present.has(fn)))
    .filter((fn): fn is string => !!fn)

  const applyColour = (r: number, g: number, b: number, w = 0) => {
    setByFn('red', r)
    setByFn('green', g)
    setByFn('blue', b)
    setByFn('white', w)
  }

  const disabled = selection.length === 0

  return (
    <div className="panel quartz">
      <header>
        <h2>Avolites Quartz</h2>
        <span className="badge gdtf">WIP</span>
        <span className="sub">{selection.length} selected</span>
      </header>
      <div className="scroll">
        {/* Programmer keys */}
        <div className="q-keys">
          <button className="primary" onClick={locateSelected} disabled={disabled}>
            Locate
          </button>
          <button onClick={clearProgrammer}>Clear</button>
          <button disabled title="Coming soon">
            Off
          </button>
        </div>

        {/* Attribute bank */}
        <div className="section-label">Attribute</div>
        <div className="q-attrs">
          {ATTRIBUTES.map((a) => (
            <button
              key={a.name}
              className={a.name === attr ? 'active' : ''}
              onClick={() => setAttr(a.name)}
            >
              {a.name}
            </button>
          ))}
        </div>

        {/* Wheels / encoders */}
        <div className="q-wheels">
          {disabled ? (
            <div className="prog-empty">Select fixtures to drive the wheels.</div>
          ) : wheels.length === 0 ? (
            <div className="prog-empty">No {attr.toLowerCase()} control on this fixture.</div>
          ) : (
            wheels.map((fn) => <Wheel key={fn} fn={fn} label={fn} />)
          )}
        </div>

        {/* Quick colour palettes */}
        <div className="section-label">Palettes · Colour</div>
        <div className="q-palettes">
          <button style={{ background: '#c0392b' }} onClick={() => applyColour(255, 0, 0)}>
            Red
          </button>
          <button style={{ background: '#27ae60' }} onClick={() => applyColour(0, 255, 0)}>
            Green
          </button>
          <button style={{ background: '#2980b9' }} onClick={() => applyColour(0, 0, 255)}>
            Blue
          </button>
          <button style={{ background: '#7f8c8d' }} onClick={() => applyColour(255, 255, 255, 255)}>
            White
          </button>
          <button onClick={() => applyColour(0, 0, 0)}>Open</button>
        </div>

        {/* Playback deck */}
        <div className="section-label">Playback</div>
        <div className="q-playback">
          {Array.from({ length: 10 }, (_, i) => (
            <div className="q-fader" key={i}>
              <button className="q-flash" disabled title="Cues — coming soon">
                {i + 1}
              </button>
              <input type="range" min={0} max={255} defaultValue={0} disabled />
            </div>
          ))}
        </div>
        <div className="prog-empty" style={{ marginTop: 10 }}>
          Playback faders light up once the cue-list engine lands.
        </div>
      </div>
    </div>
  )
}
