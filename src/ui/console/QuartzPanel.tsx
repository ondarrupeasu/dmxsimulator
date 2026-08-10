import { useState } from 'react'
import { useShowStore } from '../../store/showStore'
import { useSelectedValue, useSelectionFunctions } from './useSelectedValue'

/**
 * Avolites Quartz — the button panel is laid out 1:1 over a photo of the real
 * desk (public/quartz.png). Controls are absolutely positioned in % of the image
 * so the shape/size/position match exactly; the background can be toggled off
 * once everything lines up. Wheels are draggable jog wheels; faders are sliders.
 */

const IMG_W = 1306
const IMG_H = 919
const L = (px: number) => `${(px / IMG_W) * 100}%`
const T = (px: number) => `${(px / IMG_H) * 100}%`

const ATTRIBUTES: { name: string; wheels: string[][] }[] = [
  { name: 'Intensity', wheels: [['dimmer']] },
  { name: 'Position', wheels: [['pan'], ['tilt']] },
  { name: 'Colour', wheels: [['red', 'colorWheel'], ['green'], ['blue', 'white']] },
  { name: 'Gobo', wheels: [['gobo'], ['goboRotation']] },
  { name: 'Beam', wheels: [['prism'], ['shutter'], ['zoom', 'focus']] },
  { name: 'Effect', wheels: [] },
  { name: 'Special', wheels: [] },
]

function clamp(v: number) { return Math.max(0, Math.min(255, v)) }

