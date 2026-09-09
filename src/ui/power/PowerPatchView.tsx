import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { MCB, RCD, RCDHager, MainSwitch, ChannelBreaker } from './breakers'
import { PowerCon, Schuko } from './connectors'
import { S4Splitter } from './splitter'
import './power.css'

/**
 * Full-screen "electrical + dimmer patch" module — a faithful 2D replica of Tartanga's power racks
 * so regiduría students can learn the physical layer under the DMX desk.
 *
 * The racks are SOLID objects: fixed size, never stretched/squashed. Like the Quartz desk, the
 * whole thing scales uniformly to fit the screen (aspect preserved).
 *
 * FASE 1-2: the four panels rendered statically and faithfully. Interaction (toggle breakers, drag
 * patch cables, teaching feedback) comes next. Panel labels stay in their real wording (printed on
 * the hardware), like the Titan key names.
 */

const YELLOW = '#e9e94a'
const ORANGE = '#ff7a1a'
const PINK = '#ff2e88'

// A single DIN module: the black main switch, a differential (RCD, with a blue test button and a
// 2-pole lever), or a magnetothermic (MCB, 1-4 poles). Read off the real panel (IMG_7399).
// kinds: main isolator, half-dome RCD (DIMMERS/SOINUA), Hager RCD (FUERZA/EMERG), or an MCB.
type Mod = { kind: 'main' | 'rcd' | 'rcdh' | 'mcb'; name?: string; tab?: string; poles?: number }
const BREAKER_ROWS: { label: string; mods: Mod[] }[] = [
  { label: 'GENERAL', mods: [{ kind: 'main', name: 'GENERAL' }] },
  {
    label: 'DIMMERS',
    mods: [
      { kind: 'rcd' }, { kind: 'mcb', name: 'DIMMER-1', poles: 4 },
      { kind: 'rcd' }, { kind: 'mcb', name: 'DIMMER-2', poles: 4 },
      { kind: 'rcd' }, { kind: 'mcb', name: 'DIMMER-3', poles: 4 },
    ],
  },
  {
    label: 'SOINUA · 32A',
    mods: [
      { kind: 'rcd' }, { kind: 'mcb', name: 'BASE 32A-1', poles: 2 },
      { kind: 'rcd' }, { kind: 'mcb', name: 'BASE 32A-2', poles: 2 },
    ],
  },
  {
    // Hager differentials (lever-left, thin blue button); the pink/orange/yellow markers sit on the
    // RACK breakers, which are 2-pole (like CALEFACTOR / RESERVA / ALMACÉN).
    label: 'FUERZA / DIRECTOS',
    mods: [
      { kind: 'rcdh', name: 'DIF. FUERZA-1' }, { kind: 'mcb', tab: PINK, name: 'RACK 1-4', poles: 2 }, { kind: 'mcb', name: 'CALEFACTOR', poles: 2 },
      { kind: 'rcdh', name: 'DIF. FUERZA-2' }, { kind: 'mcb', tab: ORANGE, name: 'RACK 5-8', poles: 2 }, { kind: 'mcb', name: 'RESERVA', poles: 2 },
      { kind: 'rcdh', name: 'DIF. FUERZA-3' }, { kind: 'mcb', tab: YELLOW, name: 'RACK 9-12', poles: 2 }, { kind: 'mcb', name: 'ALMACÉN', poles: 2 },
    ],
  },
  {
    label: 'EMERGENCIA',
    mods: [
      { kind: 'rcdh', name: 'DIF. ALUMB-1' }, { kind: 'mcb', name: 'Emerg 1', poles: 2 },
      { kind: 'rcdh', name: 'DIF. ALUMB-2' }, { kind: 'mcb', name: 'Emerg 2', poles: 2 },
      { kind: 'rcdh', name: 'DIF. ALUMB-3' }, { kind: 'mcb', name: 'Emerg 3', poles: 2 },
    ],
  },
]


function range(n: number, from = 1) {
  return Array.from({ length: n }, (_, i) => i + from)
}

/** A panel-mount powerCON connector — white or blue, or a capped (blanked-off) position, drawn as
 *  SVG (see connectors.tsx). Same size everywhere. */
function Pcon({ color = 'blue', capped = false }: { color?: 'white' | 'blue'; capped?: boolean }) {
  return <PowerCon color={color} capped={capped} />
}

