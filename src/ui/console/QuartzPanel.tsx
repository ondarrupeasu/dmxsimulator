import { useState } from 'react'
import { useShowStore } from '../../store/showStore'
import { useSelectedValue, useSelectionFunctions } from './useSelectedValue'

/**
 * Avolites Quartz — self-styled faithful panel (dark theme, matching the app).
 * Positions were traced 1:1 from the desk photo (public/quartz.png, kept behind a
 * toggle for reference). Keys carry their real colour (white / dark grey / red /
 * blue), an LED at the top (bottom for the top flash row) only where the real desk
 * has one, and the silk-screen labels around them.
 */

const IMG_W = 1306
const IMG_H = 919
const L = (px: number) => `${(px / IMG_W) * 100}%`
const T = (px: number) => `${(px / IMG_H) * 100}%`
const clamp = (v: number) => Math.max(0, Math.min(255, v))

const ATTRIBUTES: { name: string; wheels: string[][] }[] = [
  { name: 'Intensity', wheels: [['dimmer']] },
  { name: 'Position', wheels: [['pan'], ['tilt']] },
  { name: 'Colour', wheels: [['red', 'colorWheel'], ['green'], ['blue', 'white']] },
  { name: 'Gobo', wheels: [['gobo'], ['goboRotation']] },
  { name: 'Beam', wheels: [['prism'], ['shutter'], ['zoom', 'focus']] },
  { name: 'Effect', wheels: [] },
  { name: 'Special', wheels: [] },
]

type V = 'white' | 'dark' | 'blue' | 'red'
function Key({
  v = 'dark', led = true, ledColor, ledBottom, on, text, narrow, disabled, title, onClick,
}: {
  v?: V; led?: boolean; ledColor?: 'red'; ledBottom?: boolean; on?: boolean
  text?: string; narrow?: boolean; disabled?: boolean; title?: string; onClick?: () => void
}) {
  return (
    <button
      className={`ck ck-${v}${ledBottom ? ' ledb' : ''}${narrow ? ' narrow' : ''}`}
      disabled={disabled} title={title} onClick={onClick}
    >
      {led && <span className={`ckled${on ? ' on' : ''}${ledColor ? ' ' + ledColor : ''}`} />}
      {text != null && <span className="cktext">{text}</span>}
    </button>
  )
}

