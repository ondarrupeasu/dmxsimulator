import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore, useEffectiveProgrammer } from '../../store/showStore'
import { computeUniverse, UNIVERSE_SIZE } from '../../engine/dmx'

/** Live grid of all 512 channel values for a universe. */
export function DmxMonitor({ universe = 1 }: { universe?: number }) {
  const { t } = useTranslation()
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const effective = useEffectiveProgrammer()

  const values = useMemo(
    () => computeUniverse(show, definitions, effective, universe),
    [show, definitions, effective, universe],
  )

  return (
    <div className="panel">
      <header>
        <h2>{t('monitor.title')}</h2>
        <span className="sub">{t('monitor.subtitle', { universe })}</span>
      </header>
      <div className="scroll">
        <div className="dmx-grid">
          {Array.from({ length: UNIVERSE_SIZE }, (_, i) => {
            const v = values[i]
            const pct = (v / 255) * 100
            return (
              <div
                key={i}
                className={`dmx-cell${v > 0 ? ' active' : ''}`}
                title={`Channel ${i + 1}: ${v}`}
              >
                {v > 0 && <span className="fill" style={{ height: `${pct}%` }} />}
                <span className="ch">{i + 1}</span>
                {v > 0 && <span className="val">{v}</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