/** A powerCON cable plug seen head-on, seated in its socket (frontal — no dangling barrel). The
 *  cable itself droops away behind it. */
function CablePlug() {
  return (
    <g className="pw-plug">
      <rect x="-9" y="-9" width="18" height="18" rx="4.5" fill="#3a5bd0" stroke="#20347f" strokeWidth="1.2" />
      <circle r="6.2" fill="#182356" stroke="#0f163a" strokeWidth="0.8" />
      <circle r="2.7" fill="#33489f" />
      <circle cx="-1.4" cy="-1.6" r="1.1" fill="#7d95e8" opacity="0.75" />
    </g>
  )
}

/** A European Schuko cable plug seen head-on, seated in a regleta outlet. */
function SchukoPlug() {
  return (
    <g className="pw-plug">
      <rect x="-10" y="-8.5" width="20" height="17" rx="7" fill="#26272c" stroke="#0e0f12" strokeWidth="1.2" />
      <circle r="4.6" fill="#3a3c42" stroke="#17181b" strokeWidth="0.7" />
      <circle cx="-1.5" cy="-1.5" r="1.1" fill="#55585f" opacity="0.7" />
    </g>
  )
}

type Pt = { x: number; y: number; px: number; py: number }
const ROPE_N = 18

/** Advance every patch cable's verlet rope by `substeps` and write the SVG path + plug transforms
 *  directly. substeps=1 per animation frame; a larger value settles the rope synchronously (e.g. on
 *  creation, so cables show a hanging shape even before/without requestAnimationFrame). */
function simulateCables(row: HTMLElement, patches: { from: string; to: string }[], scale: number, ropes: Map<string, Pt[]>, substeps: number) {
  const N = ROPE_N, GRAV = 0.5, DAMP = 0.96, ITER = 14, SLACK = 1.28
  const rr = row.getBoundingClientRect()
  const centre = (id: string) => {
    const el = row.querySelector(`[data-connid="${id}"]`) as HTMLElement | null
    if (!el) return null
    const c = el.getBoundingClientRect()
    return { x: (c.left + c.width / 2 - rr.left) / scale, y: (c.top + c.height / 2 - rr.top) / scale }
  }
  const alive = new Set<string>()
  for (const p of patches) {
    const key = `${p.from}>${p.to}`
    alive.add(key)
    const a = centre(p.from), b = centre(p.to)
    if (!a || !b) continue
    const dist = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1)
    const rest = (dist * SLACK) / (N - 1)
    let pts = ropes.get(key)
    if (!pts) {
      pts = Array.from({ length: N }, (_, i) => {
        const t = i / (N - 1)
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 24
        return { x, y, px: x, py: y }
      })
      ropes.set(key, pts)
    }
    for (let s = 0; s < substeps; s++) {
      pts[0].x = a.x; pts[0].y = a.y; pts[N - 1].x = b.x; pts[N - 1].y = b.y
      for (let i = 1; i < N - 1; i++) {
        const pt = pts[i]
        const vx = (pt.x - pt.px) * DAMP, vy = (pt.y - pt.py) * DAMP
        pt.px = pt.x; pt.py = pt.y
        pt.x += vx; pt.y += vy + GRAV
      }
      for (let it = 0; it < ITER; it++) {
        pts[0].x = a.x; pts[0].y = a.y; pts[N - 1].x = b.x; pts[N - 1].y = b.y
        for (let i = 0; i < N - 1; i++) {
          const p1 = pts[i], p2 = pts[i + 1]
          const dx = p2.x - p1.x, dy = p2.y - p1.y
          const d = Math.hypot(dx, dy) || 0.001
          const diff = (rest - d) / d
          const ox = dx * diff, oy = dy * diff
          const m1 = i === 0 ? 0 : 1, m2 = i + 1 === N - 1 ? 0 : 1
          if (m1 && m2) { p1.x -= ox * 0.5; p1.y -= oy * 0.5; p2.x += ox * 0.5; p2.y += oy * 0.5 }
          else if (m2) { p2.x += ox; p2.y += oy }
          else if (m1) { p1.x -= ox; p1.y -= oy }
        }
      }
    }
    const pathEl = row.querySelector(`path[data-cablekey="${key}"]`)
    if (pathEl) {
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
      for (let i = 1; i < N; i++) d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
      pathEl.setAttribute('d', d)
    }
    const setPlug = (end: 'a' | 'b', tip: Pt) => {
      const g = row.querySelector(`g[data-cablekey="${key}"][data-end="${end}"]`)
      if (g) g.setAttribute('transform', `translate(${tip.x.toFixed(1)},${tip.y.toFixed(1)})`) // frontal — no rotation
    }
    setPlug('a', pts[0])
    setPlug('b', pts[N - 1])
  }
  for (const key of [...ropes.keys()]) if (!alive.has(key)) ropes.delete(key)
}