function Box({ x, y, w, h, cols, rows, children }: {
  x: number; y: number; w: number; h: number; cols: number; rows: number; children: React.ReactNode
}) {
  return (
    <div className="cal-grid" style={{
      left: L(x), top: T(y), width: L(w), height: T(h),
      gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`,
    }}>{children}</div>
  )
}

/** Silk-screen labels centred over each column of a grid. `subs` = shifted-function
 *  name printed in lighter grey under each label. */
function GridLabels({ x, y, w, cols, items, subs, above }: { x: number; y: number; w: number; cols: number; items: string[]; subs?: string[]; above?: boolean }) {
  const cw = w / cols
  return (
    <>
      {items.map((t, i) => (t || subs?.[i]) ? (
        <div key={i} className={`cal-lbl${above ? ' above' : ''}`} style={{ left: L(x + cw * i), top: T(y), width: L(cw) }}>
          {t.split('\n').map((l, j) => <span key={j}>{l}</span>)}
          {subs?.[i] && <span className="sub">{subs[i]}</span>}
        </div>
      ) : null)}
    </>
  )
}
function Label({ x, y, w, text, sub, align = 'center' }: { x: number; y: number; w: number; text: string; sub?: string; align?: 'center' | 'left' | 'right' }) {
  return (
    <div className="cal-lbl" style={{ left: L(x), top: T(y), width: L(w), textAlign: align, alignItems: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center' }}>
      {text.split('\n').map((l, j) => <span key={j}>{l}</span>)}
      {sub && <span className="sub">{sub}</span>}
    </div>
  )
}

function Wheel({ x, y, d, fn }: { x: number; y: number; d: number; fn: string | undefined }) {
  const value = useSelectedValue(fn ?? '')
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const [spin, setSpin] = useState(0)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!fn) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    let v = value; let lastY = e.clientY
    const move = (ev: PointerEvent) => {
      const dy = lastY - ev.clientY; lastY = ev.clientY
      v = clamp(v + dy * 1.5); setByFn(fn, Math.round(v)); setSpin((s) => s + dy * 2)
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  return (
    <div className={`calwheel${fn ? '' : ' idle'}`} style={{ left: L(x), top: T(y), width: L(d), height: T(d) }}
      onPointerDown={onPointerDown} title={fn ? `${fn}: ${value}` : 'no control'}>
      <span className="calwheel-spin" style={{ transform: `rotate(${spin}deg)` }}><span className="calwheel-dot" /></span>
    </div>
  )
}

export function QuartzPanel() {
  // Avo = the Titan "shift". No physical desk, so it latches: click to hold the
  // second functions on, click again to release. State is shown loudly (see badge).
  const [shift, setShift] = useState(false)
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
  const wheelFns = [0, 1, 2].map((i) => active.wheels[i]?.find((fn) => present.has(fn)))
  const noSel = selection.length === 0
  const hasActive = !!activeCueId
  const goRel = (dir: 1 | -1) => {
    if (!cues.length) return
    const idx = cues.findIndex((c) => c.id === activeCueId)
    goCue(cues[idx < 0 ? (dir > 0 ? 0 : cues.length - 1) : (idx + dir + cues.length) % cues.length].id)
  }

  return (
    <div className="qpanel">
      <div className={`qcal${shift ? ' shift' : ''}`}>
        {shift && <div className="cal-shift-badge">AVO · segundas funciones activas</div>}
        {/* Wheels + @ buttons */}
        <Wheel x={8} y={8} d={196} fn={wheelFns[0]} />
        <Wheel x={230} y={5} d={196} fn={wheelFns[1]} />
        <Wheel x={447} y={8} d={196} fn={wheelFns[2]} />
        <Box x={190} y={168} w={56} h={50} cols={1} rows={1}><Key v="blue" narrow disabled title="A @" /></Box>
        <Box x={403} y={168} w={56} h={50} cols={1} rows={1}><Key v="blue" narrow disabled title="B @" /></Box>
        <Box x={616} y={168} w={56} h={50} cols={1} rows={1}><Key v="blue" narrow disabled title="C @" /></Box>
        <Label x={200} y={222} w={36} text="A @" /><Label x={413} y={222} w={36} text="B @" /><Label x={626} y={222} w={36} text="C @" />

        {/* Executors 2×10 */}
        <GridLabels x={700} y={38} w={588} cols={10} items={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']} />
        <Box x={700} y={54} w={588} h={112} cols={10} rows={2}>
          {Array.from({ length: 20 }, (_, i) => <Key key={i} v="dark" narrow disabled title={`Executor ${i + 1}`} />)}
        </Box>
        <GridLabels x={700} y={172} w={588} cols={10} items={['11\nAttribute\nEditor', '12\nShow\nLibrary', '13\nPlaybacks', '14\nChannel\nGrid', '15\nVisualiser', '16\nGroups +\nPalettes', '17\nFixtures\n+ Groups', '18\nSnap', '19', '20']} />

        {/* Fix / All / HiLight */}
        <GridLabels x={40} y={270} w={100} cols={2} items={['Fix −1', 'Fix +1']} above />
        <Box x={40} y={272} w={100} h={118} cols={2} rows={2}>
          <Key v="dark" narrow led={false} disabled title="Fix −1" /><Key v="dark" narrow led={false} disabled title="Fix +1" />
          <Key v="dark" narrow disabled title="All" /><Key v="dark" narrow disabled title="Hi Light" />
        </Box>
        <GridLabels x={40} y={392} w={100} cols={2} items={['All', 'Hi\nLight']} subs={['Rem Dim', 'Lo Light']} />

        {/* Attribute bank 7×2 */}
        <GridLabels x={178} y={270} w={452} cols={7} items={['Intensity', 'Position', 'Colour', 'Gobo', 'Beam', 'Effect', 'Special']} above />
        <Box x={178} y={272} w={452} h={118} cols={7} rows={2}>
          {ATTRIBUTES.map((a) => <Key key={a.name} v="white" on={a.name === attr} title={a.name} onClick={() => setAttr(a.name)} />)}
          <Key v="white" title="Shape → Shapes" onClick={() => setScreen('effects')} />
          <Key v="white" disabled title="ML Menu" /><Key v="white" disabled title="Blind" /><Key v="white" disabled title="Off" />
          <Key v="white" disabled title="Fan" /><Key v="white" disabled title="Options" /><Key v="dark" disabled title="Latch Menu" />
        </Box>
        <GridLabels x={178} y={392} w={452} cols={7} items={['Shape', 'ML\nMenu', 'Blind', 'Off', 'Fan', 'Options', 'Latch\nMenu']} />

        {/* Program keys 6×2 */}
        <GridLabels x={658} y={270} w={386} cols={6} items={['Record', 'Update', 'Edit', 'Select\nIf', 'Patch', 'Disk']} subs={['', '', '', '', '', 'Setup']} above />
        <Box x={658} y={272} w={386} h={118} cols={6} rows={2}>
          <Key v="dark" ledColor="red" on={hasProgrammer} disabled={!hasProgrammer} title="Record" onClick={recordCue} />
          <Key v="white" led={false} disabled={!hasActive || !hasProgrammer} title="Update" onClick={() => activeCueId && updateCue(activeCueId)} />
          <Key v="white" led={false} disabled title="Edit" /><Key v="white" led={false} disabled title="Select If" /><Key v="white" led={false} disabled title="Patch" /><Key v="white" led={false} disabled title="Disk" />
          <Key v="white" led={false} disabled={!hasActive} title="Delete" onClick={() => activeCueId && deleteCue(activeCueId)} />
          <Key v="white" led={false} disabled={!hasActive} title="Copy" onClick={() => activeCueId && copyCue(activeCueId)} />
          <Key v="white" led={false} disabled title="Move" /><Key v="white" led={false} disabled title="Unfold" /><Key v="white" led={false} disabled title="Include" />
          <Key v="white" led={false} disabled={!hasActive} title="Release" onClick={releaseCue} />
        </Box>
        <GridLabels x={658} y={392} w={386} cols={6} items={['Delete', 'Copy', 'Move', 'Unfold', 'Include', 'Release']} />

        {/* Min/Max ... */}
        <GridLabels x={1074} y={270} w={122} cols={2} items={['Min/Max', 'Size/Pos']} subs={['Next', 'Other Screen']} above />
        <Box x={1074} y={272} w={122} h={118} cols={2} rows={2}>
          <Key v="dark" narrow led={false} disabled title="Min/Max" /><Key v="dark" narrow led={false} disabled title="Size/Pos" />
          <Key v="dark" narrow disabled title="View/Open" /><Key v="dark" narrow led={false} disabled title="Close/Control" />
        </Box>
        <GridLabels x={1074} y={392} w={122} cols={2} items={['View\n/Open', 'Close\nControl']} />

        {/* Flash rows: top row LED at bottom, bottom row no LED */}
        <Box x={44} y={454} w={612} h={104} cols={10} rows={2}>
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = cues[gi]; const on = !!cue && cue.id === activeCueId
            return <Key key={`t${i}`} v="dark" narrow ledBottom on={on} disabled={!cue} title={cue ? `Go ${cue.name}` : 'Empty'} onClick={() => cue && goCue(cue.id)} />
          })}
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = cues[gi]
            return <Key key={`b${i}`} v="dark" narrow led={false} disabled={!cue} title={cue ? `Flash ${cue.name}` : 'Empty'} onClick={() => cue && goCue(cue.id)} />
          })}
        </Box>

        {/* Fader numbers + faders */}
        <GridLabels x={44} y={592} w={612} cols={10} items={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']} />
        <div className="cal-faders" style={{ left: L(44), top: T(610), width: L(612), height: T(278) }}>
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = cues[gi]
            return (
              <div className="cal-fader" key={i}>
                <input type="range" min={0} max={255} defaultValue={cue ? 255 : 0} disabled={!cue} title={cue ? cue.name : `Fader ${gi + 1}`} />
              </div>
            )
          })}
        </div>

        {/* Page keys */}
        <Label x={710} y={420} w={70} text="+ Page" /><Label x={776} y={420} w={72} text="Go Page" />
        <Box x={714} y={438} w={62} h={62} cols={1} rows={1}><Key v="white" led={false} title="Next page" onClick={() => setPlaybackPage(playbackPage + 1)} /></Box>
        <Box x={780} y={438} w={66} h={62} cols={1} rows={1}><Key v="white" title="Go Page" disabled /></Box>
        <Box x={714} y={505} w={62} h={62} cols={1} rows={1}><Key v="white" led={false} disabled={playbackPage === 0} title="Previous page" onClick={() => setPlaybackPage(Math.max(0, playbackPage - 1))} /></Box>
        <Label x={710} y={570} w={70} text={`− Page · Pg ${playbackPage + 1}`} />

        {/* Transport 2×3 + Go */}
        <Label x={654} y={614} w={56} text={'Live\nTime'} sub="Review" align="right" /><Label x={848} y={614} w={56} text={'Next\nTime'} sub="Snap Back" align="left" />
        <Label x={654} y={678} w={56} text={'Prev\nCue'} align="right" /><Label x={848} y={678} w={56} text={'Next\nCue'} align="left" />
        <Label x={652} y={742} w={58} text={'Connect\n/Cue'} align="right" /><Label x={848} y={742} w={56} text="Stop" align="left" />
        <Box x={714} y={600} w={130} h={178} cols={2} rows={3}>
          <Key v="white" led={false} disabled title="Live Time" /><Key v="white" led={false} disabled title="Next Time" />
          <Key v="white" led={false} disabled={!cues.length} title="Prev Cue" onClick={() => goRel(-1)} />
          <Key v="white" led={false} disabled={!cues.length} title="Next Cue" onClick={() => goRel(1)} />
          <Key v="dark" disabled title="Connect/Cue" /><Key v="dark" disabled title="Stop" />
        </Box>
        <Box x={758} y={790} w={60} h={62} cols={1} rows={1}>
          <Key v="red" ledColor="red" on={cues.length > 0} disabled={!cues.length} title="Go" onClick={() => goRel(1)} />
        </Box>
        <Label x={734} y={858} w={108} text="Go" />

        {/* Keypad — one 6×4 grid so every row is evenly spaced */}
        <GridLabels x={916} y={446} w={258} cols={4} items={['Fixture', 'Palette', 'Macro', 'Group']} />
        <Box x={916} y={462} w={258} h={400} cols={4} rows={6}>
          <Key v="dark" title="Fixtures" onClick={() => setScreen('fixtures')} />
          <Key v="dark" title="Palettes" onClick={() => setScreen('colour')} />
          <Key v="dark" disabled title="Macro" /><Key v="dark" disabled title="Group" />
          <Key v="white" led={false} disabled text="1" title="1" /><Key v="white" led={false} disabled text="2" title="2" /><Key v="white" led={false} disabled text="3" title="3" /><Key v="white" on={shift} text="Avo" title="Avo — activa/desactiva las segundas funciones" onClick={() => setShift((s) => !s)} />
          <Key v="white" led={false} disabled text="4" title="4" /><Key v="white" led={false} disabled text="5" title="5" /><Key v="white" led={false} disabled text="6" title="6" /><Key v="white" ledColor="red" disabled text="TIME" title="Time" />
          <Key v="white" led={false} disabled text="7" title="7" /><Key v="white" led={false} disabled text="8" title="8" /><Key v="white" led={false} disabled text="9" title="9" /><Key v="white" ledColor="red" on={hasProgrammer} text="CLEAR" title="Clear the programmer" onClick={clearProgrammer} />
          <Key v="white" led={false} disabled text="EXIT" title="Exit" /><Key v="white" led={false} disabled text="0" title="0" /><Key v="white" led={false} disabled text="ENTER" title="Enter" /><Key v="white" led={false} disabled text="." title="." />
          <Key v="dark" led={false} disabled title="Back" /><Key v="dark" led={false} disabled title="Through" /><Key v="dark" led={false} disabled title="And" /><Key v="dark" led={false} disabled title="@" />
        </Box>
        <GridLabels x={916} y={866} w={258} cols={4} items={['Back', 'Through', 'And', '@']} subs={['Undo', '−%', '+%', 'Redo']} />

        {/* Locate */}
        <Box x={1221} y={748} w={60} h={62} cols={1} rows={1}>
          <Key v="red" ledColor="red" on={!noSel} disabled={noSel} title="Locate selected" onClick={locateSelected} />
        </Box>
        <Label x={1200} y={824} w={100} text="Locate" />
      </div>
    </div>
  )
}
