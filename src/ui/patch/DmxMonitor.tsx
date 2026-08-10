import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore, useEffectiveProgrammer } from '../../store/showStore'
import { computeUniverse, UNIVERSE_SIZE } from '../../engine/dmx'
import { fixtureFootprint } from '../../model/types'

/** Live grid of all 512 channel values for a universe. */
export function DmxMonitor({ universe = 1 }: { universe?: number }) {
  const { t } = useTranslation()
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const effective = useEffectiveProgrammer()

  const values = useMemo(
    () => computeUniverse(show, definitions, effective, universe),
    [show, definitions, effective, universe],
  )

  // Channels (0-based) owned by the currently selected fixtures in this universe,
  // so selecting a fixture lights up exactly the channels it uses.
  const owned = useMemo(() => {
    const set = new Set<number>()
    const sel = new Set(selection)
    for (const pf of show.fixtures) {
      if (pf.universe !== universe || !sel.has(pf.id)) continue
      const def = definitions[pf.definitionId]
      const fp = def ? fixtureFootprint(def, pf.modeIndex) : 0
      for (let a = pf.address; a < pf.address + fp; a++) set.add(a - 1)
    }
    return set
  }, [show, definitions, selection, universe])

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
                className={`dmx-cell${v > 0 ? ' active' : ''}${owned.has(i) ? ' owned' : ''}`}
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