/** A clickable, patchable connector — a powerCON socket, or a Schuko outlet for the regletas. */
function Conn({ id, color, sel, patched, onConn, title, schuko }: {
  id: string; color: 'white' | 'blue'; sel: string | null; patched: Set<string>; onConn: (id: string) => void; title?: string; schuko?: boolean
}) {
  return (
    <button type="button" data-connid={id} title={title}
      className={`pw-conn${sel === id ? ' sel' : ''}${patched.has(id) ? ' patched' : ''}`}
      onClick={(e) => { e.stopPropagation(); onConn(id) }}>
      {schuko ? <Schuko /> : <Pcon color={color} />}
    </button>
  )
}

/** A patch bay (CANALES / CIRCUITOS): rows of numbered connectors (null = capped), with a black
 *  ventilation louver strip between the rows. Connectors are clickable to patch cables between bays. */
function Bay({ title, tip, color, rows, perNumber = 1, kind, sel, patched, onConn }: {
  title: string; tip: string; color: 'white' | 'blue'; rows: (number | null)[][]; perNumber?: number
  kind: 'canal' | 'circ'; sel: string | null; patched: Set<string>; onConn: (id: string) => void
}) {
  return (
    <section className="pw-panel pw-rack pw-bay">
      <header title={tip}>{title}</header>
      <div className="pw-bay-body">
        {rows.map((row, ri) => (
          <Fragment key={ri}>
            <div className="pw-bay-row">
              {row.map((c, ci) =>
                c === null ? (
                  <span className="pw-cell" key={ci}><Pcon capped /></span>
                ) : (
                  <span className="pw-cell" key={ci}>
                    <b className="pw-cell-num">{c}</b>
                    <span className="pw-cell-pcons">
                      {Array.from({ length: perNumber }).map((_, i) => (
                        <Conn key={i} id={`${kind}-${c}-${i}`} color={color} sel={sel} patched={patched} onConn={onConn} title={`${c}`} />
                      ))}
                    </span>
                  </span>
                ),
              )}
            </div>
            {ri < rows.length - 1 && <div className="pw-vent" aria-hidden />}
          </Fragment>
        ))}
      </div>
    </section>
  )
}

// CANALES DE DIMMERS: 6 numbers per row, TWO white connectors per number (1-36).
const CANALES_ROWS: (number | null)[][] = Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => r * 6 + c + 1))
// CIRCUITOS: 8 per row in pairs, blue connectors, with capped gaps between the pairs (1 between
// 2-3, 2 between 4-5, 1 between 6-7), like the real rack (1-48).
const CIRCUITOS_ROWS: (number | null)[][] = Array.from({ length: 6 }, (_, r) => {
  const a = r * 8
  return [a + 1, a + 2, null, a + 3, a + 4, null, null, a + 5, a + 6, null, a + 7, a + 8]
})

/** One DIN module drawn as an SVG standard device (see breakers.tsx): the black 4-pole main
 *  isolator, a differential (RCD, box + blue half-dome TEST + blue handle), or a magnetothermic
 *  (MCB, 1-4 poles under a common tie-bar). An optional colour tab codes the FUERZA phases. */
function Module({ m, title, on, onToggle, onTest }: { m: Mod; title: string; on: boolean; onToggle: () => void; onTest: () => void }) {
  return (
    <div className={`pw-mod pw-${m.kind}${on ? '' : ' off'}`} title={m.name ? `${m.name} — ${title}` : title}
      role="button" tabIndex={0} onClick={onToggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
      {m.tab && <span className="pw-mod-tab" style={{ background: m.tab }} />}
      {m.kind === 'main' ? <MainSwitch on={on} /> : m.kind === 'rcd' ? <RCD on={on} onTest={onTest} /> : m.kind === 'rcdh' ? <RCDHager on={on} onTest={onTest} /> : <MCB poles={m.poles ?? 1} on={on} />}
      {m.name && <span className="pw-mod-name">{m.name}</span>}
    </div>
  )
}

const HELP_SECTIONS = ['general', 'diff', 'mcb', 'dimmer', 'directos', 'patch', 'rule'] as const

// Persist the breaker states + patch cables in this browser so students don't re-cable every visit.
const STORE_KEY = 'dmxsim.power.v1'
type PowerState = { breakerOn?: Record<string, boolean>; patches?: { from: string; to: string }[] }
function loadPower(): PowerState {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as PowerState } catch { return {} }
}

