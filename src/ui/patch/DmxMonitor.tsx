import { useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore, useEffectiveProgrammer } from '../../store/showStore'
import { computeUniverse, UNIVERSE_SIZE } from '../../engine/dmx'
import { fixtureFootprint } from '../../model/types'

// Which desk attribute bank + touchscreen palette each channel function belongs to,
// so clicking a channel jumps the desk straight to the right control.
const FN_ATTR: Record<string, { attr: string; screen?: string }> = {
  dimmer: { attr: 'Intensity', screen: 'intensity' },
  haze: { attr: 'Intensity', screen: 'intensity' },
  strobe: { attr: 'Intensity', screen: 'intensity' },
  pan: { attr: 'Position', screen: 'position' },
  panFine: { attr: 'Position', screen: 'position' },
  tilt: { attr: 'Position', screen: 'position' },
  tiltFine: { attr: 'Position', screen: 'position' },
  red: { attr: 'Colour', screen: 'colour' },
  green: { attr: 'Colour', screen: 'colour' },
  blue: { attr: 'Colour', screen: 'colour' },
  white: { attr: 'Colour', screen: 'colour' },
  colorWheel: { attr: 'Colour', screen: 'colour' },
  gobo: { attr: 'Gobo', screen: 'gobo' },
  goboRotation: { attr: 'Gobo', screen: 'gobo' },
  prism: { attr: 'Beam', screen: 'beam' },
  shutter: { attr: 'Beam', screen: 'beam' },
  zoom: { attr: 'Beam', screen: 'beam' },
  focus: { attr: 'Beam', screen: 'beam' },
}

type Owner = { id: string; name: string; fn: string; chLabel: string; chIndex: number }

/** Live grid of all 512 channel values for a universe. Clicking a patched channel
 *  selects its fixture and jumps the desk to the matching attribute. */
export function DmxMonitor({ universe = 1 }: { universe?: number }) {
  const { t } = useTranslation()
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const select = useShowStore((s) => s.select)
  const setDeskAttr = useShowStore((s) => s.setDeskAttr)
  const setDeskScreen = useShowStore((s) => s.setDeskScreen)
  const setChannel = useShowStore((s) => s.setChannel)
  const drag = useRef<{ moved: boolean } | null>(null)
  const blind = useShowStore((s) => s.blind)
  const effective = useEffectiveProgrammer(true) // real output — withholds programmer in blind
  const [uni, setUni] = useState(universe)

  const values = useMemo(
    () => computeUniverse(show, definitions, effective, uni),
    [show, definitions, effective, uni],
  )

  // Reverse map: channel index (0-based) → the fixture + function that owns it.
  const owners = useMemo(() => {
    const map = new Map<number, Owner>()
    for (const pf of show.fixtures) {
      if (pf.universe !== uni) continue
      const def = definitions[pf.definitionId]
      if (!def) continue
      const channels = def.modes[pf.modeIndex]?.channels ?? []
      const fp = fixtureFootprint(def, pf.modeIndex)
      for (let k = 0; k < fp; k++) {
        const fn = channels[k]?.function ?? ''
        map.set(pf.address - 1 + k, {
          id: pf.id,
          name: pf.name,
          fn,
          chLabel: channels[k]?.name ?? fn,
          chIndex: k,
        })
      }
    }
    return map
  }, [show, definitions, uni])

  // Universes that actually have fixtures patched, so the switcher only offers real ones.
  const universes = useMemo(() => {
    const set = new Set<number>([1])
    for (const pf of show.fixtures) set.add(pf.universe)
    return [...set].sort((a, b) => a - b)
  }, [show.fixtures])

  // Channels owned by the current selection — highlighted with a coral ring.
  const owned = useMemo(() => {
    const set = new Set<number>()
    const sel = new Set(selection)
    for (const [ch, o] of owners) if (sel.has(o.id)) set.add(ch)
    return set
  }, [owners, selection])

  const onChannel = (o: Owner) => {
    select([o.id])
    const target = FN_ATTR[o.fn]
    if (target) {
      setDeskAttr(target.attr)
      if (target.screen) setDeskScreen(target.screen)
    }
  }

  // Drag a patched cell up/down to set its channel 0–255 (quick value entry); a plain
  // click (no drag) just selects the fixture + jumps the desk to its attribute.
  const onCellDown = (e: React.PointerEvent, o: Owner, startVal: number) => {
    e.preventDefault()
    drag.current = { moved: false }
    select([o.id])
    const startY = e.clientY
    const move = (ev: PointerEvent) => {
      if (!drag.current) return
      const dy = startY - ev.clientY
      if (Math.abs(dy) > 2) drag.current.moved = true
      setChannel(o.id, o.chIndex, Math.max(0, Math.min(255, Math.round(startVal + dy * 1.6))))
    }
    const up = () => {
      if (drag.current && !drag.current.moved) onChannel(o)
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="panel">
      <header className="mon-header">
        <h2>{t('monitor.title')}</h2>
        {universes.length <= 1 && <span className="sub">{t('monitor.subtitle', { universe: uni })}</span>}
        {blind && <span className="blind-badge" title="Blind: el programmer no sale a la salida real">BLIND</span>}
        {universes.length > 1 && (
          <div className="vh-tools">
            {universes.map((u) => (
              <button
                key={u}
                className={`ghost-btn${u === uni ? ' active' : ''}`}
                onClick={() => setUni(u)}
              >
                U{u}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="scroll">
        <div className="dmx-grid">
          {Array.from({ length: UNIVERSE_SIZE }, (_, i) => {
            const v = values[i]
            const pct = (v / 255) * 100
            const owner = owners.get(i)
            const title = owner
              ? `Channel ${i + 1} · ${owner.name} — ${owner.chLabel}: ${v}  (clic: seleccionar · arrastra ↕ para fijar valor)`
              : `Channel ${i + 1}: ${v}`
            return (
              <div
                key={i}
                className={`dmx-cell${v > 0 ? ' active' : ''}${owned.has(i) ? ' owned' : ''}${owner ? ' patched' : ''}`}
                title={title}
                onPointerDown={owner ? (e) => onCellDown(e, owner, v) : undefined}
                style={owner ? { touchAction: 'none' } : undefined}
                role={owner ? 'button' : undefined}
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
