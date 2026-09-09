import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import './power.css'

/**
 * Full-screen "electrical + dimmer patch" module — a faithful 2D replica of Tartanga's power racks
 * so regiduría students can learn the physical layer under the DMX desk (which fixtures go to the
 * dimmers vs to DIRECTOS, how a circuit→dimmer patch sets the DMX address, the breakers, …).
 *
 * FASE 1-2: the four panels rendered statically and faithfully. Interaction (toggle breakers, drag
 * patch cables, teaching feedback) comes next. Panel labels stay in their real Spanish/Basque wording
 * (they're printed on the actual hardware), like the Titan key names.
 */

// Breaker board (cuadro eléctrico) rows, from the real panel (IMG_7399).
const BREAKER_ROWS: { label: string; breakers: { name: string; tab?: string }[] }[] = [
  { label: 'GENERAL', breakers: [{ name: 'GENERAL' }, { name: 'GENERAL' }] },
  { label: 'DIMMERS', breakers: [{ name: 'DIMMER-1' }, { name: 'DIMMER-2' }, { name: 'DIMMER-3' }] },
  { label: 'SOINUA · 32A', breakers: [{ name: 'BASE 32A-1' }, { name: 'BASE 32A-2' }] },
  {
    label: 'FUERZA / DIRECTOS',
    breakers: [
      { name: 'DIFERENCIAL FUERZA', tab: '#ff2e88' },
      { name: 'CALEFACTOR RACK', tab: '#ff7a1a' },
      { name: 'RESERVA' },
      { name: 'DIFERENCIAL', tab: '#e9e94a' },
    ],
  },
  { label: 'EMERGENCIA', breakers: [{ name: 'Emerg' }, { name: 'Emerg' }, { name: 'Emerg' }] },
]

// The DIRECTOS panel's outlets (constant power, colour-tabbed) — real panel had ~8 (IMG_7394).
const DIRECTOS = ['#e9e94a', '#e9e94a', '#ff7a1a', '#ff7a1a', '#ff2e88', '#ff2e88', '#3a9bff', '#3a9bff']

function range(n: number, from = 1) {
  return Array.from({ length: n }, (_, i) => i + from)
}

/** A single powercon-style socket with a number under it. */
function Socket({ n }: { n: number }) {
  return (
    <div className="pw-socket" title={`${n}`}>
      <span className="pw-socket-ring" />
      <span className="pw-socket-num">{n}</span>
    </div>
  )
}

/** A breaker toggle (static for now; up = on). */
function Breaker({ name, tab, on = true }: { name: string; tab?: string; on?: boolean }) {
  return (
    <div className="pw-breaker" title={name}>
      {tab && <span className="pw-breaker-tab" style={{ background: tab }} />}
      <span className={`pw-breaker-sw${on ? ' on' : ''}`}><span /></span>
      <span className="pw-breaker-name">{name}</span>
    </div>
  )
}

export function PowerPatchView() {
  const { t } = useTranslation()
  const close = () => useShowStore.getState().setPowerOpen(false)

  return (
    <div className="pw-overlay" role="dialog" aria-label={t('power.title')}>
      <div className="pw-topbar">
        <div className="pw-title">⚡ {t('power.title')}</div>
        <span className="pw-tag" title={t('common.pwaTag')}>PWA</span>
        <div className="pw-spacer" />
        <div className="pw-hint">{t('power.hint')}</div>
        <button className="pw-close" onClick={close} title={t('power.close')}>✕</button>
      </div>

      <div className="pw-stage">
        {/* 1 — Cuadro eléctrico (breaker board) */}
        <section className="pw-panel pw-board">
          <header>{t('power.board')}</header>
          <div className="pw-board-rows">
            {BREAKER_ROWS.map((row, i) => (
              <div className="pw-board-row" key={i}>
                <div className="pw-row-label">{row.label}</div>
                <div className="pw-row-breakers">
                  {row.breakers.map((b, j) => <Breaker key={j} name={b.name} tab={b.tab} />)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2 — Dimmer racks + DIRECTOS */}
        <section className="pw-panel pw-dimmers">
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
                  <span className="pw-socket-ring" />
                  <span className="pw-directos-tab" style={{ background: c }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3 — CANALES DE DIMMERS (dimmer outputs 1-36) */}
        <section className="pw-panel pw-bay">
          <header>CANALES DE DIMMERS</header>
          <div className="pw-grid pw-grid-6">
            {range(36).map((n) => <Socket key={n} n={n} />)}
          </div>
        </section>

        {/* 4 — CIRCUITOS (stage circuits 1-48) */}
        <section className="pw-panel pw-bay">
          <header>CIRCUITOS</header>
          <div className="pw-grid pw-grid-6">
            {range(48).map((n) => <Socket key={n} n={n} />)}
          </div>
        </section>
      </div>
    </div>
  )
}
