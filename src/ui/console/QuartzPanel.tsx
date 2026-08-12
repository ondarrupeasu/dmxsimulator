import { useState } from 'react'
import { useShowStore } from '../../store/showStore'
import { playbacksBySlot } from '../../model/cue'
import { useSelectedValue, useSelectionFunctions } from './useSelectedValue'

/**
 * Avolites Quartz — self-styled faithful panel (dark theme, matching the app).
 * Positions were traced 1:1 from the desk photo (public/quartz.png, kept behind a
 * toggle for reference). Keys carry their real colour (white / dark grey / red /
 * blue), an LED at the top (bottom for the top flash row) only where the real desk
 * has one, and the silk-screen labels around them.
 */

const IMG_W = 1306
// Trace height was 919 (the desk photo). We shortened the faders and pulled the whole
// bottom cluster up, so the readable desk now fits in a shorter canvas → less height.
const IMG_H = 859
const L = (px: number) => `${(px / IMG_W) * 100}%`
const T = (px: number) => `${(px / IMG_H) * 100}%`
const clamp = (v: number) => Math.max(0, Math.min(255, v))

// Attribute banks → up to 3 wheels each (Titan groups shutter/strobe with Intensity,
// iris/prism/zoom/focus with Beam). Colour still needs pages for RGBW+A/UV — noted.
const ATTRIBUTES: { name: string; wheels: string[][] }[] = [
  { name: 'Intensity', wheels: [['dimmer', 'haze'], ['shutter', 'strobe']] },
  { name: 'Position', wheels: [['pan'], ['tilt']] },
  { name: 'Colour', wheels: [['red', 'colorWheel'], ['green', 'amber'], ['blue', 'white']] },
  { name: 'Gobo', wheels: [['gobo'], ['goboRotation']] },
  { name: 'Beam', wheels: [['prism', 'iris'], ['zoom'], ['focus']] },
  { name: 'Effect', wheels: [] },
  { name: 'Special', wheels: [] },
]

type V = 'white' | 'dark' | 'blue' | 'red'
function Key({
  v = 'dark', led = true, ledColor, ledBottom, on, flash, text, narrow, assignable, disabled, title, onClick, onContextMenu, tour,
}: {
  v?: V; led?: boolean; ledColor?: 'red' | 'blue'; ledBottom?: boolean; on?: boolean; flash?: boolean
  text?: string; narrow?: boolean; assignable?: boolean; disabled?: boolean; title?: string
  onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; tour?: string
}) {
  return (
    <button
      className={`ck ck-${v}${ledBottom ? ' ledb' : ''}${narrow ? ' narrow' : ''}${assignable ? ' assignable' : ''}`}
      disabled={disabled} title={title} onClick={onClick} onContextMenu={onContextMenu} data-tour={tour}
    >
      {led && <span className={`ckled${on ? ' on' : ''}${flash ? ' flash' : ''}${ledColor ? ' ' + ledColor : ''}`} />}
      {text != null && <span className="cktext">{text}</span>}
    </button>
  )
}

// Fixed executors 11–18 that map to a touchscreen workspace we actually have.
const EXEC_SCREEN: Record<number, string> = { 13: 'playbacks', 16: 'colour', 17: 'groups' }

// The only two key sizes on the desk (in cqw): 1:1 and a little narrower; one height.
const KW = 4.4
const NW = 3.7
const KH = 4.05

/** A grid of keys. By default the cells are exactly one key wide/tall, so a group's
 *  buttons sit tight together (H and V) and every key is one of the two widths. The
 *  content is centred in the box. `spread` keeps 1fr columns (used for the flash row
 *  so it stays aligned above the faders). */
function Box({ x, y, w, h, cols, rows, narrow, spread, children }: {
  x: number; y: number; w: number; h: number; cols: number; rows: number
  narrow?: boolean; spread?: boolean; children: React.ReactNode
}) {
  const style: React.CSSProperties = spread
    ? { gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }
    : {
        gridTemplateColumns: `repeat(${cols}, ${narrow ? NW : KW}cqw)`,
        gridTemplateRows: `repeat(${rows}, ${KH}cqw)`,
        justifyContent: 'center',
        alignContent: 'center',
      }
  return (
    <div className={`cal-grid${spread ? ' spread' : ''}`} style={{ left: L(x), top: T(y), width: L(w), height: T(h), ...style }}>
      {children}
    </div>
  )
}

