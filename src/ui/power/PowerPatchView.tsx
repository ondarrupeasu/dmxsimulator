import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { MCB, RCD, RCDHager, MainSwitch, ChannelBreaker } from './breakers'
import { PowerCon } from './connectors'
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

/** A patch bay (CANALES / CIRCUITOS): rows of numbered connectors (null = capped), with a black
 *  ventilation louver strip between the rows, faithfully to the real racks. */
function Bay({ title, tip, color, rows, perNumber = 1 }: { title: string; tip: string; color: 'white' | 'blue'; rows: (number | null)[][]; perNumber?: number }) {
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
                  <span className="pw-cell" key={ci} title={`${c}`}>
                    <b className="pw-cell-num">{c}</b>
                    <span className="pw-cell-pcons">{Array.from({ length: perNumber }).map((_, i) => <Pcon key={i} color={color} />)}</span>
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
function Module({ m, title }: { m: Mod; title: string }) {
  return (
    <div className={`pw-mod pw-${m.kind}`} title={m.name ? `${m.name} — ${title}` : title}>
      {m.tab && <span className="pw-mod-tab" style={{ background: m.tab }} />}
      {m.kind === 'main' ? <MainSwitch /> : m.kind === 'rcd' ? <RCD /> : m.kind === 'rcdh' ? <RCDHager /> : <MCB poles={m.poles ?? 1} />}
      {m.name && <span className="pw-mod-name">{m.name}</span>}
    </div>
  )
}

const HELP_SECTIONS = ['general', 'diff', 'mcb', 'dimmer', 'directos', 'patch', 'rule'] as const

export function PowerPatchView() {
  const { t } = useTranslation()
  const close = () => useShowStore.getState().setPowerOpen(false)
  const [showHelp, setShowHelp] = useState(false)

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
                        return <Module key={j} m={m} title={t(`power.tip.${tip}`)} />
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
          <div className="pw-slide-inner pw-racks-row" ref={racksRef} style={{ transform: `scale(${k.racks})`, pointerEvents: Math.abs(1 - scene) >= 2 ? 'none' : 'auto', cursor: scene === 1 ? 'default' : 'pointer' }} onClick={scene === 1 || Math.abs(1 - scene) >= 2 ? undefined : () => setScene(1)}>
            {/* Dimmer racks + DIRECTOS */}
            <section className="pw-panel pw-rack pw-dimmers">
              <header>{t('power.dimmers')}</header>
              {[0, 1, 2].map((u) => (
                <div className="pw-dimmer-slot" key={u}>
                  <div className="pw-dimmer-unit">
                    <div className="pw-dimmer-face">
                      {/* LCD is OFF (dark, blank) until the rack is powered (interaction phase). */}
                      <div className="pw-dimmer-screen" title={t('power.tip.dimmerScreen')}>
                        <div className="pw-dimmer-btns"><i /><i /><i /><i /></div>
                      </div>
                      <span className="pw-dimmer-brand">TINHAO&nbsp;·&nbsp;AT2000⁺</span>
                    </div>
                    <div className="pw-dimmer-chans">
                      {range(12, u * 12 + 1).map((n) => (
                        <div className="pw-chan" key={n} title={`${n} · ${t('power.tip.dimmerChan')}`}><ChannelBreaker /><b>{n}</b></div>
                      ))}
                    </div>
                  </div>
                  {u < 2 && <div className="pw-vent" aria-hidden />}
                </div>
              ))}
              <div className="pw-directos" title={t('power.tip.directos')}>
                <div className="pw-directos-label">DIRECTOS</div>
                <div className="pw-directos-bars">
                  <span style={{ background: PINK }} />
                  <span style={{ background: ORANGE }} />
                  <span style={{ background: YELLOW }} />
                </div>
                <div className="pw-directos-row">
                  {range(12).map((n) => (
                    <span key={n} title={`Directo ${n} — ${t('power.tip.directos')}`}><Pcon color="white" /></span>
                  ))}
                </div>
              </div>
            </section>

            {/* CANALES DE DIMMERS (white connectors, 1-36) */}
            <Bay title="CANALES DE DIMMERS" tip={t('power.tip.canales')} color="white" rows={CANALES_ROWS} perNumber={2} />

            {/* CIRCUITOS (blue connectors, pairs + capped gaps, 1-48) */}
            <Bay title="CIRCUITOS" tip={t('power.tip.circuitos')} color="blue" rows={CIRCUITOS_ROWS} />
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
