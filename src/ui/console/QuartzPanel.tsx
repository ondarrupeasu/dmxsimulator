import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  v = 'dark', led = true, ledColor, ledBottom, on, dim, flash, text, hint, avo, narrow, assignable, disabled, title, onClick, onContextMenu, tour,
}: {
  v?: V; led?: boolean; ledColor?: 'red' | 'blue'; ledBottom?: boolean; on?: boolean; dim?: boolean; flash?: boolean
  text?: string; hint?: string; avo?: boolean; narrow?: boolean; assignable?: boolean; disabled?: boolean; title?: string
  onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; tour?: string
}) {
  return (
    <button
      className={`ck ck-${v}${ledBottom ? ' ledb' : ''}${narrow ? ' narrow' : ''}${assignable ? ' assignable' : ''}${avo ? ' ck-avo' : ''}`}
      disabled={disabled} title={title} onClick={onClick} onContextMenu={onContextMenu} data-tour={tour}
    >
      {led && <span className={`ckled${on ? ' on' : ''}${dim ? ' dim' : ''}${flash ? ' flash' : ''}${ledColor ? ' ' + ledColor : ''}`} />}
      {text != null && <span className="cktext">{text}</span>}
      {hint && <span className="ckhint">{hint}</span>}
    </button>
  )
}

