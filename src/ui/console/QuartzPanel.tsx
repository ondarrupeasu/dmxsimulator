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
  v = 'dark', led = true, ledColor, ledBottom, on, text, narrow, assignable, disabled, title, onClick, tour,
}: {
  v?: V; led?: boolean; ledColor?: 'red' | 'blue'; ledBottom?: boolean; on?: boolean
  text?: string; narrow?: boolean; assignable?: boolean; disabled?: boolean; title?: string; onClick?: () => void; tour?: string
}) {
  return (
    <button
      className={`ck ck-${v}${ledBottom ? ' ledb' : ''}${narrow ? ' narrow' : ''}${assignable ? ' assignable' : ''}`}
      disabled={disabled} title={title} onClick={onClick} data-tour={tour}
    >
      {led && <span className={`ckled${on ? ' on' : ''}${ledColor ? ' ' + ledColor : ''}`} />}
      {text != null && <span className="cktext">{text}</span>}
    </button>
  )
}

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
function Frame({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <div className="cal-frame" style={{ left: L(x), top: T(y), width: L(w), height: T(h) }} />
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
  { name: 'Playback faders', x: 36, y: 444, w: 628, h: 460, c: '#7d8cff' },
  { name: 'Playbacks / Go', x: 644, y: 592, w: 268, h: 306, c: '#ff77b0' },
  { name: 'Keypad · command line', x: 906, y: 456, w: 372, h: 442, c: '#9be14a' },
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
  const executorLabels = useShowStore((s) => s.executorLabels)
  const setExecutorLabel = useShowStore((s) => s.setExecutorLabel)
  const editExecutor = (n: number) => {
    const cur = executorLabels[n] ?? ''
    const v = window.prompt(`Executor ${n} — escribe su etiqueta (vacío para borrar)`, cur)
    if (v !== null) setExecutorLabel(n, v)
  }
  const hasProgrammer = useShowStore((s) => Object.keys(s.programmer).length > 0)
  const present = useSelectionFunctions()
  const fixtures = useShowStore((s) => s.show.fixtures)
  const select = useShowStore((s) => s.select)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const cmdAppend = useShowStore((s) => s.cmdAppend)
  const cmdBackspace = useShowStore((s) => s.cmdBackspace)
  const cmdClear = useShowStore((s) => s.cmdClear)
  const commitCommand = useShowStore((s) => s.commitCommand)

  const active = ATTRIBUTES.find((a) => a.name === attr) ?? ATTRIBUTES[0]
  const wheelFns = [0, 1, 2].map((i) => active.wheels[i]?.find((fn) => present.has(fn)))
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
  const hasActive = !!activeCueId
  const goRel = (dir: 1 | -1) => {
    if (!cues.length) return
    const idx = cues.findIndex((c) => c.id === activeCueId)
    goCue(cues[idx < 0 ? (dir > 0 ? 0 : cues.length - 1) : (idx + dir + cues.length) % cues.length].id)
  }

  return (
    <div className="qpanel">
      <button className="qcal-zonetoggle" onClick={() => setShowZones((s) => !s)}>
        {showZones ? 'Ocultar zonas' : 'Ver zonas'}
      </button>
      <div className={`qcal${shift ? ' shift' : ''}`}>
        {shift && <div className="cal-shift-badge">AVO · segundas funciones activas</div>}
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
        <Frame x={642} y={48} w={652} h={124} />
        <GridLabels x={648} y={52} w={640} cols={10} small above
          items={Array.from({ length: 10 }, (_, i) => (executorLabels[i + 1] ? `${executorLabels[i + 1]}\n${i + 1}` : String(i + 1)))} />
        <Box x={648} y={54} w={640} h={112} cols={10} rows={2} spread>
          {Array.from({ length: 20 }, (_, i) => {
            const n = i + 1
            // 1–10 (top) and 19–20 are blank/assignable; 11–18 have fixed functions.
            if (n <= 10 || n >= 19) {
              const label = executorLabels[n]
              return (
                <Key
                  key={i} v="dark" narrow assignable={!label}
                  title={label ? `Executor ${n}: ${label}` : `Executor ${n} — clic para etiquetar`}
                  onClick={() => editExecutor(n)}
                />
              )
            }
            return <Key key={i} v="dark" narrow disabled title={`Executor ${n}`} />
          })}
        </Box>
        <GridLabels x={648} y={172} w={640} cols={10} small items={['11\nAttribute\nEditor', '12\nShow\nLibrary', '13\nPlaybacks', '14\nChannel\nGrid', '15\nVisualiser', '16\nGroups +\nPalettes', '17\nFixtures\n+ Groups', '18\nSnap', executorLabels[19] ? `19\n${executorLabels[19]}` : '19', executorLabels[20] ? `20\n${executorLabels[20]}` : '20']} />

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
          <Key v="white" title="ML Menu — menú Moving Light" onClick={() => setMenu('ml')} /><Key v="white" disabled title="Blind" /><Key v="white" disabled title="Off" />
          <Key v="white" disabled title="Fan" /><Key v="white" disabled title="Options" /><Key v="dark" disabled title="Latch Menu" />
        </Box>
        <GridLabels x={178} y={392} w={452} cols={7} items={['Shape', 'ML\nMenu', 'Blind', 'Off', 'Fan', 'Options', 'Latch\nMenu']} />

        {/* Program keys 6×2 */}
        <GridLabels x={658} y={270} w={386} cols={6} items={['Record', 'Update', 'Edit', 'Select\nIf', 'Patch', 'Disk']} subs={['', '', '', '', '', 'Setup']} above />
        <Box x={658} y={272} w={386} h={118} cols={6} rows={2}>
          <Key v="dark" ledColor="red" on={hasProgrammer} title="Record — abre el menú Record" onClick={() => { setMenu('record'); if (hasProgrammer) recordCue() }} tour="desk-record" />
          <Key v="white" led={false} disabled={!hasActive || !hasProgrammer} title="Update" onClick={() => activeCueId && updateCue(activeCueId)} />
          <Key v="white" led={false} disabled title="Edit" /><Key v="white" led={false} disabled title="Select If" /><Key v="white" led={false} title="Patch — abre el menú Patch" onClick={() => setMenu('patch')} /><Key v="white" led={false} disabled title="Disk" />
          <Key v="white" led={false} disabled={!hasActive} title="Delete" onClick={() => activeCueId && deleteCue(activeCueId)} />
          <Key v="white" led={false} disabled={!hasActive} title="Copy" onClick={() => activeCueId && copyCue(activeCueId)} />
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
            const gi = playbackPage * 10 + i; const cue = cues[gi]; const on = !!cue && cue.id === activeCueId
            return <Key key={`t${i}`} v="dark" narrow ledBottom on={on} disabled={!cue} title={cue ? `Go ${cue.name}` : 'Empty'} onClick={() => cue && goCue(cue.id)} />
          })}
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = cues[gi]
            return <Key key={`b${i}`} v="dark" narrow led={false} disabled={!cue} title={cue ? `Flash ${cue.name}` : 'Empty'} onClick={() => cue && goCue(cue.id)} />
          })}
        </Box>

        {/* Fader numbers + faders (shorter travel, bottom still aligned at 888) */}
        <GridLabels x={44} y={648} w={612} cols={10} items={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']} />
        <div className="cal-faders" data-tour="desk-fader" style={{ left: L(44), top: T(668), width: L(612), height: T(220) }}>
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = cues[gi]
            return (
              <div className="cal-fader" key={i}>
                <input type="range" min={0} max={255} defaultValue={cue ? 255 : 0} disabled={!cue} title={cue ? cue.name : `Fader ${gi + 1}`} />
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
        <Label x={654} y={668} w={56} text={'Live\nTime'} sub="Review" align="right" /><Label x={848} y={668} w={56} text={'Next\nTime'} sub="Snap Back" align="left" />
        <Label x={654} y={732} w={56} text={'Prev\nCue'} align="right" /><Label x={848} y={732} w={56} text={'Next\nCue'} align="left" />
        <Label x={652} y={796} w={58} text={'Connect\n/Cue'} align="right" /><Label x={848} y={796} w={56} text="Stop" align="left" />
        <Box x={714} y={654} w={130} h={178} cols={2} rows={3}>
          <Key v="white" led={false} disabled title="Live Time" /><Key v="white" led={false} disabled title="Next Time" />
          <Key v="white" led={false} disabled={!cues.length} title="Prev Cue" onClick={() => goRel(-1)} />
          <Key v="white" led={false} disabled={!cues.length} title="Next Cue" onClick={() => goRel(1)} />
          <Key v="dark" disabled title="Connect/Cue" /><Key v="dark" disabled title="Stop" />
        </Box>
        <Box x={749} y={826} w={60} h={62} cols={1} rows={1}>
          <Key v="red" ledColor="red" on={cues.length > 0} disabled={!cues.length} title="Go" onClick={() => goRel(1)} />
        </Box>
        <Label x={725} y={892} w={108} text="Go" />

        {/* Keypad — one 6×4 grid so every row is evenly spaced */}
        <GridLabels x={916} y={548} w={258} cols={4} items={['Fixture', 'Palette', 'Macro', 'Group']} above />
        <Box x={916} y={558} w={258} h={330} cols={4} rows={6}>
          <Key v="dark" title="Fixtures" onClick={() => { setScreen('fixtures'); setMenu('root') }} />
          <Key v="dark" title="Palettes" onClick={() => { setScreen('colour'); setMenu('palette') }} />
          <Key v="dark" disabled title="Macro" /><Key v="dark" title="Group — menú Group" onClick={() => setMenu('group')} />
          <Key v="white" led={false} text="1" title="1" onClick={dig('1')} /><Key v="white" led={false} text="2" title="2" onClick={dig('2')} /><Key v="white" led={false} text="3" title="3" onClick={dig('3')} /><Key v="white" on={shift} text="Avo" title="Avo — activa/desactiva las segundas funciones" onClick={() => setShift((s) => !s)} />
          <Key v="white" led={false} text="4" title="4" onClick={dig('4')} /><Key v="white" led={false} text="5" title="5" onClick={dig('5')} /><Key v="white" led={false} text="6" title="6" onClick={dig('6')} /><Key v="white" ledColor="blue" disabled text="TIME" title="Time" />
          <Key v="white" led={false} text="7" title="7" onClick={dig('7')} /><Key v="white" led={false} text="8" title="8" onClick={dig('8')} /><Key v="white" led={false} text="9" title="9" onClick={dig('9')} /><Key v="white" ledColor="red" on={hasProgrammer} text="CLEAR" title="Clear the programmer" onClick={clearProgrammer} />
          <Key v="white" led={false} text="EXIT" title="Exit — salir al menú raíz / vaciar la línea" onClick={() => { cmdClear(); setMenu('root') }} /><Key v="white" led={false} text="0" title="0" onClick={dig('0')} /><Key v="white" led={false} text="ENTER" title="Enter — ejecutar la línea de comandos" onClick={commitCommand} /><Key v="white" led={false} disabled text="." title="." />
          <Key v="dark" led={false} title="Back — borrar" onClick={cmdBackspace} /><Key v="dark" led={false} disabled={noFx} title="Through — rango" onClick={() => cmdAppend(' Through ')} /><Key v="dark" led={false} disabled={noFx} title="And — añadir" onClick={() => cmdAppend(' And ')} /><Key v="dark" led={false} disabled={noSel && noFx} title="@ — intensidad (@ @ = full)" onClick={() => cmdAppend(' @ ')} />
        </Box>
        <GridLabels x={916} y={892} w={258} cols={4} items={['Back', 'Through', 'And', '@']} subs={['Undo', '−%', '+%', 'Redo']} />

        {/* Locate */}
        <Box x={1210} y={778} w={60} h={58} cols={1} rows={1}>
          <Key v="red" ledColor="red" on={!noSel} disabled={noSel} title="Locate selected" onClick={locateSelected} tour="desk-locate" />
        </Box>
        <Label x={1190} y={840} w={100} text="Locate" />
      </div>
    </div>
  )
}
