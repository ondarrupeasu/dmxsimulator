import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { fixtureAttributeKeys, ATTRIBUTE_BANKS, type PatchedFixture } from '../../model/types'
import { AimPad } from './AimPad'

/** The Fixtures / Groups workspace, docked on the right next to the visualiser (an APP window,
 *  not the Quartz desk — so extras that the real console doesn't show live here). Selecting
 *  drives the desk exactly as selecting on the touchscreen does. */
export function FixturesWindow() {
  const { t } = useTranslation()
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const select = useShowStore((s) => s.select)
  const clearSelection = useShowStore((s) => s.clearSelection)
  const setFixtureAim = useShowStore((s) => s.setFixtureAim)
  const noFx = show.fixtures.length === 0
  const anchor = useRef<number | null>(null)

  // A fixture with no pan/tilt (a PAR, profile…) can't be aimed from the desk — you angle it
  // by hand on the truss. Those are "aimable" here.
  const isAimable = (pf: PatchedFixture) => {
    const def = definitions[pf.definitionId]
    return def ? !fixtureAttributeKeys(def, pf.modeIndex).has('P') && def.category !== 'hazer' : false
  }
  // The single aim joystick in the header drives every selected aimable fixture at once.
  const selAimable = show.fixtures.filter((pf) => selection.includes(pf.id) && isAimable(pf))
  const aim = selAimable[0]?.aim ?? { pan: 0, tilt: 0 }

  // Group by universe, sorted by address within each; single universe → one plain list.
  const groups = useMemo(() => {
    const m = new Map<number, PatchedFixture[]>()
    for (const pf of show.fixtures) {
      const arr = m.get(pf.universe) ?? []
      arr.push(pf)
      m.set(pf.universe, arr)
    }
    const unis = [...m.keys()].sort((a, b) => a - b)
    unis.forEach((u) => m.get(u)!.sort((a, b) => a.address - b.address))
    return unis.map((u) => [u, m.get(u)!] as const)
  }, [show.fixtures])
  const multi = groups.length > 1
  const flatIds = useMemo(() => groups.flatMap(([, fx]) => fx.map((f) => f.id)), [groups])

  const onFxClick = (e: React.MouseEvent, id: string, index: number) => {
    if (e.shiftKey && anchor.current !== null) {
      const [a, b] = [anchor.current, index].sort((x, y) => x - y)
      select([...new Set([...selection, ...flatIds.slice(a, b + 1)])])
    } else {
      toggleSelect(id)
      anchor.current = index
    }
  }

  let idx = -1
  return (
    <div className="panel" data-tour="fixtures">
      <header className="fx-win-header">
        <h2>{t('fixturesWindow.title')}</h2>
        <div className="vh-tools">
          <button className="ghost-btn" disabled={noFx} onClick={() => select(show.fixtures.map((f) => f.id))}>
            {t('fixturesWindow.all')}
          </button>
          <button className="ghost-btn" disabled={selection.length === 0} onClick={clearSelection}>
            {t('fixturesWindow.clear')}
          </button>
        </div>
      </header>
      {selAimable.length > 0 && (
        <div className="fx-aim-bar" title="Orientación física del foco (montaje — no es DMX). Míralo en el 3D.">
          <span className="fx-aim-cap">Aim ↺ {selAimable.length > 1 ? `${selAimable.length} focos` : selAimable[0].name}</span>
          <AimPad pan={aim.pan} tilt={aim.tilt} onChange={(p, tl) => selAimable.forEach((f) => setFixtureAim(f.id, p, tl))} />
        </div>
      )}
      <div className="scroll">
        {noFx ? (
          <span className="qd-muted">{t('fixturesWindow.empty')}</span>
        ) : (
          groups.map(([uni, fx]) => (
            <div key={uni}>
              {multi && <div className="section-label">Universe {uni}</div>}
              <div className="qd-fixtures">
                {fx.map((pf) => {
                  idx++
                  const index = idx
                  const has = fixtureAttributeKeys(definitions[pf.definitionId], pf.modeIndex)
                  const aimable = isAimable(pf)
                  return (
                    <button
                      key={pf.id}
                      className={`qd-fx${selection.includes(pf.id) ? ' sel' : ''}`}
                      onClick={(e) => onFxClick(e, pf.id, index)}
                      title={`${pf.name} · ${definitions[pf.definitionId]?.model} · U${pf.universe}.${pf.address}${aimable ? ' · orientable (selecciónalo y usa el joystick de arriba)' : ''}  (shift-clic: rango)`}
                    >
                      <span className="qd-fx-name">
                        {pf.name}
                        {aimable && <span className="qd-fx-aimicon" title="Orientable a mano">⌖</span>}
                      </span>
                      <span className="qd-fx-def">{definitions[pf.definitionId]?.model}</span>
                      <span className="qd-fx-attrs">
                        {ATTRIBUTE_BANKS.map((b) => (
                          <span key={b.key} className={has.has(b.key) ? 'on' : ''} title={b.label}>{b.key}</span>
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