/** A grid of cells positioned over the image (px coords of the 1306×919 photo). */
function Box({ x, y, w, h, cols, rows, children }: {
  x: number; y: number; w: number; h: number; cols: number; rows: number; children: React.ReactNode
}) {
  return (
    <div
      className="cal-grid"
      style={{
        left: L(x), top: T(y), width: L(w), height: T(h),
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {children}
    </div>
  )
}

function LedKey({ on, red, led = true, disabled, title, onClick }: {
  on?: boolean; red?: boolean; led?: boolean; disabled?: boolean; title?: string; onClick?: () => void
}) {
  return (
    <button className="calkey" disabled={disabled} title={title} onClick={onClick}>
      {led && <span className={`called${on ? ' on' : ''}${red ? ' red' : ''}`} />}
    </button>
  )
}

function Wheel({ x, y, d, fn }: { x: number; y: number; d: number; fn: string | undefined }) {
  const value = useSelectedValue(fn ?? '')
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  // Endless encoder: the wheel spins freely; only the DMX value (0–255) is bounded.
  const [spin, setSpin] = useState(0)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!fn) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    let v = value
    let lastY = e.clientY
    const move = (ev: PointerEvent) => {
      const dy = lastY - ev.clientY
      lastY = ev.clientY
      v = clamp(v + dy * 1.5)
      setByFn(fn, Math.round(v))
      setSpin((s) => s + dy * 2) // free, unbounded rotation
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div className={`calwheel${fn ? '' : ' idle'}`}
      style={{ left: L(x), top: T(y), width: L(d), height: T(d) }}
      onPointerDown={onPointerDown} title={fn ? `${fn}: ${value}` : 'no control'}>
      <span className="calwheel-spin" style={{ transform: `rotate(${spin}deg)` }}>
        <span className="calwheel-dot" />
      </span>
    </div>
  )
}

export function QuartzPanel() {
  const [showBg, setShowBg] = useState(true)
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
    if (cues.length === 0) return
    const idx = cues.findIndex((c) => c.id === activeCueId)
    const next = idx < 0 ? (dir > 0 ? 0 : cues.length - 1) : (idx + dir + cues.length) % cues.length
    goCue(cues[next].id)
  }

  return (
    <div className="qpanel">
      <button className="qcal-bgtoggle" onClick={() => setShowBg((s) => !s)} title="Show/hide the reference photo">
        {showBg ? 'Ocultar foto' : 'Mostrar foto'}
      </button>
      <div className={`qcal${showBg ? ' bg' : ''}`}>
        {/* Wheels */}
        <Wheel x={8} y={8} d={196} fn={wheelFns[0]} />
        <Wheel x={230} y={5} d={196} fn={wheelFns[1]} />
        <Wheel x={447} y={8} d={196} fn={wheelFns[2]} />
        {/* @ buttons */}
        <Box x={197} y={168} w={42} h={50} cols={1} rows={1}><LedKey disabled title="A @" /></Box>
        <Box x={410} y={168} w={42} h={50} cols={1} rows={1}><LedKey disabled title="B @" /></Box>
        <Box x={623} y={168} w={42} h={50} cols={1} rows={1}><LedKey disabled title="C @" /></Box>

        {/* Executors 2×10 */}
        <Box x={712} y={52} w={532} h={156} cols={10} rows={2}>
          {Array.from({ length: 20 }, (_, i) => <LedKey key={i} disabled title={`Executor ${i + 1}`} />)}
        </Box>

        {/* Fix / All / HiLight */}
        <Box x={44} y={272} w={92} h={118} cols={2} rows={2}>
          <LedKey led={false} disabled title="Fix −1" /><LedKey led={false} disabled title="Fix +1" />
          <LedKey disabled title="All" /><LedKey disabled title="Hi Light" />
        </Box>

        {/* Attribute bank 7×2 */}
        <Box x={178} y={272} w={452} h={118} cols={7} rows={2}>
          {ATTRIBUTES.map((a) => (
            <LedKey key={a.name} on={a.name === attr} title={a.name} onClick={() => setAttr(a.name)} />
          ))}
          <LedKey title="Shape → Shapes" onClick={() => setScreen('effects')} />
          <LedKey disabled title="ML Menu" /><LedKey disabled title="Blind" /><LedKey disabled title="Off" />
          <LedKey disabled title="Fan" /><LedKey disabled title="Options" /><LedKey red disabled title="Latch Menu" />
        </Box>

        {/* Program keys 6×2 */}
        <Box x={658} y={272} w={386} h={118} cols={6} rows={2}>
          <LedKey red disabled={!hasProgrammer} title="Record" onClick={recordCue} />
          <LedKey led={false} disabled={!hasActive || !hasProgrammer} title="Update" onClick={() => activeCueId && updateCue(activeCueId)} />
          <LedKey led={false} disabled title="Edit" /><LedKey led={false} disabled title="Select If" /><LedKey led={false} disabled title="Patch" /><LedKey led={false} disabled title="Disk" />
          <LedKey disabled={!hasActive} title="Delete" onClick={() => activeCueId && deleteCue(activeCueId)} />
          <LedKey led={false} disabled={!hasActive} title="Copy" onClick={() => activeCueId && copyCue(activeCueId)} />
          <LedKey led={false} disabled title="Move" /><LedKey led={false} disabled title="Unfold" /><LedKey led={false} disabled title="Include" />
          <LedKey led={false} disabled={!hasActive} title="Release" onClick={releaseCue} />
        </Box>

        {/* Min/Max ... 2×2 */}
        <Box x={1074} y={272} w={122} h={118} cols={2} rows={2}>
          <LedKey led={false} disabled title="Min/Max" /><LedKey led={false} disabled title="Size/Pos" />
          <LedKey disabled title="View/Open" /><LedKey led={false} disabled title="Close/Control" />
        </Box>

        {/* Flash buttons above faders — two rows (top has the LED, bottom doesn't) */}
        <Box x={44} y={432} w={612} h={108} cols={10} rows={2}>
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i
            const cue = cues[gi]
            const on = !!cue && cue.id === activeCueId
            return <LedKey key={`t${i}`} on={on} disabled={!cue} title={cue ? `Go ${cue.name}` : 'Empty'} onClick={() => cue && goCue(cue.id)} />
          })}
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i
            const cue = cues[gi]
            return <button key={`b${i}`} className="calkey" disabled={!cue} title={cue ? `Flash ${cue.name}` : 'Empty'} onClick={() => cue && goCue(cue.id)} />
          })}
        </Box>

        {/* Faders — cover the photo's tracks/handles and draw clean ones */}
        <div className="cal-faders" style={{ left: L(44), top: T(616), width: L(612), height: T(250) }}>
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i
            const cue = cues[gi]
            return (
              <div className="cal-fader" key={i}>
                <input type="range" min={0} max={255} defaultValue={cue ? 255 : 0} disabled={!cue} title={cue ? cue.name : `Fader ${gi + 1}`} />
              </div>
            )
          })}
        </div>

        {/* Page keys */}
        <Box x={690} y={438} w={62} h={62} cols={1} rows={1}><LedKey led={false} title="Next page" onClick={() => setPlaybackPage(playbackPage + 1)} /></Box>
        <Box x={756} y={438} w={66} h={62} cols={1} rows={1}><LedKey disabled title="Go Page" /></Box>
        <Box x={690} y={505} w={62} h={62} cols={1} rows={1}><LedKey led={false} disabled={playbackPage === 0} title="Previous page" onClick={() => setPlaybackPage(Math.max(0, playbackPage - 1))} /></Box>

        {/* Transport 2×3 + Go */}
        <Box x={690} y={600} w={130} h={178} cols={2} rows={3}>
          <LedKey led={false} disabled title="Live Time" /><LedKey led={false} disabled title="Next Time" />
          <LedKey led={false} disabled={!cues.length} title="Prev Cue" onClick={() => goRel(-1)} />
          <LedKey led={false} disabled={!cues.length} title="Next Cue" onClick={() => goRel(1)} />
          <LedKey disabled title="Connect/Cue" /><LedKey disabled title="Stop" />
        </Box>
        <button className="calbig red" style={{ left: L(728), top: T(782), width: L(72), height: T(62) }}
          disabled={!cues.length} title="Go" onClick={() => goRel(1)} />

        {/* Keypad: Fixture/Palette/Macro/Group */}
        <Box x={916} y={462} w={258} h={50} cols={4} rows={1}>
          <LedKey title="Fixtures" onClick={() => setScreen('fixtures')} />
          <LedKey title="Palettes" onClick={() => setScreen('colour')} />
          <LedKey disabled title="Macro" /><LedKey disabled title="Group" />
        </Box>
        {/* Numeric 4×4 — plain digits have no LED; the right column (logo/Time/Clear) does */}
        <Box x={916} y={528} w={258} h={274} cols={4} rows={4}>
          <LedKey led={false} disabled title="1" /><LedKey led={false} disabled title="2" /><LedKey led={false} disabled title="3" /><LedKey red disabled title="Avolites" />
          <LedKey led={false} disabled title="4" /><LedKey led={false} disabled title="5" /><LedKey led={false} disabled title="6" /><LedKey red disabled title="Time" />
          <LedKey led={false} disabled title="7" /><LedKey led={false} disabled title="8" /><LedKey led={false} disabled title="9" /><LedKey red title="Clear the programmer" onClick={clearProgrammer} />
          <LedKey led={false} disabled title="Exit" /><LedKey led={false} disabled title="0" /><LedKey led={false} disabled title="Enter" /><LedKey led={false} disabled title="." />
        </Box>
        {/* Back/Through/And/@ */}
        <Box x={916} y={806} w={258} h={62} cols={4} rows={1}>
          <LedKey led={false} disabled title="Back" /><LedKey led={false} disabled title="Through" /><LedKey led={false} disabled title="And" /><LedKey led={false} disabled title="@" />
        </Box>
        {/* Locate */}
        <button className="calbig red" style={{ left: L(1214), top: T(742), width: L(74), height: T(78) }}
          disabled={noSel} title="Locate selected" onClick={locateSelected} />
      </div>
    </div>
  )
}
