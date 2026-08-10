import { useShowStore } from '../../store/showStore'
import { useSelectedValue, useSelectionFunctions } from './useSelectedValue'

/**
 * Avolites Quartz — faithful button panel (a "calco" of the physical surface).
 * Every key is laid out roughly where it sits on the real desk; the ones we've
 * implemented are wired, the rest are present but inert. Keys that represent a
 * state light a blue LED when active, like the real console.
 */

// Attribute → which channel functions the 3 wheels drive (first present wins).
const ATTRIBUTES: { name: string; color: string; wheels: string[][] }[] = [
  { name: 'Intensity', color: 'var(--at-intensity)', wheels: [['dimmer']] },
  { name: 'Position', color: 'var(--at-position)', wheels: [['pan'], ['tilt']] },
  { name: 'Colour', color: 'var(--at-colour)', wheels: [['red', 'colorWheel'], ['green'], ['blue', 'white']] },
  { name: 'Gobo', color: 'var(--at-gobo)', wheels: [['gobo'], ['goboRotation']] },
  { name: 'Beam', color: 'var(--at-beam)', wheels: [['prism'], ['shutter'], ['zoom', 'focus']] },
  { name: 'Effect', color: 'var(--ink-3)', wheels: [] },
  { name: 'Special', color: 'var(--ink-3)', wheels: [] },
]
const ATTR_ROW2 = ['Shape', 'ML Menu', 'Blind', 'Off', 'Fan', 'Options', 'Latch']
const PROGRAM_TOP = ['Record', 'Update', 'Edit', 'Select If', 'Patch', 'Disk']
const PROGRAM_BOT = ['Delete', 'Copy', 'Move', 'Unfold', 'Include', 'Release']
const EXEC_LEGENDS: Record<number, string> = {
  11: 'Attr Editor',
  12: 'Show Lib',
  13: 'Playbacks',
  14: 'Chan Grid',
  15: 'Visualiser',
  16: 'Groups+Pal',
  17: 'Fix+Groups',
  18: 'Snap',
}