// Fixed executors 11–18 → the touchscreen workspace each opens (the ones we have windows for).
const EXEC_SCREEN: Record<number, string> = { 11: 'intensity', 12: 'showlib', 13: 'playbacks', 16: 'colour', 17: 'groups' }
// Silk-screen names of the fixed executors, for tooltips.
const EXEC_FIXED_LABEL: Record<number, string> = {
  11: 'Attribute Editor', 12: 'Show Library', 13: 'Playbacks', 14: 'Channel Grid',
  15: 'Visualiser', 16: 'Groups + Palettes', 17: 'Fixtures + Groups', 18: 'Snap',
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
  const fanMode = useShowStore((s) => s.fanMode)
  const fanAdjust = useShowStore((s) => s.fanAdjust)
  const [spin, setSpin] = useState(0)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!fn) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    let v = value; let lastY = e.clientY
    const move = (ev: PointerEvent) => {
      const dy = lastY - ev.clientY; lastY = ev.clientY
      if (fanMode) fanAdjust(fn, dy * 1.5) // Fan mode: the wheel spreads the value instead of setting it
      else { v = clamp(v + dy * 1.5); setByFn(fn, Math.round(v)) }
      setSpin((s) => s + dy * 2)
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  return (
    <div className={`calwheel${fn ? '' : ' idle'}${fanMode && fn ? ' fanning' : ''}`} style={{ left: L(x), top: T(y), width: L(d), height: T(d) }}
      onPointerDown={onPointerDown} title={fn ? (fanMode ? `Fan ${fn} — gira para abanicar por la selección` : `${fn}: ${value}`) : 'no control'} data-tour={tour}>
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
  const { t } = useTranslation()
  // Avo = the Titan "shift". No physical desk, so it latches: click to hold the
  // second functions on, click again to release. State is shown loudly (see badge).
  const [shift, setShift] = useState(false)
  const [showZones, setShowZones] = useState(false)
  const attr = useShowStore((s) => s.deskAttr)
  const setAttr = useShowStore((s) => s.setDeskAttr)
  const setScreen = useShowStore((s) => s.setDeskScreen)
  const setRightPanel = useShowStore((s) => s.setRightPanel)
  const viewerVisible = useShowStore((s) => s.viewerVisible)
  const setViewerVisible = useShowStore((s) => s.setViewerVisible)
  const deskScreen = useShowStore((s) => s.deskScreen)
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
  const connectArm = useShowStore((s) => s.connectArm)
  const armConnect = useShowStore((s) => s.armConnect)
  const connectPlayback = useShowStore((s) => s.connectPlayback)
  const playbackPage = useShowStore((s) => s.playbackPage)
  const setPlaybackPage = useShowStore((s) => s.setPlaybackPage)
  const playbackLevels = useShowStore((s) => s.playbackLevels)
  const firedLevels = useShowStore((s) => s.firedLevels)
  const setPlaybackLevel = useShowStore((s) => s.setPlaybackLevel)
  const fades = useShowStore((s) => s.fades)
  const killPlayback = useShowStore((s) => s.killPlayback)
  const flash = useShowStore((s) => s.flash)
  const swop = useShowStore((s) => s.swop)
  const flashIds = useShowStore((s) => s.flashIds)
  const swopId = useShowStore((s) => s.swopId)
  const playbackFade = useShowStore((s) => s.playbackFade)
  const setPlaybackFade = useShowStore((s) => s.setPlaybackFade)
  const executorLabels = useShowStore((s) => s.executorLabels)
  const setExecutorLabel = useShowStore((s) => s.setExecutorLabel)
  const executorCues = useShowStore((s) => s.executorCues)
  const recordExecutor = useShowStore((s) => s.recordExecutor)
  const clearExecutor = useShowStore((s) => s.clearExecutor)
  const editExecutor = (n: number) => {
    const cur = executorLabels[n] ?? ''
    const v = window.prompt(t('desk.execLabelPrompt', { n }), cur)
    if (v !== null) setExecutorLabel(n, v)
  }
  const hasProgrammer = useShowStore((s) => Object.keys(s.programmer).length > 0)
  // A playback is "up" if the manual fader OR the fired level is above 0 (or fading up).
  const isUp = (id: string) => (playbackLevels[id] ?? 0) > 0 || (firedLevels[id] ?? 0) > 0 || !!(fades[id] && fades[id].to > 0)
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
  const clearSelectedFunctions = useShowStore((s) => s.clearSelectedFunctions)
  const fanMode = useShowStore((s) => s.fanMode)
  const toggleFanMode = useShowStore((s) => s.toggleFanMode)
  const blind = useShowStore((s) => s.blind)
  const setBlind = useShowStore((s) => s.setBlind)
  const highlight = useShowStore((s) => s.highlight)
  const toggleHighlight = useShowStore((s) => s.toggleHighlight)
  const cmdAppend = useShowStore((s) => s.cmdAppend)
  const cmdBackspace = useShowStore((s) => s.cmdBackspace)
  const cmdClear = useShowStore((s) => s.cmdClear)
  const commitCommand = useShowStore((s) => s.commitCommand)

  // SIMULATOR EXTRA: drive the command line from the computer keyboard (the real desk has a
  // physical keypad; a PWA has no keys, so this is a convenience). Ignored while typing in a
  // real input/textarea so it never fights the show-name/legend fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      // "@" is Option+2 on a Mac (altKey) and AltGr+2 on Windows (which the browser reports as
      // Ctrl+Alt). Let those through — the resulting e.key is already "@". Block only real
      // shortcuts: Cmd, or Ctrl WITHOUT Alt.
      if (e.metaKey || (e.ctrlKey && !e.altKey)) return
      const k = e.key
      if (/^[0-9]$/.test(k)) cmdAppend(k)
      else if (k === '.') cmdAppend('.')
      else if (k === 'Enter') commitCommand()
      else if (k === 'Backspace') cmdBackspace()
      else if (k === 'Escape') cmdClear()
      else if (k === '@') cmdAppend(' @ ')
      else if (k === '>') cmdAppend(' Through ')
      else if (k === '+') cmdAppend(' And ')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cmdAppend, cmdBackspace, cmdClear, commitCommand])

  // SIMULATOR EXTRA that's actually MORE faithful: the two playback-fader button rows on the
  // computer keyboard — QWERTYUIOP = top row (Flash), ASDFGHJKLÑ = bottom row (Swop). Unlike a
  // mouse (one pointer), the keyboard can hold several at once and momentarily, exactly like
  // pressing several buttons with your hands on the real desk. A per-key map remembers which
  // playback each key fired so releasing frees the right one even if you changed page.
  useEffect(() => {
    const FLASH = 'qwertyuiop'
    const SWOP = 'asdfghjklñ;'
    const pressed: Record<string, string> = {}
    const faderId = (i: number): string | undefined => {
      const s = useShowStore.getState()
      return playbacksBySlot(s.playbacks)[s.playbackPage * 10 + i]?.id
    }
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    }
    const onDown = (e: KeyboardEvent) => {
      if (isField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const fi = FLASH.indexOf(k)
      const si = SWOP.indexOf(k)
      if (fi < 0 && si < 0) return
      e.preventDefault()
      if (e.repeat || pressed[k]) return
      // Caps Lock reroutes the same 20 keys to the EXECUTORS (1–10 top, 11–20 bottom): tap to
      // fire / tap again to release the executor bound to it.
      if (e.getModifierState('CapsLock')) {
        const n = fi >= 0 ? fi + 1 : Math.min(si, 9) + 11
        const s = useShowStore.getState()
        const pid = s.executorCues[n]
        if (pid) {
          const up = (s.playbackLevels[pid] ?? 0) > 0 || (s.firedLevels[pid] ?? 0) > 0
          if (up) s.killPlayback(pid)
          else s.goCue(pid)
        }
        return
      }
      const id = faderId(fi >= 0 ? fi : Math.min(si, 9))
      if (!id) return
      pressed[k] = id
      if (fi >= 0) useShowStore.getState().setFlash(id, true)
      else useShowStore.getState().setSwop(id, true)
    }
    const release = (k: string) => {
      const id = pressed[k]
      if (!id) return
      delete pressed[k]
      if (FLASH.includes(k)) useShowStore.getState().setFlash(id, false)
      else useShowStore.getState().setSwop(id, false)
    }
    const onUp = (e: KeyboardEvent) => release(e.key.toLowerCase())
    const onBlur = () => { for (const k of Object.keys(pressed)) release(k) } // don't leave keys stuck
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const active = ATTRIBUTES.find((a) => a.name === attr) ?? ATTRIBUTES[0]
  const wheelFns = [0, 1, 2].map((i) => active.wheels[i]?.find((fn) => present.has(fn)))
  const activeFns = active.wheels.flat() // every function in the active attribute bank
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
        {showZones ? t('common.hideZones') : t('common.zones')}
      </button>
      <div className={`qcal${shift ? ' shift' : ''}${swopId ? ' swopping' : ''}`}>
        {(shift || flashIds.length > 0 || swopId || connectArm || fanMode) && (
          <div className="cal-modes-badge">
            {shift && <span className="mb-avo">AVO · segundas funciones</span>}
            {flashIds.length > 0 && <span className="mb-flash">FLASH ×{flashIds.length}</span>}
            {swopId && <span className="mb-swop">SWOP · resto en negro</span>}
            {connectArm && <span className="mb-flash">CONNECT · toca un playback</span>}
            {fanMode && <span className="mb-flash">FAN · gira una rueda</span>}
            {!connectArm && <span className="mb-hint">clic en el botón para apagar</span>}
          </div>
        )}
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
                ? t('desk.execFire', { n, name: cue.name })
                : hasProgrammer
                  ? t('desk.execRecordHere', { n })
                  : t('desk.execLabel', { n })
              return (
                <Key
                  key={i} v="dark" narrow assignable={!caption} ledColor="blue" on={lit} dim={!!cue && !lit}
                  title={title}
                  onClick={() => onExecutor(n)}
                  onContextMenu={(e) => { e.preventDefault(); if (cue) clearExecutor(n) }}
                />
              )
            }
            // 11–18 are FIXED-function executors (printed on the desk): unlike an empty
            // assignable handle they always carry a function, so their LED is lit — DIM when
            // idle, BRIGHT when their workspace is the one on screen (Show-Occupation model).
            const label = EXEC_FIXED_LABEL[n]
            const scr = EXEC_SCREEN[n]
            if (scr) {
              const active = deskScreen === scr
              return <Key key={i} v="dark" narrow ledColor="blue" on={active} dim={!active}
                title={t('desk.execWorkspace', { n, label })} onClick={() => setScreen(scr)} />
            }
            // 15 Visualiser: show/hide the Visualiser pane (like opening/closing Capture) —
            // bright when it's showing, dim when hidden.
            if (n === 15) {
              return <Key key={i} v="dark" narrow ledColor="blue" on={viewerVisible} dim={!viewerVisible}
                title={t('desk.execViz', { n, label })} onClick={() => setViewerVisible(!viewerVisible)} />
            }
            // 14 Channel Grid / 18 Snap: fixed functions we haven't built yet — lit dim (assigned
            // on the real desk) but inert here, said so in the tooltip.
            return <Key key={i} v="dark" narrow ledColor="blue" dim disabled title={t('desk.execFixed', { n, label })} />
          })}
        </Box>
        <GridLabels x={648} y={172} w={640} cols={10} small items={['11\nAttribute\nEditor', '12\nShow\nLibrary', '13\nPlaybacks', '14\nChannel\nGrid', '15\nVisualiser', '16\nGroups +\nPalettes', '17\nFixtures\n+ Groups', '18\nSnap', execCaption(19) ? `19\n${execCaption(19)}` : '19', execCaption(20) ? `20\n${execCaption(20)}` : '20']} />

        {/* Fix / All / HiLight */}
        <GridLabels x={40} y={270} w={100} cols={2} items={['Fix −1', 'Fix +1']} above />
        <Box x={40} y={272} w={100} h={118} cols={2} rows={2} narrow>
          <Key v="dark" narrow led={false} disabled={fixtures.length < 2} title={t('desk.fixPrev')} onClick={() => step(-1)} />
          <Key v="dark" narrow led={false} disabled={fixtures.length < 2} title={t('desk.fixNext')} onClick={() => step(1)} />
          <Key v="dark" narrow on={!noFx && selection.length === fixtures.length} disabled={noFx} title={t('desk.all')} onClick={() => select(fixtures.map((f) => f.id))} />
          <Key v="dark" narrow ledColor="blue" on={highlight} title={t('desk.hiLight')} onClick={toggleHighlight} />
        </Box>
        <GridLabels x={40} y={392} w={100} cols={2} items={['All', 'Hi\nLight']} subs={['Rem Dim', 'Lo Light']} />

        {/* Attribute bank 7×2 */}
        <GridLabels x={178} y={270} w={452} cols={7} items={['Intensity', 'Position', 'Colour', 'Gobo', 'Beam', 'Effect', 'Special']} above />
        <Box x={178} y={272} w={452} h={118} cols={7} rows={2}>
          {ATTRIBUTES.map((a) => <Key key={a.name} v="white" on={a.name === attr} title={a.name} onClick={() => setAttr(a.name)} tour={a.name === 'Position' ? 'desk-position' : a.name === 'Colour' ? 'desk-colour' : undefined} />)}
          <Key v="white" title="Shape → Shapes" onClick={() => setScreen('effects')} tour="desk-shape" />
          <Key v="white" title={t('desk.mlMenu')} onClick={() => setMenu('ml')} /><Key v="white" ledColor="red" on={blind} title={t('desk.blind')} onClick={() => setBlind(!blind)} tour="desk-blind" /><Key v="white" disabled={noSel || activeFns.length === 0} title={t('desk.off', { attr: active.name })} onClick={() => clearSelectedFunctions(activeFns)} />
          <Key v="white" ledColor="blue" on={fanMode} title={t('desk.fan')} onClick={toggleFanMode} /><Key v="white" disabled title="Options" /><Key v="dark" disabled title="Latch Menu" />
        </Box>
        <GridLabels x={178} y={392} w={452} cols={7} items={['Shape', 'ML\nMenu', 'Blind', 'Off', 'Fan', 'Options', 'Latch\nMenu']} />

        {/* Program keys 6×2 */}
        <GridLabels x={658} y={270} w={386} cols={6} items={['Record', 'Update', 'Edit', 'Select\nIf', 'Patch', 'Disk']} subs={['', '', '', '', '', 'Setup']} above />
        <Box x={658} y={272} w={386} h={118} cols={6} rows={2}>
          <Key v="dark" ledColor="red" on={recordArm || hasProgrammer} flash={recordArm} title={recordArm ? 'Record armado — parpadea esperando que elijas el fader donde grabar (pulsa Record otra vez para cancelar)' : 'Record — pulsa y luego elige el fader donde guardar'} onClick={() => { setMenu('record'); if (hasProgrammer || recordArm) armRecord() }} tour="desk-record" />
          <Key v="white" led={false} disabled={!hasActive || !hasProgrammer} title="Update" onClick={() => connectedId && updateCue(connectedId)} />
          <Key v="white" led={false} disabled title="Edit" /><Key v="white" led={false} disabled title="Select If" /><Key v="white" led={false} title={t('desk.patch')} onClick={() => { setMenu('patch'); setRightPanel('patch') }} /><Key v="white" led={false} title="Disk — Save / Load / New Show" onClick={() => setMenu('disk')} />
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
          <Key v="dark" narrow led={false} title={t('desk.viewOpen')} onClick={() => setMenu('view')} /><Key v="dark" narrow led={false} disabled title="Close/Control" />
        </Box>
        <GridLabels x={1074} y={392} w={122} cols={2} items={['View\n/Open', 'Close\nControl']} />

        {/* Flash rows: top row LED at bottom, bottom row no LED. Spread to align with faders. */}
        <Frame x={38} y={448} w={624} h={116} />
        <Box x={44} y={454} w={612} h={104} cols={10} rows={2} spread>
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = bySlot[gi]
            const flashed = !!cue && flashIds.includes(cue.id)
            const connected = !!cue && connectedId === cue.id
            const on = !!cue && (isUp(cue.id) || flashed || (connectArm && connected))
            // Titan Show-Occupation LED model: empty handle → LED off; occupied + fader down →
            // DIM (there's something stored here); occupied + up (or flashed) → BRIGHT. While
            // Record/Connect is armed, the valid targets FLASH to say "pick one".
            const armed = recordArm || connectArm
            const inner = recordArm ? (cue ? t('desk.recordOver', { name: cue.name }) : t('desk.recordHere'))
              : connectArm ? (cue ? t('desk.connectTo', { name: cue.name }) : t('desk.empty'))
              : cue ? t('desk.flashName', { name: cue.name, state: flashed ? t('desk.flashOn') : t('desk.flashClickOn') }) : t('desk.empty')
            return <Key key={`t${i}`} v={recordArm ? 'red' : 'blue'} narrow ledBottom on={on} flash={armed} dim={!armed && !!cue && !on} hint={'QWERTYUIOP'[i]} disabled={(!recordArm && !connectArm && !cue) || (connectArm && !cue)} title={t('desk.flashKey', { label: inner, key: 'QWERTYUIOP'[i] })}
              onClick={recordArm ? () => recordCueAt(gi) : connectArm ? (cue ? () => connectPlayback(cue.id) : undefined) : cue ? () => flash(cue.id) : undefined} />
          })}
          {Array.from({ length: 10 }, (_, i) => {
            const gi = playbackPage * 10 + i; const cue = bySlot[gi]
            const swopped = !!cue && swopId === cue.id
            // Bottom button = SWOP (solo): this playback full, everything else off. Toggle here
            // for the same reason as Flash (no press-and-hold with a mouse).
            const inner = recordArm ? (cue ? t('desk.recordOver', { name: cue.name }) : t('desk.recordHere'))
              : cue ? t('desk.swopName', { name: cue.name, state: swopped ? t('desk.swopOnState') : t('desk.swopClickOn') }) : t('desk.empty')
            return <Key key={`b${i}`} v={recordArm || swopped ? 'red' : 'dark'} narrow led={swopped} ledBottom on={swopped} hint={'ASDFGHJKLÑ'[i]} disabled={!recordArm && !cue} title={t('desk.swopKey', { label: inner, key: 'ASDFGHJKLÑ'[i] })}
              onClick={recordArm ? () => recordCueAt(gi) : cue ? () => swop(cue.id) : undefined} />
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
          <Key v="white" led={false} disabled={!hasActive} title={t('desk.prevCue')} onClick={goBack} />
          <Key v="white" led={false} disabled={!hasActive} title={t('desk.nextCue')} onClick={go} />
          <Key v="dark" ledColor="blue" on={connectArm} flash={connectArm} disabled={!playbacks.length} title={connectArm ? t('desk.connectArmed') : t('desk.connect')} onClick={armConnect} /><Key v="dark" disabled={!hasActive} title={t('desk.stop')} onClick={stopPlayback} />
        </Box>
        <Box x={749} y={766} w={60} h={62} cols={1} rows={1}>
          <Key v="red" ledColor="red" on={hasActive} disabled={!hasActive} title={t('desk.go')} onClick={go} />
        </Box>
        <Label x={725} y={832} w={108} text="Go" />

        {/* Keypad — one 6×4 grid so every row is evenly spaced */}
        <GridLabels x={916} y={488} w={258} cols={4} items={['Fixture', 'Palette', 'Macro', 'Group']} above />
        <Box x={916} y={498} w={258} h={330} cols={4} rows={6}>
          <Key v="dark" title={t('desk.fixtureKey')} onClick={() => setMenu('root')} />
          <Key v="dark" title="Palettes" onClick={() => { setScreen('colour'); setMenu('palette') }} />
          <Key v="dark" disabled title="Macro" /><Key v="dark" title={t('desk.group')} onClick={() => { setScreen('groups'); setMenu('group') }} />
          <Key v="white" led={false} text="1" title="1" onClick={dig('1')} /><Key v="white" led={false} text="2" title="2" onClick={dig('2')} /><Key v="white" led={false} text="3" title="3" onClick={dig('3')} /><Key v="white" on={shift} avo text="avo" title={t('desk.avo')} onClick={() => setShift((s) => !s)} />
          <Key v="white" led={false} text="4" title="4" onClick={dig('4')} /><Key v="white" led={false} text="5" title="5" onClick={dig('5')} /><Key v="white" led={false} text="6" title="6" onClick={dig('6')} /><Key v="white" ledColor="blue" on={playbackFade > 0} text="TIME" title={t('desk.time', { secs: playbackFade })} onClick={() => { const v = window.prompt(t('desk.timePrompt'), String(playbackFade)); if (v !== null) setPlaybackFade(Number(v.replace(',', '.')) || 0) }} />
          <Key v="white" led={false} text="7" title="7" onClick={dig('7')} /><Key v="white" led={false} text="8" title="8" onClick={dig('8')} /><Key v="white" led={false} text="9" title="9" onClick={dig('9')} /><Key v="white" ledColor="red" on={hasProgrammer} text="CLEAR" title={t('desk.clear')} onClick={() => { clearProgrammer(); select([]) }} />
          <Key v="white" led={false} text="EXIT" title={t('desk.exit')} onClick={() => { cmdClear(); setMenu('root') }} /><Key v="white" led={false} text="0" title="0" onClick={dig('0')} /><Key v="white" led={false} text="ENTER" title={t('desk.enter')} onClick={commitCommand} /><Key v="white" led={false} text="." title={t('desk.dot')} onClick={dig('.')} />
          <Key v="dark" led={false} title={t('desk.back')} onClick={cmdBackspace} /><Key v="dark" led={false} disabled={noFx} title={t('desk.through')} onClick={() => cmdAppend(' Through ')} /><Key v="dark" led={false} disabled={noFx} title={t('desk.and')} onClick={() => cmdAppend(' And ')} /><Key v="dark" led={false} disabled={noSel && noFx} title={t('desk.at')} onClick={() => cmdAppend(' @ ')} />
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