export function PowerPatchView() {
  const { t } = useTranslation()
  const close = () => useShowStore.getState().setPowerOpen(false)
  const [showHelp, setShowHelp] = useState(false)

  // --- Interaction: breakers toggle on/off, and powerCON cables patch CANALES <-> CIRCUITOS ---
  const [breakerOn, setBreakerOn] = useState<Record<string, boolean>>(() => loadPower().breakerOn ?? {})
  const isOn = (id: string) => breakerOn[id] ?? true
  const toggle = (id: string) => setBreakerOn((s) => ({ ...s, [id]: !(s[id] ?? true) }))
  const trip = (id: string) => setBreakerOn((s) => ({ ...s, [id]: false })) // TEST button: only ever OFF
  // A dimmer rack (0/1/2 → DIMMER-1/2/3) is powered only if GENERAL and its DIMMER group (the
  // differential + its magnetothermic in the board's DIMMERS row) are all ON. This is how the rack
  // actually gets fed at Tartanga — the channel breakers on the rack are downstream of these.
  const rackPowered = (u: number) => isOn('b-0-0') && isOn(`b-1-${u * 2}`) && isOn(`b-1-${u * 2 + 1}`)

  const [sel, setSel] = useState<string | null>(null) // a connector waiting to be patched
  const [patches, setPatches] = useState<{ from: string; to: string }[]>(() => loadPower().patches ?? [])
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ breakerOn, patches })) } catch { /* ignore quota/private-mode */ }
  }, [breakerOn, patches])
  const resetAll = () => { setBreakerOn({}); setPatches([]); setSel(null); try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ } }
  const patched = new Set<string>(patches.flatMap((p) => [p.from, p.to]))
  // sources feed power out (dimmer channels, directos); sinks receive it (stage circuits, regletas).
  const roleOf = (id: string) => (id.startsWith('canal') || id.startsWith('directo') ? 'src' : 'sink')
  const clickConn = (id: string) => {
    const existing = patches.find((p) => p.from === id || p.to === id)
    if (existing) { setPatches((ps) => ps.filter((p) => p !== existing)); setSel(null); return } // un-patch
    if (!sel) { setSel(id); return }
    if (roleOf(sel) === roleOf(id)) { setSel(id); return } // same role → move the selection
    const from = roleOf(id) === 'src' ? id : sel
    const to = roleOf(id) === 'sink' ? id : sel
    setPatches((ps) => [...ps, { from, to }])
    setSel(null)
  }

  // Cover-flow of three scenes: the breaker board (seen first), the three patch racks (they travel
  // together — you patch them together), and the DMX splitter / data side. The active scene scales
  // to fit and is large; the neighbours peek at the sides, turned like album covers.
  const [scene, setScene] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const racksRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef<HTMLDivElement>(null)
  const [k, setK] = useState({ board: 1, racks: 1, data: 1 })
  const [nav, setNav] = useState<{ nextLeft?: number; prevRight?: number }>({})
  const [rowSize, setRowSize] = useState({ w: 0, h: 0 })
  const ropesRef = useRef<Map<string, { x: number; y: number; px: number; py: number }[]>>(new Map())
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current
      if (!st || st.clientWidth < 200 || st.clientHeight < 120) return // ignore collapsed/transient sizes
      const availH = st.clientHeight - 24
      const availW = st.clientWidth - 150 // room for the side arrows / peeking scenes
      const calc = (el: HTMLDivElement | null, cap: number) =>
        el && el.offsetWidth ? Math.min(availW / el.offsetWidth, availH / el.offsetHeight, cap) : 1
      const nk = { board: calc(boardRef.current, 2.2), racks: calc(racksRef.current, 2.4), data: calc(dataRef.current, 2) }
      setK(nk)
      // place the arrows just outside the ACTIVE scene's on-screen edges (never over a neighbour)
      const el = [boardRef, racksRef, dataRef][scene]?.current
      const ak = [nk.board, nk.racks, nk.data][scene]
      if (el && isFinite(ak)) {
        const halfW = (el.offsetWidth * ak) / 2
        const edge = Math.min(st.clientWidth / 2 + halfW + 14, st.clientWidth - 88)
        setNav({ nextLeft: edge, prevRight: edge }) // symmetric: just outside each edge of the active scene
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [scene])

  // The overlay SVG matches the racks' unscaled size.
  useLayoutEffect(() => {
    const row = racksRef.current
    if (!row) return
    const measure = () => setRowSize({ w: row.offsetWidth, h: row.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    return () => ro.disconnect()
  }, [scene])

  // Settle each cable synchronously when it changes, so it shows a hanging shape immediately (even
  // in a background tab where requestAnimationFrame is paused).
  useLayoutEffect(() => {
    const row = racksRef.current
    if (!row || scene !== 1) return
    simulateCables(row, patches, k.racks || 1, ropesRef.current, 60)
  }, [patches, k.racks, scene, rowSize])

  // Live verlet physics: each cable hangs and swings like a real cable. One sub-step per frame.
  useEffect(() => {
    const row = racksRef.current
    if (!row || scene !== 1) return
    let raf = 0
    const step = () => {
      simulateCables(row, patches, k.racks || 1, ropesRef.current, 1)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [patches, k.racks, scene])

  // outer transform for a slide at position i, given the active scene (cover-flow)
  const slideStyle = (i: number): CSSProperties => {
    const o = i - scene
    if (o === 0) return { transform: 'translateX(0) rotateY(0deg) scale(1)', opacity: 1, zIndex: 3, filter: 'none' }
    if (Math.abs(o) === 1)
      return { transform: `translateX(${o < 0 ? -64 : 64}%) rotateY(${o < 0 ? 26 : -26}deg) scale(0.7)`, opacity: 0.4, zIndex: 2, filter: 'brightness(0.65)' }
    return { transform: `translateX(${o < 0 ? -118 : 118}%) rotateY(${o < 0 ? 32 : -32}deg) scale(0.5)`, opacity: 0, zIndex: 1, filter: 'brightness(0.6)', pointerEvents: 'none' }
  }
  const nextLabel = scene === 0 ? t('power.toRacks') : t('power.toData')
  const prevLabel = scene === 1 ? t('power.toBoard') : t('power.toRacks')

  return (
    <div className="pw-overlay" role="dialog" aria-label={t('power.title')}>
      <div className="pw-topbar">
        <div className="pw-title">⚡ {t('power.title')}</div>
        <span className="pw-tag" title={t('common.pwaTag')}>PWA</span>
        <div className="pw-spacer" />
        <div className="pw-hint">{t('power.hint')}</div>
        <button className="pw-help-btn" onClick={resetAll} title={t('power.resetTip')}>↺ {t('power.reset')}</button>
        <button className="pw-help-btn" onClick={() => setShowHelp((v) => !v)}>❔ {t('power.help.title')}</button>
        <button className="pw-close" onClick={close} title={t('power.close')}>✕</button>
      </div>

      {showHelp && (
        <>
          <div className="pw-help-backdrop" onClick={() => setShowHelp(false)} />
          <aside className="pw-help" role="dialog" aria-label={t('power.help.title')}>
            <div className="pw-help-head">
              <b>{t('power.help.title')}</b>
              <button className="pw-close" onClick={() => setShowHelp(false)} title={t('power.close')}>✕</button>
            </div>
            <p className="pw-help-intro">{t('power.help.intro')}</p>
            {HELP_SECTIONS.map((k) => (
              <div className="pw-help-sec" key={k}>
                <h4>{t(`power.help.${k}.t`)}</h4>
                <p>{t(`power.help.${k}.b`)}</p>
              </div>
            ))}
          </aside>
        </>
      )}

      <div className="pw-stage pw-flow" ref={stageRef}>
        {/* Scene 0 — Cuadro eléctrico (breaker board): the first thing you see */}
        <section className="pw-slide" style={slideStyle(0)} aria-hidden={scene !== 0}>
          <div className="pw-slide-inner" ref={boardRef} style={{ transform: `scale(${k.board})`, pointerEvents: Math.abs(0 - scene) >= 2 ? 'none' : 'auto', cursor: scene === 0 ? 'default' : 'pointer' }} onClick={scene === 0 || Math.abs(0 - scene) >= 2 ? undefined : () => setScene(0)}>
            <section className="pw-panel pw-board">
              <header>{t('power.board')}</header>
              <div className="pw-board-rows">
                {BREAKER_ROWS.map((row, i) => (
                  <div className="pw-board-row" key={i}>
                    <div className="pw-row-label">{row.label}</div>
                    <div className="pw-row-breakers">
                      {row.mods.map((m, j) => {
                        const tip = m.kind === 'main' ? 'general' : m.kind === 'rcd' || m.kind === 'rcdh' ? 'diff' : 'mcb'
                        const id = `b-${i}-${j}`
                        return <Module key={j} m={m} title={t(`power.tip.${tip}`)} on={isOn(id)} onToggle={() => toggle(id)} onTest={() => trip(id)} />
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        {/* Scene 1 — the three patch racks, side by side (they belong together) */}
        <section className="pw-slide" style={slideStyle(1)} aria-hidden={scene !== 1}>
          <div className="pw-slide-inner pw-racks-wrap" ref={racksRef} style={{ transform: `scale(${k.racks})`, pointerEvents: Math.abs(1 - scene) >= 2 ? 'none' : 'auto', cursor: scene === 1 ? 'default' : 'pointer' }} onClick={scene === 1 || Math.abs(1 - scene) >= 2 ? undefined : () => setScene(1)}>
            <div className="pw-racks-row">
            {/* Dimmer racks + DIRECTOS */}
            <section className="pw-panel pw-rack pw-dimmers">
              <header>{t('power.dimmers')}</header>
              {[0, 1, 2].map((u) => (
                <div className="pw-dimmer-slot" key={u}>
                  <div className="pw-dimmer-unit">
                    <span className="pw-dimmer-brand">AT2000⁺</span>
                    <div className="pw-dimmer-lcdcol">
                      {/* LCD lights up only when the rack is fed from the board (GENERAL + DIMMER-u). */}
                      <div className={`pw-dimmer-screen${rackPowered(u) ? ' on' : ''}`} title={t('power.tip.dimmerScreen')}>
                        {rackPowered(u) && (
                          <>
                            <span className="pw-lcd-line">DMX {String(u * 12 + 1).padStart(3, '0')}</span>
                            <span className="pw-lcd-line pw-lcd-dim">CH {u * 12 + 1}–{u * 12 + 12}</span>
                          </>
                        )}
                      </div>
                      {/* 5 menu control buttons under the screen */}
                      <div className="pw-dimmer-menu">{[0, 1, 2, 3, 4].map((b) => <i key={b} />)}</div>
                    </div>
                    <div className="pw-dimmer-chans">
                      {range(12, u * 12 + 1).map((n) => {
                        const id = `ch-${n}`
                        return (
                          <div className={`pw-chan${isOn(id) ? '' : ' off'}`} key={n} role="button" tabIndex={0}
                            title={`${n} · ${t('power.tip.dimmerChan')}`} onClick={() => toggle(id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(id) } }}>
                            <ChannelBreaker on={isOn(id)} /><b>{n}</b>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {u < 2 && <div className="pw-vent" aria-hidden />}
                </div>
              ))}
              <div className="pw-directos" title={t('power.tip.directos')}>
                <div className="pw-directos-label">DIRECTOS</div>
                <div className="pw-directos-bars">
                  <span style={{ background: YELLOW }} />
                  <span style={{ background: ORANGE }} />
                  <span style={{ background: PINK }} />
                </div>
                <div className="pw-directos-row">
                  {range(12).map((n) => (
                    <Conn key={n} id={`directo-${n}-0`} color="white" sel={sel} patched={patched} onConn={clickConn} title={`Directo ${n} — ${t('power.tip.directos')}`} />
                  ))}
                </div>
              </div>
            </section>

            {/* CANALES DE DIMMERS (white connectors, 1-36) */}
            <Bay title="CANALES DE DIMMERS" tip={t('power.tip.canales')} color="white" rows={CANALES_ROWS} perNumber={2} kind="canal" sel={sel} patched={patched} onConn={clickConn} />

            {/* CIRCUITOS (blue connectors, pairs + capped gaps, 1-48) */}
            <Bay title="CIRCUITOS" tip={t('power.tip.circuitos')} color="blue" rows={CIRCUITOS_ROWS} kind="circ" sel={sel} patched={patched} onConn={clickConn} />
            </div>

            {/* Regletas de fuerza — constant-power strips; DIRECTOS (or CIRCUITOS) plug in here */}
            <div className="pw-regletas">
              <section className="pw-panel pw-regletas-panel">
                <header title={t('power.tip.regletas')}>{t('power.regletas')}</header>
                <div className="pw-regletas-row">
                  {range(10).map((n) => (
                    <span className="pw-cell" key={n}>
                      <b className="pw-cell-num">R{n}</b>
                      <Conn id={`regleta-${n}-0`} color="white" sel={sel} patched={patched} onConn={clickConn} title={`Regleta ${n}`} schuko />
                    </span>
                  ))}
                </div>
              </section>
            </div>

            {/* patch cables overlay — verlet ropes with a powerCON plug at each tip (updated in RAF) */}
            {patches.length > 0 && (
              <svg className="pw-cables" width={rowSize.w} height={rowSize.h} style={{ width: rowSize.w, height: rowSize.h }} aria-hidden>
                {patches.map((p) => {
                  const key = `${p.from}>${p.to}`
                  // regleta cables use a Schuko plug at the regleta end, powerCON everywhere else
                  return (
                    <g key={key}>
                      <path data-cablekey={key} className="pw-cable-line" />
                      <g data-cablekey={key} data-end="a">{p.from.startsWith('regleta') ? <SchukoPlug /> : <CablePlug />}</g>
                      <g data-cablekey={key} data-end="b">{p.to.startsWith('regleta') ? <SchukoPlug /> : <CablePlug />}</g>
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </section>

        {/* Scene 2 — DMX splitter (data side): lives behind the racks */}
        <section className="pw-slide" style={slideStyle(2)} aria-hidden={scene !== 2}>
          <div className="pw-slide-inner" ref={dataRef} style={{ transform: `scale(${k.data})`, pointerEvents: Math.abs(2 - scene) >= 2 ? 'none' : 'auto', cursor: scene === 2 ? 'default' : 'pointer' }} onClick={scene === 2 || Math.abs(2 - scene) >= 2 ? undefined : () => setScene(2)}>
            <section className="pw-panel pw-data">
              <header>{t('power.data')}</header>
              <div className="pw-data-flow">
                <span className="pw-data-src">Quartz</span>
                <span className="pw-data-arrow">→</span>
                <S4Splitter />
                <span className="pw-data-arrow">→</span>
                <span className="pw-data-bars">{t('power.dataBars')}</span>
              </div>
              <p className="pw-data-note">{t('power.dataNote')}</p>
            </section>
          </div>
        </section>

        {/* Cover-flow navigation */}
        <button className="pw-nav pw-nav-next" onClick={() => setScene(scene + 1)} hidden={scene >= 2} title={nextLabel} style={nav.nextLeft != null ? { left: nav.nextLeft, right: 'auto' } : undefined}>
          <span className="pw-nav-chev">❯</span>
          <span className="pw-nav-label">{nextLabel}</span>
        </button>
        <button className="pw-nav pw-nav-prev" onClick={() => setScene(scene - 1)} hidden={scene <= 0} title={prevLabel} style={nav.prevRight != null ? { right: nav.prevRight, left: 'auto' } : undefined}>
          <span className="pw-nav-chev">❮</span>
          <span className="pw-nav-label">{prevLabel}</span>
        </button>
      </div>

      <div className="pw-legend">
        <span className="pw-legend-title">{t('power.legendTitle')}</span>
        <span className="pw-legend-item" title={t('power.tip.diff')}><i className="lg lg-diff" />{t('power.lg.diff')}</span>
        <span className="pw-legend-item" title={t('power.tip.test')}><i className="lg lg-test" />{t('power.lg.test')}</span>
        <span className="pw-legend-item" title={t('power.tip.mcb')}><i className="lg lg-mcb" />{t('power.lg.mcb')}</span>
        <span className="pw-legend-item" title={t('power.tip.directos')}><i className="lg lg-directo" />{t('power.lg.directo')}</span>
      </div>
    </div>
  )
}