/** Generic physical key. */
function Key({
  children,
  lit,
  red,
  disabled,
  title,
  onClick,
}: {
  children: React.ReactNode
  lit?: boolean
  red?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      className={`qk${lit ? ' lit' : ''}${red ? ' qk-red' : ''}`}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Wheel({ label, fn }: { label: string; fn: string }) {
  const value = useSelectedValue(fn)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const angle = (value / 255) * 270 - 135
  return (
    <div className="qp-wheel">
      <div className="qp-dial">
        <span className="qp-dial-tick" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        aria-label={label}
        onChange={(e) => setByFn(fn, Number(e.target.value))}
      />
      <div className="qp-wheel-cap">{label}</div>
    </div>
  )
}

export function QuartzPanel() {
  const attr = useShowStore((s) => s.deskAttr)
  const setAttr = useShowStore((s) => s.setDeskAttr)
  const setScreen = useShowStore((s) => s.setDeskScreen)
  const selection = useShowStore((s) => s.selection)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const recordCue = useShowStore((s) => s.recordCue)
  const updateCue = useShowStore((s) => s.updateCue)
  const deleteCue = useShowStore((s) => s.deleteCue)
  const releaseCue = useShowStore((s) => s.releaseCue)
  const cues = useShowStore((s) => s.cues)
  const activeCueId = useShowStore((s) => s.activeCueId)
  const goCue = useShowStore((s) => s.goCue)
  const playbackPage = useShowStore((s) => s.playbackPage)
  const setPlaybackPage = useShowStore((s) => s.setPlaybackPage)
  const hasProgrammer = useShowStore((s) => Object.keys(s.programmer).length > 0)
  const present = useSelectionFunctions()

  const active = ATTRIBUTES.find((a) => a.name === attr) ?? ATTRIBUTES[0]
  const wheels = active.wheels
    .map((cands) => cands.find((fn) => present.has(fn)))
    .filter((fn): fn is string => !!fn)
  const noSel = selection.length === 0

  const goRel = (dir: 1 | -1) => {
    if (cues.length === 0) return
    const idx = cues.findIndex((c) => c.id === activeCueId)
    const next = idx < 0 ? (dir > 0 ? 0 : cues.length - 1) : (idx + dir + cues.length) % cues.length
    goCue(cues[next].id)
  }
  const prog: Record<string, { fn: () => void; enabled: boolean }> = {
    Record: { fn: recordCue, enabled: hasProgrammer },
    Update: { fn: () => activeCueId && updateCue(activeCueId), enabled: !!activeCueId && hasProgrammer },
    Delete: { fn: () => activeCueId && deleteCue(activeCueId), enabled: !!activeCueId },
    Release: { fn: releaseCue, enabled: !!activeCueId },
  }

  return (
    <div className="qpanel">
      {/* ── TOP: wheels + executor buttons ── */}
      <div className="qp-top">
        <div className="qp-wheels">
          {noSel || wheels.length === 0 ? (
            <>
              <div className="qp-wheel dim"><div className="qp-dial" /><div className="qp-wheel-cap">A</div></div>
              <div className="qp-wheel dim"><div className="qp-dial" /><div className="qp-wheel-cap">B</div></div>
              <div className="qp-wheel dim"><div className="qp-dial" /><div className="qp-wheel-cap">C</div></div>
            </>
          ) : (
            wheels.map((fn) => <Wheel key={fn} fn={fn} label={fn} />)
          )}
        </div>
        <div className="qp-exec">
          {Array.from({ length: 20 }, (_, i) => (
            <button key={i} className="qk qk-exec" disabled title={EXEC_LEGENDS[i + 1] ?? `Executor ${i + 1}`}>
              <span className="qk-num">{i + 1}</span>
              {EXEC_LEGENDS[i + 1] && <span className="qk-leg">{EXEC_LEGENDS[i + 1]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── MIDDLE: attribute bank + program keys + utilities ── */}
      <div className="qp-mid">
        <div className="qp-fixcol">
          <Key disabled title="Fixture −1">Fix −1</Key>
          <Key disabled title="Fixture +1">Fix +1</Key>
          <Key disabled title="All">All</Key>
          <Key disabled title="Hi Light">Hi Light</Key>
        </div>

        <div className="qp-attrblock">
          <div className="qp-attr-row">
            {ATTRIBUTES.map((a) => (
              <button
                key={a.name}
                className={`qk qk-attr${a.name === attr ? ' lit' : ''}`}
                style={{ ['--k' as string]: a.color }}
                onClick={() => setAttr(a.name)}
              >
                {a.name}
              </button>
            ))}
          </div>
          <div className="qp-attr-row">
            {ATTR_ROW2.map((k) => (
              <button key={k} className="qk" disabled title={`${k} (coming soon)`}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="qp-progblock">
          {[...PROGRAM_TOP, ...PROGRAM_BOT].map((k) => {
            const h = prog[k]
            if (!h) return <Key key={k} disabled title={`${k} (coming soon)`}>{k}</Key>
            return (
              <button
                key={k}
                className={`qk${k === 'Record' ? ' qk-rec' : ''}`}
                disabled={!h.enabled}
                title={k}
                onClick={h.fn}
              >
                {k}
              </button>
            )
          })}
        </div>

        <div className="qp-utilblock">
          <Key disabled title="Min / Max">Min/Max</Key>
          <Key disabled title="Size / Position">Size/Pos</Key>
          <Key disabled title="View / Open">View</Key>
          <Key disabled title="Close / Control">Close</Key>
        </div>
      </div>

      {/* ── BOTTOM: faders + page + cue/keypad cluster ── */}
      <div className="qp-bot">
        <div className="qp-faderblock">
          <div className="qp-faders">
            {Array.from({ length: 10 }, (_, i) => {
              const gi = playbackPage * 10 + i
              const cue = cues[gi]
              const on = cue && cue.id === activeCueId
              return (
                <div className="qp-fader" key={i}>
                  <button
                    className={`qp-flash${on ? ' on' : ''}${cue ? '' : ' empty'}`}
                    title={cue ? `Fire ${cue.name}` : 'Empty playback'}
                    onClick={() => cue && goCue(cue.id)}
                  >
                    {gi + 1}
                  </button>
                  <input type="range" min={0} max={255} defaultValue={cue ? 255 : 0} disabled={!cue} />
                  <span className="qp-fader-cap">{cue ? cue.name.replace('Cue ', 'Q') : '—'}</span>
                </div>
              )
            })}
          </div>
          <div className="qp-pagecol">
            <Key disabled={playbackPage === 0} title="Previous page" onClick={() => setPlaybackPage(playbackPage - 1)}>
              − Page
            </Key>
            <span className="qp-pagen">Pg {playbackPage + 1}</span>
            <Key title="Next page" onClick={() => setPlaybackPage(playbackPage + 1)}>+ Page</Key>
            <span className="qp-logo">avolites</span>
          </div>
        </div>

        <div className="qp-cluster">
          <div className="qp-selrow">
            <Key title="Fixtures window" onClick={() => setScreen('fixtures')}>Fixture</Key>
            <Key title="Palettes window" onClick={() => setScreen('colour')}>Palette</Key>
            <Key disabled title="Macro">Macro</Key>
            <Key disabled title="Group">Group</Key>
          </div>

          <div className="qp-transport">
            <div className="qp-tcol">
              <Key disabled={!cues.length} title="Previous cue" onClick={() => goRel(-1)}>Prev Cue</Key>
              <Key disabled={!cues.length} title="Next cue" onClick={() => goRel(1)}>Next Cue</Key>
            </div>
            <button className="qk qk-go" disabled={!cues.length} title="Go" onClick={() => goRel(1)}>
              Go
            </button>
          </div>

          <div className="qp-keyzone">
            <div className="qp-numpad">
              {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'Enter'].map((k) => (
                <Key key={k} disabled title={`${k} (command syntax — coming soon)`}>{k}</Key>
              ))}
            </div>
            <div className="qp-sidekeys">
              <Key disabled title="Time">Time</Key>
              <Key disabled title="Clear (numeric)">Clr</Key>
              <button className="qk qk-red qk-locate" disabled={noSel} title="Locate selected" onClick={locateSelected}>
                Locate
              </button>
              <Key title="Clear the programmer" onClick={clearProgrammer}>Clear</Key>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
