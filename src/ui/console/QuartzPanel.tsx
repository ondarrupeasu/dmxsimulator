import { useShowStore } from '../../store/showStore'
import { useSelectedValue, useSelectionFunctions } from './useSelectedValue'

/**
 * Avolites Quartz — faithful button panel (a "calco" of the physical surface).
 * Key colours match the real desk: charcoal (`qk-dark`), cream (default `qk`), red
 * (`qk-red`), blue-LED (executors / flash). Sizes are fixed so lighting an LED or
 * selecting fixtures never reflows the layout.
 */

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
const EXEC_LEGENDS: Record<number, string> = {
  11: 'Attr Editor', 12: 'Show Lib', 13: 'Playbacks', 14: 'Chan Grid', 15: 'Visualiser',
  16: 'Groups+Pal', 17: 'Fix+Groups', 18: 'Snap',
}

function Key({
  children, lit, dark, red, disabled, title, onClick,
}: {
  children: React.ReactNode
  lit?: boolean
  dark?: boolean
  red?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      className={`qk${dark ? ' qk-dark' : ''}${lit ? ' lit' : ''}${red ? ' qk-red' : ''}`}
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
      <input type="range" min={0} max={255} value={value} aria-label={label}
        onChange={(e) => setByFn(fn, Number(e.target.value))} />
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
  const copyCue = useShowStore((s) => s.copyCue)
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
  const wheelLabels = ['A', 'B', 'C']

  const goRel = (dir: 1 | -1) => {
    if (cues.length === 0) return
    const idx = cues.findIndex((c) => c.id === activeCueId)
    const next = idx < 0 ? (dir > 0 ? 0 : cues.length - 1) : (idx + dir + cues.length) % cues.length
    goCue(cues[next].id)
  }
  // Program keys: [label, dark?, handler?, enabled?]
  const programRow1: [string, boolean][] = [['Record', true], ['Update', false], ['Edit', false], ['Select If', false], ['Patch', false], ['Disk', false]]
  const programRow2: [string, boolean][] = [['Delete', true], ['Copy', false], ['Move', false], ['Unfold', false], ['Include', false], ['Release', false]]
  const prog: Record<string, { fn: () => void; enabled: boolean }> = {
    Record: { fn: recordCue, enabled: hasProgrammer },
    Update: { fn: () => activeCueId && updateCue(activeCueId), enabled: !!activeCueId && hasProgrammer },
    Copy: { fn: () => activeCueId && copyCue(activeCueId), enabled: !!activeCueId },
    Delete: { fn: () => activeCueId && deleteCue(activeCueId), enabled: !!activeCueId },
    Release: { fn: releaseCue, enabled: !!activeCueId },
  }
  const progKey = ([label, dark]: [string, boolean]) => {
    const h = prog[label]
    return (
      <button
        key={label}
        className={`qk${dark ? ' qk-dark' : ''}${label === 'Record' ? ' qk-rec' : ''}`}
        disabled={!h || !h.enabled}
        title={h ? label : `${label} (coming soon)`}
        onClick={h?.fn}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="qpanel">
      <div className="qpanel-inner">
        {/* ── TOP: wheels + executor buttons ── */}
        <div className="qp-top">
          <div className="qp-wheelcol">
            <div className="qp-wheels">
              {[0, 1, 2].map((i) =>
                wheels[i] ? (
                  <Wheel key={i} fn={wheels[i]} label={wheels[i]} />
                ) : (
                  <div className="qp-wheel" key={i}>
                    <div className="qp-dial" />
                    <div className="qp-wheel-cap">{wheelLabels[i]}</div>
                  </div>
                ),
              )}
            </div>
            <div className="qp-wheelbtns">
              {wheelLabels.map((w) => (
                <button key={w} className="qk qk-blue" disabled title={`${w} @ (set/centre)`}>
                  {w} @
                </button>
              ))}
            </div>
          </div>
          <div className="qp-exec">
            {Array.from({ length: 20 }, (_, i) => (
              <button key={i} className="qk qk-exec" disabled title={EXEC_LEGENDS[i + 1] ?? `Executor ${i + 1}`}>
                <span className="qk-led-top" />
                <span className="qk-num">{i + 1}</span>
                <span className="qk-led-bot" />
                {EXEC_LEGENDS[i + 1] && <span className="qk-leg">{EXEC_LEGENDS[i + 1]}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── MIDDLE: fix keys + attribute bank + program + utilities ── */}
        <div className="qp-mid">
          <div className="qp-fixcol">
            <Key dark disabled title="Fixture −1">Fix −1</Key>
            <Key dark disabled title="Fixture +1">Fix +1</Key>
            <Key dark disabled title="All">All</Key>
            <Key dark disabled title="Hi Light">Hi Light</Key>
          </div>

          <div className="qp-attrblock">
            <div className="qp-attr-row">
              {ATTRIBUTES.map((a) => (
                <button key={a.name} className={`qk qk-attr${a.name === attr ? ' lit' : ''}`}
                  style={{ ['--k' as string]: a.color }} onClick={() => setAttr(a.name)}>
                  {a.name}
                </button>
              ))}
            </div>
            <div className="qp-attr-row">
              {ATTR_ROW2.map((k) =>
                k === 'Shape' ? (
                  <Key key={k} title="Shapes / Effects window" onClick={() => setScreen('effects')}>Shape</Key>
                ) : (
                  <Key key={k} disabled title={`${k} (coming soon)`}>{k}</Key>
                ),
              )}
            </div>
          </div>

          <div className="qp-progblock">
            {programRow1.map(progKey)}
            {programRow2.map(progKey)}
          </div>

          <div className="qp-utilblock">
            <Key dark disabled title="Min / Max">Min/Max</Key>
            <Key dark disabled title="Size / Position">Size/Pos</Key>
            <Key dark disabled title="View / Open">View</Key>
            <Key dark disabled title="Close / Control">Close</Key>
          </div>
        </div>

        {/* ── BOTTOM: faders + page + transport + keypad ── */}
        <div className="qp-bot">
          <div className="qp-faderblock">
            <div className="qp-faders">
              {Array.from({ length: 10 }, (_, i) => {
                const gi = playbackPage * 10 + i
                const cue = cues[gi]
                const on = cue && cue.id === activeCueId
                return (
                  <div className="qp-fader" key={i}>
                    <button className={`qp-flash${on ? ' on' : ''}${cue ? '' : ' empty'}`}
                      title={cue ? `Fire ${cue.name}` : 'Empty playback'} onClick={() => cue && goCue(cue.id)}>
                      {gi + 1}
                    </button>
                    <input type="range" min={0} max={255} defaultValue={cue ? 255 : 0} disabled={!cue} />
                  </div>
                )
              })}
            </div>
            <div className="qp-pagecol">
              <div className="qp-pagerow">
                <Key disabled title="Previous page" onClick={() => setPlaybackPage(Math.max(0, playbackPage - 1))}>− Page</Key>
                <Key disabled title="Go Page">Go Page</Key>
              </div>
              <Key title="Next page" onClick={() => setPlaybackPage(playbackPage + 1)}>+ Page</Key>
              <span className="qp-pagen">Pg {playbackPage + 1}</span>
              <span className="qp-logo">avolites</span>
            </div>
          </div>

          <div className="qp-cluster">
            <div className="qp-selrow">
              <Key dark title="Fixtures window" onClick={() => setScreen('fixtures')}>Fixture</Key>
              <Key dark title="Palettes window" onClick={() => setScreen('colour')}>Palette</Key>
              <Key dark disabled title="Macro">Macro</Key>
              <Key dark disabled title="Group">Group</Key>
            </div>

            <div className="qp-lower">
              <div className="qp-transport2">
                <div className="qp-tgrid">
                  <Key disabled title="Live Time">Live Time</Key>
                  <Key disabled title="Next Time">Next Time</Key>
                  <Key disabled={!cues.length} title="Previous cue" onClick={() => goRel(-1)}>Prev Cue</Key>
                  <Key disabled={!cues.length} title="Next cue" onClick={() => goRel(1)}>Next Cue</Key>
                  <Key dark disabled title="Connect / Cue">Connect</Key>
                  <Key dark disabled title="Stop">Stop</Key>
                </div>
                <button className="qk qk-go" disabled={!cues.length} title="Go" onClick={() => goRel(1)}>Go</button>
              </div>

              <div className="qp-keypadblock">
                <div className="qp-numpad">
                  <Key disabled title="1">1</Key>
                  <Key disabled title="2">2</Key>
                  <Key disabled title="3">3</Key>
                  <Key disabled title="Time">Time</Key>
                  <Key disabled title="4">4</Key>
                  <Key disabled title="5">5</Key>
                  <Key disabled title="6">6</Key>
                  <Key title="Clear the programmer" onClick={clearProgrammer}>Clear</Key>
                  <Key disabled title="7">7</Key>
                  <Key disabled title="8">8</Key>
                  <Key disabled title="9">9</Key>
                  <button className="qk qk-red qk-locate" disabled={noSel} title="Locate selected" onClick={locateSelected}>Locate</button>
                  <Key disabled title="Exit">Exit</Key>
                  <Key disabled title="0">0</Key>
                  <Key disabled title="Enter">Enter</Key>
                  <Key disabled title=".">.</Key>
                </div>
                <div className="qp-atrow">
                  <Key dark disabled title="Back / Undo">Back</Key>
                  <Key dark disabled title="Through">Thru</Key>
                  <Key dark disabled title="And">And</Key>
                  <Key dark disabled title="At (@)">@</Key>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
