import { useEffect, useRef, useState } from 'react'
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

type Bk = { name: string; tab?: string; rcd?: boolean; main?: boolean }
// Breaker board (cuadro eléctrico) rows, read off the real panel (IMG_7399). RCDs (differentials)
// carry a blue test button.
const BREAKER_ROWS: { label: string; breakers: Bk[] }[] = [
  { label: 'GENERAL', breakers: [{ name: 'GENERAL', main: true }] },
  { label: 'DIMMERS', breakers: [{ name: 'DIMMER-1', rcd: true }, { name: 'DIMMER-2', rcd: true }, { name: 'DIMMER-3', rcd: true }] },
  { label: 'SOINUA · 32A', breakers: [{ name: 'BASE 32A-1', rcd: true }, { name: 'BASE 32A-2', rcd: true }] },
  {
    label: 'FUERZA / DIRECTOS',
    breakers: [
      { name: 'DIFERENCIAL FUERZA', rcd: true, tab: PINK },
      { name: 'CALEFACTOR RACK' },
      { name: 'RESERVA' },
      { name: 'DIFERENCIAL FUERZA', rcd: true, tab: ORANGE },
      { name: 'RACK' },
      { name: 'ALTAVOZ SALA', tab: YELLOW },
    ],
  },
  { label: 'EMERGENCIA', breakers: [{ name: 'Emerg', rcd: true }, { name: 'Emerg', rcd: true }, { name: 'Emerg', rcd: true }] },
]

// DIRECTOS outlets (constant power): 4 yellow, 4 orange, 4 pink (IMG_7394).
const DIRECTOS: string[] = [YELLOW, YELLOW, YELLOW, YELLOW, ORANGE, ORANGE, ORANGE, ORANGE, PINK, PINK, PINK, PINK]

function range(n: number, from = 1) {
  return Array.from({ length: n }, (_, i) => i + from)
}

function Socket({ n }: { n: number }) {
  return (
    <div className="pw-socket" title={`${n}`}>
      <span className="pw-socket-ring" />
      <span className="pw-socket-num">{n}</span>
    </div>
  )
}

/** A breaker. RCD (differential) = wider, with a blue test button; main = the black-bezel general. */
function Breaker({ name, tab, rcd, main, on = true }: Bk & { on?: boolean }) {
  return (
    <div className={`pw-breaker${rcd ? ' rcd' : ''}${main ? ' main' : ''}`} title={name}>
      <span className="pw-breaker-tab" style={{ background: tab ?? 'transparent' }} />
      <div className="pw-breaker-body">
        {rcd && <span className="pw-rcd-test" title="Test" />}
        <span className={`pw-breaker-sw${on ? ' on' : ''}`}><span /></span>
      </div>
      <span className="pw-breaker-name">{name}</span>
    </div>
  )
}

export function PowerPatchView() {
  const { t } = useTranslation()
  const close = () => useShowStore.getState().setPowerOpen(false)

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
        <button className="pw-close" onClick={close} title={t('power.close')}>✕</button>
      </div>

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
                    {row.breakers.map((b, j) => <Breaker key={j} {...b} />)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2 — Dimmer racks + DIRECTOS */}
          <section className="pw-panel pw-rack pw-dimmers">
            <header>{t('power.dimmers')}</header>
            {[0, 1, 2].map((u) => (
              <div className="pw-dimmer-unit" key={u}>
                <div className="pw-dimmer-brand">TINHAO · AT2000⁺</div>
                <div className="pw-dimmer-chans">
                  {range(12, u * 12 + 1).map((n) => (
                    <div className="pw-mcb" key={n} title={`Canal ${n}`}><span /><b>{n}</b></div>
                  ))}
                </div>
              </div>
            ))}
            <div className="pw-directos">
              <div className="pw-directos-label">DIRECTOS</div>
              <div className="pw-directos-row">
                {DIRECTOS.map((c, i) => (
                  <div className="pw-socket" key={i} title={`Directo ${i + 1}`}>
                    <span className="pw-directos-tab" style={{ background: c }} />
                    <span className="pw-socket-ring" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 3 — CANALES DE DIMMERS (dimmer outputs 1-36) */}
          <section className="pw-panel pw-rack pw-bay">
            <header>CANALES DE DIMMERS</header>
            <div className="pw-grid">{range(36).map((n) => <Socket key={n} n={n} />)}</div>
          </section>

          {/* 4 — CIRCUITOS (stage circuits 1-48) */}
          <section className="pw-panel pw-rack pw-bay">
            <header>CIRCUITOS</header>
            <div className="pw-grid">{range(48).map((n) => <Socket key={n} n={n} />)}</div>
          </section>
        </div>
      </div>
    </div>
  )
}