/** A thin silk-screen frame that groups a block of buttons, like on the real desk. */
function Frame({ x, y, w, h, tour }: { x: number; y: number; w: number; h: number; tour?: string }) {
  return <div className="cal-frame" data-tour={tour} style={{ left: L(x), top: T(y), width: L(w), height: T(h) }} />
}

/** Silk-screen labels centred over each column of a grid. `subs` = shifted-function
 *  name printed in lighter grey under each label. */
function GridLabels({ x, y, w, cols, items, subs, above, small }: { x: number; y: number; w: number; cols: number; items: string[]; subs?: string[]; above?: boolean; small?: boolean }) {
  const cw = w / cols
  return (
    <>
      {items.map((t, i) => (t || subs?.[i]) ? (
        <div key={i} className={`cal-lbl${above ? ' above' : ''}${small ? ' small' : ''}`} style={{ left: L(x + cw * i), top: T(y), width: L(cw) }}>
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

function Wheel({ x, y, d, fn, tour }: { x: number; y: number; d: number; fn: string | undefined; tour?: string }) {
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
      onPointerDown={onPointerDown} title={fn ? `${fn}: ${value}` : 'no control'} data-tour={tour}>
      <span className="calwheel-spin" style={{ transform: `rotate(${spin}deg)` }}><span className="calwheel-dot" /></span>
    </div>
  )
}

// Named functional areas of the desk, for the learning overlay.
const ZONES: { name: string; x: number; y: number; w: number; h: number; c: string }[] = [
  { name: 'Wheels', x: 4, y: 6, w: 636, h: 220, c: '#4aa3ff' },
  { name: 'Executors', x: 642, y: 30, w: 652, h: 200, c: '#c078ff' },
  { name: 'Fixture control', x: 32, y: 246, w: 122, h: 156, c: '#ff8a3d' },
  { name: 'Attribute bank', x: 168, y: 246, w: 470, h: 156, c: '#38c98b' },
  { name: 'Program', x: 648, y: 246, w: 400, h: 156, c: '#ff5a4d' },
  { name: 'Windows', x: 1066, y: 246, w: 136, h: 156, c: '#e0c341' },
  { name: 'Page', x: 706, y: 440, w: 146, h: 130, c: '#4ad6d6' },
  { name: 'Playback faders', x: 36, y: 444, w: 628, h: 388, c: '#7d8cff' },
  { name: 'Playbacks / Go', x: 644, y: 592, w: 268, h: 250, c: '#ff77b0' },
  { name: 'Keypad · command line', x: 906, y: 456, w: 372, h: 386, c: '#9be14a' },
]

export function QuartzPanel() {
  // Avo = the Titan "shift". No physical desk, so it latches: click to hold the
  // second functions on, click again to release. State is shown loudly (see badge).
  const [shift, setShift] = useState(false)
  const [showZones, setShowZones] = useState(false)
  const attr = useShowStore((s) => s.deskAttr)
  const setAttr = useShowStore((s) => s.setDeskAttr)
  const setScreen = useShowStore((s) => s.setDeskScreen)
  const setMenu = useShowStore((s) => s.setDeskMenu)
  const selection = useShowStore((s) => s.selection)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const recordArm = useShowStore((s) => s.recordArm)
  const armRecord = useShowStore((s) => s.armRecord)
  const recordCueAt = useShowStore((s) => s.recordCueAt)
  const updateCue = useShowStore((s) => s.updateCue)
  const copyCue = useShowStore((s) => s.copyCue)
  const deleteCue = useShowStore((s) => s.deleteCue)
  const releaseCue = useShowStore((s) => s.releaseCue)
  const playbacks = useShowStore((s) => s.playbacks)
  const connectedId = useShowStore((s) => s.connectedId)
  const goCue = useShowStore((s) => s.goCue)
  const go = useShowStore((s) => s.go)
  const goBack = useShowStore((s) => s.goBack)
  const stopPlayback = useShowStore((s) => s.stopPlayback)
  const playbackPage = useShowStore((s) => s.playbackPage)
  const setPlaybackPage = useShowStore((s) => s.setPlaybackPage)
  const playbackLevels = useShowStore((s) => s.playbackLevels)
  const setPlaybackLevel = useShowStore((s) => s.setPlaybackLevel)
  const fades = useShowStore((s) => s.fades)
  const killPlayback = useShowStore((s) => s.killPlayback)
  const playbackFade = useShowStore((s) => s.playbackFade)
  const setPlaybackFade = useShowStore((s) => s.setPlaybackFade)
  const executorLabels = useShowStore((s) => s.executorLabels)
  const setExecutorLabel = useShowStore((s) => s.setExecutorLabel)
  const executorCues = useShowStore((s) => s.executorCues)
  const recordExecutor = useShowStore((s) => s.recordExecutor)
  const clearExecutor = useShowStore((s) => s.clearExecutor)
  const editExecutor = (n: number) => {
    const cur = executorLabels[n] ?? ''
    const v = window.prompt(`Executor ${n} — escribe su etiqueta (vacío para borrar)`, cur)
    if (v !== null) setExecutorLabel(n, v)
  }
  const hasProgrammer = useShowStore((s) => Object.keys(s.programmer).length > 0)
  // A playback is "up" if its level is above 0 or a fade is taking it up.
  const isUp = (id: string) => (playbackLevels[id] ?? 0) > 0 || !!(fades[id] && fades[id].to > 0)
  // Executor click: fire/kill its bound cue, or capture the current look, or label it.
  const boundCue = (n: number) => playbacks.find((p) => p.id === executorCues[n])
  const execCaption = (n: number) => boundCue(n)?.name ?? executorLabels[n]
  const onExecutor = (n: number) => {
    const cue = boundCue(n)
    if (cue) {
      if (isUp(cue.id)) killPlayback(cue.id)
      else goCue(cue.id)
    } else if (hasProgrammer) {
      recordExecutor(n)
    } else {
      editExecutor(n)
    }
  }
  const present = useSelectionFunctions()
  const fixtures = useShowStore((s) => s.show.fixtures)
  const select = useShowStore((s) => s.select)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const clearSelectedFunctions = useShowStore((s) => s.clearSelectedFunctions)
  const fanSelected = useShowStore((s) => s.fanSelected)
  const blind = useShowStore((s) => s.blind)
  const setBlind = useShowStore((s) => s.setBlind)
  const cmdAppend = useShowStore((s) => s.cmdAppend)
  const cmdBackspace = useShowStore((s) => s.cmdBackspace)
  const cmdClear = useShowStore((s) => s.cmdClear)
  const commitCommand = useShowStore((s) => s.commitCommand)

  const active = ATTRIBUTES.find((a) => a.name === attr) ?? ATTRIBUTES[0]
  const wheelFns = [0, 1, 2].map((i) => active.wheels[i]?.find((fn) => present.has(fn)))
  const activeFns = active.wheels.flat() // every function in the active attribute bank
  const fanFn = activeFns.find((fn) => present.has(fn)) // what Fan spreads
  const noSel = selection.length === 0
  const noFx = fixtures.length === 0
  // Step the selection to the previous/next patched fixture (Fix −1 / Fix +1).
  const step = (dir: 1 | -1) => {
    if (noFx) return
    const picked = fixtures.map((f, i) => (selection.includes(f.id) ? i : -1)).filter((i) => i >= 0)
    const base = dir > 0 ? Math.max(...picked, -1) : picked.length ? Math.min(...picked) : -1
    let ni = base < 0 ? (dir > 0 ? 0 : fixtures.length - 1) : base + dir
    ni = ((ni % fixtures.length) + fixtures.length) % fixtures.length
    select([fixtures[ni].id])
  }
  const dig = (d: string) => () => cmdAppend(d)
  const hasActive = !!connectedId
  // Playbacks are sparse: faders index by slot. The central Go/Prev/Stop drive the CONNECTED
  // playback's steps (a cue list), not the faders — exactly like the real desk.
  const bySlot = playbacksBySlot(playbacks)

  return (
    <div className="qpanel">
      <button className="qcal-zonetoggle" onClick={() => setShowZones((s) => !s)}>
        {showZones ? 'Ocultar zonas' : 'Ver zonas'}
      </button>
      <div className={`qcal${shift ? ' shift' : ''}`}>
        {shift && <div className="cal-shift-badge">AVO · segundas funciones activas</div>}
        {blind && <div className="cal-blind-badge">BLIND · el programmer no sale a escena</div>}
        {showZones && (
          <div className="cal-zones">
            {ZONES.map((z) => (
              <div key={z.name} className="cal-zone" style={{ left: L(z.x), top: T(z.y), width: L(z.w), height: T(z.h), borderColor: z.c }}>
                <span className="zname" style={{ color: z.c }}>{z.name}</span>
              </div>
            ))}
          </div>
        )}
        {/* Wheels + @ buttons */}
        <Wheel x={16} y={22} d={150} fn={wheelFns[0]} tour="desk-wheel" />
        <Wheel x={236} y={22} d={150} fn={wheelFns[1]} />
        <Wheel x={456} y={22} d={150} fn={wheelFns[2]} />
        <Box x={112} y={168} w={56} h={50} cols={1} rows={1} narrow><Key v="blue" disabled title="A @" /></Box>
        <Box x={332} y={168} w={56} h={50} cols={1} rows={1} narrow><Key v="blue" disabled title="B @" /></Box>
        <Box x={552} y={168} w={56} h={50} cols={1} rows={1} narrow><Key v="blue" disabled title="C @" /></Box>
        <Label x={78} y={172} w={28} text={'A\n@'} align="right" /><Label x={298} y={172} w={28} text={'B\n@'} align="right" /><Label x={518} y={172} w={28} text={'C\n@'} align="right" />

        {/* Executors 2×10 — assignable ones show their user label as a silk-screen
            caption (outside the button), like the printed 11–18 functions. */}
        <Frame x={642} y={48} w={652} h={124} tour="desk-executors" />
        <GridLabels x={648} y={52} w={640} cols={10} small above
          items={Array.from({ length: 10 }, (_, i) => (execCaption(i + 1) ? `${execCaption(i + 1)}\n${i + 1}` : String(i + 1)))} />
        <Box x={648} y={54} w={640} h={112} cols={10} rows={2} spread>
          {Array.from({ length: 20 }, (_, i) => {
            const n = i + 1
            // 1–10 (top) and 19–20 are blank/assignable (bind a cue); 11–18 are fixed.
            if (n <= 10 || n >= 19) {
              const cue = boundCue(n)
              const caption = execCaption(n)
              const lit = !!cue && isUp(cue.id)
              const title = cue
                ? `Executor ${n}: ${cue.name} — clic para disparar/apagar (clic derecho: liberar)`
                : hasProgrammer
                  ? `Executor ${n} — clic para grabar el look actual aquí`
                  : `Executor ${n} — clic para etiquetar`
              return (
                <Key
                  key={i} v="dark" narrow assignable={!caption} ledColor="red" on={lit}
                  title={title}
                  onClick={() => onExecutor(n)}
                  onContextMenu={(e) => { e.preventDefault(); if (cue) clearExecutor(n) }}
                />
              )
            }
            // 11–18 are the fixed workspace shortcuts; wire the ones we have windows for.
            const scr = EXEC_SCREEN[n]
            if (scr) {
              return <Key key={i} v="dark" narrow led={false} title={`Executor ${n} — abrir workspace`} onClick={() => setScreen(scr)} />
            }
            return <Key key={i} v="dark" narrow disabled title={`Executor ${n}`} />
          })}
        </Box>
        <GridLabels x={648} y={172} w={640} cols={10} small items={['11\nAttribute\nEditor', '12\nShow\nLibrary', '13\nPlaybacks', '14\nChannel\nGrid', '15\nVisualiser', '16\nGroups +\nPalettes', '17\nFixtures\n+ Groups', '18\nSnap', execCaption(19) ? `19\n${execCaption(19)}` : '19', execCaption(20) ? `20\n${execCaption(20)}` : '20']} />

        {/* Fix / All / HiLight */}
        <GridLabels x={40} y={270} w={100} cols={2} items={['Fix −1', 'Fix +1']} above />
        <Box x={40} y={272} w={100} h={118} cols={2} rows={2} narrow>
          <Key v="dark" narrow led={false} disabled={fixtures.length < 2} title="Fix −1 — fixture anterior" onClick={() => step(-1)} />
          <Key v="dark" narrow led={false} disabled={fixtures.length < 2} title="Fix +1 — fixture siguiente" onClick={() => step(1)} />
          <Key v="dark" narrow on={!noFx && selection.length === fixtures.length} disabled={noFx} title="All — seleccionar todo" onClick={() => select(fixtures.map((f) => f.id))} />
          <Key v="dark" narrow disabled={noSel} title="Hi Light — intensidad al máximo" onClick={() => setByFn('dimmer', 255)} />
        </Box>
        <GridLabels x={40} y={392} w={100} cols={2} items={['All', 'Hi\nLight']} subs={['Rem Dim', 'Lo Light']} />

        {/* Attribute bank 7×2 */}
        <GridLabels x={178} y={270} w={452} cols={7} items={['Intensity', 'Position', 'Colour', 'Gobo', 'Beam', 'Effect', 'Special']} above />
        <Box x={178} y={272} w={452} h={118} cols={7} rows={2}>
          {ATTRIBUTES.map((a) => <Key key={a.name} v="white" on={a.name === attr} title={a.name} onClick={() => setAttr(a.name)} tour={a.name === 'Position' ? 'desk-position' : a.name === 'Colour' ? 'desk-colour' : undefined} />)}
          <Key v="white" title="Shape → Shapes" onClick={() => setScreen('effects')} tour="desk-shape" />
          <Key v="white" title="ML Menu — menú Moving Light" onClick={() => setMenu('ml')} /><Key v="white" ledColor="red" on={blind} title="Blind — programar sin salida a escena" onClick={() => setBlind(!blind)} /><Key v="white" disabled={noSel || activeFns.length === 0} title={`Off — quitar ${active.name} de la selección`} onClick={() => clearSelectedFunctions(activeFns)} />
          <Key v="white" disabled={selection.length < 2 || !fanFn} title={fanFn ? `Fan — abanicar ${fanFn} por la selección` : 'Fan'} onClick={() => fanFn && fanSelected(fanFn)} /><Key v="white" disabled title="Options" /><Key v="dark" disabled title="Latch Menu" />
        </Box>
        <GridLabels x={178} y={392} w={452} cols={7} items={['Shape', 'ML\nMenu', 'Blind', 'Off', 'Fan', 'Options', 'Latch\nMenu']} />

        {/* Program keys 6×2 */}
        <GridLabels x={658} y={270} w={386} cols={6} items={['Record', 'Update', 'Edit', 'Select\nIf', 'Patch', 'Disk']} subs={['', '', '', '', '', 'Setup']} above />
        <Box x={658} y={272} w={386} h={118} cols={6} rows={2}>
          <Key v="dark" ledColor="red" on={recordArm || hasProgrammer} flash={recordArm} title={recordArm ? 'Record armado — parpadea esperando que elijas el fader donde grabar (pulsa Record otra vez para cancelar)' : 'Record — pulsa y luego elige el fader donde guardar'} onClick={() => { setMenu('record'); if (hasProgrammer || recordArm) armRecord() }} tour="desk-record" />
          <Key v="white" led={false} disabled={!hasActive || !hasProgrammer} title="Update" onClick={() => connectedId && updateCue(connectedId)} />
          <Key v="white" led={false} disabled title="Edit" /><Key v="white" led={false} disabled title="Select If" /><Key v="white" led={false} title="Patch — abre el menú Patch" onClick={() => setMenu('patch')} /><Key v="white" led={false} title="Disk — Save / Load / New Show" onClick={() => setMenu('disk')} />
          <Key v="white" led={false} disabled={!hasActive} title="Delete" onClick={() => connectedId && deleteCue(connectedId)} />
          <Key v="white" led={false} disabled={!hasActive} title="Copy" onClick={() => connectedId && copyCue(connectedId)} />
          <Key v="white" led={false} disabled title="Move" /><Key v="white" led={false} disabled title="Unfold" /><Key v="white" led={false} disabled title="Include" />
          <Key v="white" led={false} disabled={!hasActive} title="Release" onClick={releaseCue} />
        </Box>
        <GridLabels x={658} y={392} w={386} cols={6} items={['Delete', 'Copy', 'Move', 'Unfold', 'Include', 'Release']} />

        {/* Min/Max ... */}
        <GridLabels x={1074} y={270} w={122} cols={2} items={['Min/Max', 'Size/Pos']} subs={['Next', 'Other Screen']} above />
        <Box x={1074} y={272} w={122} h={118} cols={2} rows={2} narrow>
          <Key v="dark" narrow led={false} disabled title="Min/Max" /><Key v="dark" narrow led={false} disabled title="Size/Pos" />
          <Key v="dark" narrow disabled title="View/Open" /><Key v="dark" narrow led={false} disabled title="Close/Control" />
        </Box>
        <GridLabels x={1074} y={392} w={122} cols={2} items={['View\n/Open', 'Close\nControl']} />

        {/* Flash rows: top row LED at bottom, bottom row no LED. Spread to align with faders. */}
        <Frame x={38} y={448} w={624} h={116} />
        <Box x={44} y={454} w={612} h={104} cols={10} rows={2} spread>
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = bySlot[gi]; const on = !!cue && isUp(cue.id)
            // Titan LED model: occupied handle whose fader is at 0 → its LED FLASHES (a
            // reminder why no light is coming on). While Record is armed, the valid targets
            // flash to say "pick where to record". Occupied + up = steady.
            const flash = recordArm ? true : !!cue && !on
            const title = recordArm ? (cue ? `Record over ${cue.name}` : 'Record here') : cue ? `Go ${cue.name}` : 'Empty'
            return <Key key={`t${i}`} v={recordArm ? 'red' : 'blue'} narrow ledBottom on={on} flash={flash} disabled={!recordArm && !cue} title={title} onClick={() => (recordArm ? recordCueAt(gi) : cue && goCue(cue.id))} />
          })}
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = bySlot[gi]
            const title = recordArm ? (cue ? `Record over ${cue.name}` : 'Record here') : cue ? `Flash ${cue.name}` : 'Empty'
            return <Key key={`b${i}`} v={recordArm ? 'red' : 'dark'} narrow led={false} disabled={!recordArm && !cue} title={title} onClick={() => (recordArm ? recordCueAt(gi) : cue && goCue(cue.id))} />
          })}
        </Box>

        {/* Fader numbers + faders (shorter travel, bottom still aligned at 888) */}
        <GridLabels x={44} y={588} w={612} cols={10} items={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']} />
        <div className="cal-faders" data-tour="desk-fader" style={{ left: L(44), top: T(608), width: L(612), height: T(220) }}>
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = bySlot[gi]
            return (
              <div className="cal-fader" key={i}>
                <input
                  type="range" min={0} max={255}
                  value={cue ? playbackLevels[cue.id] ?? 0 : 0}
                  disabled={!cue}
                  title={cue ? `${cue.name} — ${Math.round(((playbackLevels[cue.id] ?? 0) / 255) * 100)}%` : `Fader ${gi + 1}`}
                  onChange={(e) => cue && setPlaybackLevel(cue.id, Number(e.target.value))}
                />
              </div>
            )
          })}
        </div>

        {/* Page keys — +Page/Go Page/−Page joined, level with the two flash rows */}
        <Label x={712} y={434} w={62} text="+ Page" /><Label x={774} y={434} w={62} text="Go Page" />
        <Box x={714} y={454} w={122} h={110} cols={2} rows={2}>
          <Key v="white" led={false} title="Next page" onClick={() => setPlaybackPage(playbackPage + 1)} />
          <Key v="dark" title="Go Page" disabled />
          <Key v="white" led={false} disabled={playbackPage === 0} title="Previous page" onClick={() => setPlaybackPage(Math.max(0, playbackPage - 1))} />
          <span />
        </Box>
        <Label x={712} y={566} w={62} text={`− Page · ${playbackPage + 1}`} />

        {/* Transport 2×3 + Go — dropped down to sit right on top of Go */}
        <Label x={654} y={608} w={56} text={'Live\nTime'} sub="Review" align="right" /><Label x={848} y={608} w={56} text={'Next\nTime'} sub="Snap Back" align="left" />
        <Label x={654} y={672} w={56} text={'Prev\nCue'} align="right" /><Label x={848} y={672} w={56} text={'Next\nCue'} align="left" />
        <Label x={652} y={736} w={58} text={'Connect\n/Cue'} align="right" /><Label x={848} y={736} w={56} text="Stop" align="left" />
        <Box x={714} y={594} w={130} h={178} cols={2} rows={3}>
          <Key v="white" led={false} disabled title="Live Time" /><Key v="white" led={false} disabled title="Next Time" />
          <Key v="white" led={false} disabled={!hasActive} title="Prev Cue — paso anterior del playback conectado" onClick={goBack} />
          <Key v="white" led={false} disabled={!hasActive} title="Next Cue — siguiente paso del playback conectado" onClick={go} />
          <Key v="dark" disabled title="Connect/Cue" /><Key v="dark" disabled={!hasActive} title="Stop — suelta el playback conectado" onClick={stopPlayback} />
        </Box>
        <Box x={749} y={766} w={60} h={62} cols={1} rows={1}>
          <Key v="red" ledColor="red" on={hasActive} disabled={!hasActive} title="Go — avanza el playback conectado al siguiente cue" onClick={go} />
        </Box>
        <Label x={725} y={832} w={108} text="Go" />

        {/* Keypad — one 6×4 grid so every row is evenly spaced */}
        <GridLabels x={916} y={488} w={258} cols={4} items={['Fixture', 'Palette', 'Macro', 'Group']} above />
        <Box x={916} y={498} w={258} h={330} cols={4} rows={6}>
          <Key v="dark" title="Fixture — selección (la ventana de fixtures está a la derecha)" onClick={() => setMenu('root')} />
          <Key v="dark" title="Palettes" onClick={() => { setScreen('colour'); setMenu('palette') }} />
          <Key v="dark" disabled title="Macro" /><Key v="dark" title="Group — workspace de grupos" onClick={() => { setScreen('groups'); setMenu('group') }} />
          <Key v="white" led={false} text="1" title="1" onClick={dig('1')} /><Key v="white" led={false} text="2" title="2" onClick={dig('2')} /><Key v="white" led={false} text="3" title="3" onClick={dig('3')} /><Key v="white" on={shift} text="Avo" title="Avo — activa/desactiva las segundas funciones" onClick={() => setShift((s) => !s)} />
          <Key v="white" led={false} text="4" title="4" onClick={dig('4')} /><Key v="white" led={false} text="5" title="5" onClick={dig('5')} /><Key v="white" led={false} text="6" title="6" onClick={dig('6')} /><Key v="white" ledColor="blue" on={playbackFade > 0} text="TIME" title={`Time — fundido de Go: ${playbackFade}s (clic para cambiar; 0 = Snap)`} onClick={() => { const v = window.prompt('Tiempo de fundido en Go (segundos):', String(playbackFade)); if (v !== null) setPlaybackFade(Number(v.replace(',', '.')) || 0) }} />
          <Key v="white" led={false} text="7" title="7" onClick={dig('7')} /><Key v="white" led={false} text="8" title="8" onClick={dig('8')} /><Key v="white" led={false} text="9" title="9" onClick={dig('9')} /><Key v="white" ledColor="red" on={hasProgrammer} text="CLEAR" title="Clear — vacía el programmer y deselecciona" onClick={() => { clearProgrammer(); select([]) }} />
          <Key v="white" led={false} text="EXIT" title="Exit — salir al menú raíz / vaciar la línea" onClick={() => { cmdClear(); setMenu('root') }} /><Key v="white" led={false} text="0" title="0" onClick={dig('0')} /><Key v="white" led={false} text="ENTER" title="Enter — ejecutar la línea de comandos" onClick={commitCommand} /><Key v="white" led={false} disabled text="." title="." />
          <Key v="dark" led={false} title="Back — borrar" onClick={cmdBackspace} /><Key v="dark" led={false} disabled={noFx} title="Through — rango" onClick={() => cmdAppend(' Through ')} /><Key v="dark" led={false} disabled={noFx} title="And — añadir" onClick={() => cmdAppend(' And ')} /><Key v="dark" led={false} disabled={noSel && noFx} title="@ — intensidad (@ @ = full)" onClick={() => cmdAppend(' @ ')} />
        </Box>
        <GridLabels x={916} y={832} w={258} cols={4} items={['Back', 'Through', 'And', '@']} subs={['Undo', '−%', '+%', 'Redo']} />

        {/* Locate */}
        <Box x={1210} y={718} w={60} h={58} cols={1} rows={1}>
          <Key v="red" ledColor="red" on={!noSel} disabled={noSel} title="Locate selected" onClick={locateSelected} tour="desk-locate" />
        </Box>
        <Label x={1190} y={780} w={100} text="Locate" />
      </div>
    </div>
  )
}
