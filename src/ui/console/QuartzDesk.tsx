import { useState } from 'react'
import { useShowStore } from '../../store/showStore'
import { useSelectedValue, useSelectionFunctions } from './useSelectedValue'

/**
 * Avolites Quartz — faithful control surface (work in progress).
 *
 * Laid out like the real desk (see the Tartanga photo): a touchscreen strip for
 * fixtures/groups, the three wheels, the attribute + program key banks, the ten
 * playback faders and the keypad / transport with Go and Locate. Essentials are
 * wired to the shared show core; keys we haven't implemented yet are shown but
 * inert (dimmed, with a tooltip) so the panel already reads like the machine.
 */

// Each attribute maps the 3 wheels to channel functions (first present wins).
const ATTRIBUTES: { name: string; color: string; wheels: string[][] }[] = [
  { name: 'Intensity', color: 'var(--at-intensity)', wheels: [['dimmer']] },
  { name: 'Position', color: 'var(--at-position)', wheels: [['pan'], ['tilt']] },
  { name: 'Colour', color: 'var(--at-colour)', wheels: [['red', 'colorWheel'], ['green'], ['blue', 'white']] },
  { name: 'Gobo', color: 'var(--at-gobo)', wheels: [['gobo'], ['goboRotation']] },
  { name: 'Beam', color: 'var(--at-beam)', wheels: [['prism'], ['shutter'], ['zoom', 'focus']] },
  { name: 'Effect', color: 'var(--ink-3)', wheels: [] },
  { name: 'Special', color: 'var(--ink-3)', wheels: [] },
]

const PROGRAM_KEYS_TOP = ['Record', 'Update', 'Edit', 'Select If', 'Patch', 'Disk']
const PROGRAM_KEYS_BOT = ['Delete', 'Copy', 'Move', 'Unfold', 'Include', 'Release']
const KEYPAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'Enter']

function Wheel({ label, fn }: { label: string; fn: string }) {
  const value = useSelectedValue(fn)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const angle = (value / 255) * 270 - 135
  return (
    <div className="qd-wheel">
      <div className="qd-dial">
        <span className="qd-dial-tick" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        aria-label={label}
        onChange={(e) => setByFn(fn, Number(e.target.value))}
      />
      <div className="qd-wheel-cap">{label}</div>
      <div className="qd-wheel-val">{value}</div>
    </div>
  )
}

export function QuartzDesk() {
  const [attr, setAttr] = useState('Intensity')
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const recordCue = useShowStore((s) => s.recordCue)
  const cues = useShowStore((s) => s.cues)
  const activeCueId = useShowStore((s) => s.activeCueId)
  const goCue = useShowStore((s) => s.goCue)
  const present = useSelectionFunctions()

  const active = ATTRIBUTES.find((a) => a.name === attr) ?? ATTRIBUTES[0]
  const wheels = active.wheels
    .map((cands) => cands.find((fn) => present.has(fn)))
    .filter((fn): fn is string => !!fn)
  const noSel = selection.length === 0

  const goNext = () => {
    if (cues.length === 0) return
    const idx = cues.findIndex((c) => c.id === activeCueId)
    goCue(cues[(idx + 1) % cues.length].id)
  }

  return (
    <div className="qd">
      {/* Touchscreen strip: fixtures/groups selection */}
      <div className="qd-screen">
        <div className="qd-screen-head">
          <span className="qd-brand">Avolites Quartz</span>
          <span className="qd-titan">powered by Titan</span>
          <span className="qd-wip">WIP</span>
        </div>
        <div className="qd-fixtures">
          {show.fixtures.length === 0 ? (
            <span className="qd-muted">Patch fixtures first.</span>
          ) : (
            show.fixtures.map((pf) => (
              <button
                key={pf.id}
                className={`qd-fx${selection.includes(pf.id) ? ' sel' : ''}`}
                onClick={() => toggleSelect(pf.id)}
              >
                <span className="qd-fx-name">{pf.name}</span>
                <span className="qd-fx-def">{definitions[pf.definitionId]?.model}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Hardware */}
      <div className="qd-hw">
        {/* LEFT: attribute + program keys */}
        <div className="qd-col qd-left">
          <div className="qd-caplabel">Attributes</div>
          <div className="qd-attrs">
            {ATTRIBUTES.map((a) => (
              <button
                key={a.name}
                className={`qd-key qd-attr${a.name === attr ? ' on' : ''}`}
                style={{ ['--k' as string]: a.color }}
                onClick={() => setAttr(a.name)}
              >
                {a.name}
              </button>
            ))}
          </div>

          <div className="qd-caplabel">Program</div>
          <div className="qd-prog">
            {PROGRAM_KEYS_TOP.map((k) => (
              <button
                key={k}
                className={`qd-key${k === 'Record' ? ' rec' : ' inert'}`}
                title={k === 'Record' ? 'Record a cue' : 'Coming soon'}
                onClick={k === 'Record' ? recordCue : undefined}
              >
                {k}
              </button>
            ))}
            {PROGRAM_KEYS_BOT.map((k) => (
              <button key={k} className="qd-key inert" title="Coming soon">
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: wheels + faders */}
        <div className="qd-col qd-center">
          <div className="qd-wheels">
            {noSel ? (
              <span className="qd-muted">Select fixtures to drive the wheels.</span>
            ) : wheels.length === 0 ? (
              <span className="qd-muted">No {attr.toLowerCase()} control on this fixture.</span>
            ) : (
              wheels.map((fn) => <Wheel key={fn} fn={fn} label={fn} />)
            )}
          </div>

          <div className="qd-caplabel">Playback</div>
          <div className="qd-faders">
            {Array.from({ length: 10 }, (_, i) => {
              const cue = cues[i]
              const on = cue && cue.id === activeCueId
              return (
                <div className="qd-fader" key={i}>
                  <button
                    className={`qd-flash${on ? ' on' : ''}${cue ? '' : ' empty'}`}
                    title={cue ? `Fire ${cue.name}` : 'Empty playback'}
                    onClick={() => cue && goCue(cue.id)}
                  >
                    {i + 1}
                  </button>
                  <input type="range" min={0} max={255} defaultValue={cue ? 255 : 0} disabled={!cue} />
                  <span className="qd-fader-cap">{cue ? cue.name.replace('Cue ', 'Q') : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: keypad + transport */}
        <div className="qd-col qd-right">
          <div className="qd-transport">
            <button className="qd-key inert" title="Coming soon">Prev Cue</button>
            <button className="qd-key inert" title="Coming soon">Next Cue</button>
            <button className="qd-key go" title="Go to next cue" onClick={goNext}>
              Go
            </button>
          </div>

          <div className="qd-selkeys">
            {['Fixture', 'Palette', 'Macro', 'Group'].map((k) => (
              <button key={k} className="qd-key inert" title="Coming soon">
                {k}
              </button>
            ))}
          </div>

          <div className="qd-keypad">
            {KEYPAD.map((k) => (
              <button key={k} className="qd-key inert num" title="Coming soon">
                {k}
              </button>
            ))}
          </div>

          <div className="qd-bigkeys">
            <button className="qd-key locate" title="Locate selected" disabled={noSel} onClick={locateSelected}>
              Locate
            </button>
            <button className="qd-key clear" title="Clear the programmer" onClick={clearProgrammer}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
