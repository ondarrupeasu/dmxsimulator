import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
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
type Mod = { kind: 'main' | 'rcd' | 'mcb'; name?: string; tab?: string; poles?: number }
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
    label: 'FUERZA / DIRECTOS',
    mods: [
      { kind: 'rcd', tab: PINK, name: 'DIF. FUERZA-1' }, { kind: 'mcb', name: 'RACK 1-4', poles: 4 }, { kind: 'mcb', name: 'CALEFACTOR' },
      { kind: 'rcd', tab: ORANGE, name: 'DIF. FUERZA-2' }, { kind: 'mcb', name: 'RACK 5-8', poles: 4 }, { kind: 'mcb', name: 'RESERVA' },
      { kind: 'rcd', tab: YELLOW, name: 'DIF. FUERZA-3' }, { kind: 'mcb', name: 'RACK 9-12', poles: 4 }, { kind: 'mcb', name: 'ALMACÉN' },
    ],
  },
  {
    label: 'EMERGENCIA',
    mods: [
      { kind: 'rcd' }, { kind: 'mcb', name: 'Emerg 1' }, { kind: 'rcd' }, { kind: 'mcb', name: 'Emerg 2' }, { kind: 'rcd' }, { kind: 'mcb', name: 'Emerg 3' },
    ],
  },
]


function range(n: number, from = 1) {
  return Array.from({ length: n }, (_, i) => i + from)
}

/** A panel-mount powerCON connector — white or blue, or a capped (blanked-off) position. Same
 *  size everywhere. */
function Pcon({ color = 'blue', capped = false }: { color?: 'white' | 'blue'; capped?: boolean }) {
  if (capped) return <span className="pw-pcon capped" />
  return <span className={`pw-pcon ${color}`}><i /></span>
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

/** One DIN module drawn like the real device: N pole toggles (small T-levers, up = ON) joined by a
 *  common handle bar for multi-pole; a differential (RCD) is a box with a blue half-dome TEST button
 *  and a blue handle; the main is a black 4-pole switch. */
function Module({ m, title, testTitle }: { m: Mod; title: string; testTitle: string }) {
  const poles = m.kind === 'main' ? 4 : m.kind === 'rcd' ? 2 : m.poles ?? 1
  const width = m.kind === 'main' ? 74 : m.kind === 'rcd' ? 40 : Math.max(16, poles * 8 + 6)
  return (
    <div className={`pw-mod pw-${m.kind}`} style={{ width }} title={m.name ? `${m.name} — ${title}` : title}>
      <span className="pw-mod-tab" style={{ background: m.tab ?? 'transparent' }} />
      <div className="pw-mod-body">
        {m.kind === 'rcd' && <span className="pw-rcd-test" title={testTitle} />}
        <div className="pw-toggles">
          {poles > 1 && <span className="pw-tie" />}
          {Array.from({ length: poles }).map((_, i) => <span key={i} className="pw-pole on" />)}
        </div>
      </div>
      <span className="pw-mod-name">{m.name ?? ''}</span>
    </div>
  )
}

const HELP_SECTIONS = ['general', 'diff', 'mcb', 'dimmer', 'directos', 'patch', 'rule'] as const

export function PowerPatchView() {
  const { t } = useTranslation()
  const close = () => useShowStore.getState().setPowerOpen(false)
  const [showHelp, setShowHelp] = useState(false)

  // Uniform scale-to-fit: the racks keep their fixed size and never squash — the whole board
  // scales down (or up a touch) to fit the viewport, like the Quartz desk.
  const stageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current, ct = contentRef.current
      if (!st || !ct) return
      const k = Math.min((st.clientWidth - 28) / ct.offsetWidth, (st.clientHeight - 28) / ct.offsetHeight, 1.5)
      if (k > 0 && isFinite(k)) setScale(k)
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [])

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

      <div className="pw-stage" ref={stageRef}>
        <div className="pw-content" ref={contentRef} style={{ transform: `scale(${scale})` }}>
          {/* 1 — Cuadro eléctrico (breaker board) */}
          <section className="pw-panel pw-board">
            <header>{t('power.board')}</header>
            <div className="pw-board-rows">
              {BREAKER_ROWS.map((row, i) => (
                <div className="pw-board-row" key={i}>
                  <div className="pw-row-label">{row.label}</div>
                  <div className="pw-row-breakers">
                    {row.mods.map((m, j) => {
                      const tip = m.kind === 'main' ? 'general' : m.kind === 'rcd' ? 'diff' : 'mcb'
                      return <Module key={j} m={m} title={t(`power.tip.${tip}`)} testTitle={t('power.tip.test')} />
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2 — Dimmer racks + DIRECTOS */}
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
                      <div className="pw-mcb" key={n} title={`${n} · ${t('power.tip.dimmerChan')}`}><span className="pw-mcb-lever" /><b>{n}</b></div>
                    ))}
                  </div>
                </div>
                <div className="pw-vent" aria-hidden />
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

          {/* 3 — CANALES DE DIMMERS (white connectors, 1-36) */}
          <Bay title="CANALES DE DIMMERS" tip={t('power.tip.canales')} color="white" rows={CANALES_ROWS} perNumber={2} />

          {/* 4 — CIRCUITOS (blue connectors, pairs + capped gaps, 1-48) */}
          <Bay title="CIRCUITOS" tip={t('power.tip.circuitos')} color="blue" rows={CIRCUITOS_ROWS} />
        </div>
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
