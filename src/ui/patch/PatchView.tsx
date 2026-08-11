import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import { useShowStore } from '../../store/showStore'
import { fixtureFootprint, type FixtureCategory } from '../../model/types'
import { TRUSSES, DEFAULT_TRUSS } from '../../model/venue'

const UNIVERSES = [1, 2, 3, 4] // the Quartz has four DMX outputs

// Library grouping — display order + section labels by fixture category.
const CATEGORY_ORDER: FixtureCategory[] = ['movingHead', 'par', 'dimmer', 'strobe', 'hazer', 'other']
const CATEGORY_LABELS: Record<FixtureCategory, string> = {
  movingHead: 'Moving heads',
  par: 'PAR / LED',
  dimmer: 'Dimmers',
  strobe: 'Strobes',
  hazer: 'Haze / Fog',
  other: 'Conventionals',
}

export function PatchView() {
  const { t } = useTranslation()
  const definitions = useShowStore((s) => s.definitions)
  const show = useShowStore((s) => s.show)
  const selection = useShowStore((s) => s.selection)
  const addFixture = useShowStore((s) => s.addFixture)
  const removeFixture = useShowStore((s) => s.removeFixture)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const select = useShowStore((s) => s.select)
  const setFixturePosition = useShowStore((s) => s.setFixturePosition)
  const setFixtureTruss = useShowStore((s) => s.setFixtureTruss)
  const setFixtureUniverse = useShowStore((s) => s.setFixtureUniverse)
  const readdressByRigOrder = useShowStore((s) => s.readdressByRigOrder)

  // Truss strip — drag a chip to set its position along the rig (x = −1..1).
  const stripRef = useRef<HTMLDivElement>(null)
  const dragId = useRef<string | null>(null)
  const moveTo = (clientX: number, id: string) => {
    const strip = stripRef.current
    if (!strip) return
    const r = strip.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, ((clientX - r.left) / r.width) * 2 - 1))
    const pf = show.fixtures.find((f) => f.id === id)
    setFixturePosition(id, x, pf?.position.y ?? 0.6)
  }
  const onChipDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault()
    dragId.current = id
    select([id])
    moveTo(e.clientX, id)
    const move = (ev: PointerEvent) => moveTo(ev.clientX, id)
    const up = () => {
      dragId.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // The rig strip shows one truss at a time (or all), so mixed-truss rigs read clearly.
  const [rigTruss, setRigTruss] = useState<number | 'all'>('all')
  const stripFixtures = show.fixtures
    .map((pf, i) => ({ pf, n: i + 1 }))
    .filter(({ pf }) => rigTruss === 'all' || (pf.truss ?? DEFAULT_TRUSS) === rigTruss)

  // Library search + category grouping.
  const [query, setQuery] = useState('')
  const libRef = useRef<ImperativePanelHandle>(null)
  const [libCollapsed, setLibCollapsed] = useState(false)
  const library = useMemo(
    () =>
      Object.values(definitions).sort((a, b) =>
        `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`),
      ),
    [definitions],
  )
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = library.filter((d) => !q || `${d.manufacturer} ${d.model}`.toLowerCase().includes(q))
    return CATEGORY_ORDER.map((cat) => [cat, matches.filter((d) => d.category === cat)] as const).filter(
      ([, defs]) => defs.length > 0,
    )
  }, [library, query])

  return (
    <PanelGroup direction="vertical" autoSaveId="dmxsim-patch-v1">
      {/* TOP window — rig layout + patched fixtures. */}
      <Panel defaultSize={56} minSize={22}>
        <div className="pane">
          <div className="panel">
            <header>
              <h2>{t('patch.title')}</h2>
            </header>
            <div className="scroll">
              {show.fixtures.length > 0 && (
                <>
                  <div className="section-label rig-label">
                    <span>{t('patch.rig')}</span>
                    <div className="rig-tools">
                      <select
                        className="rig-truss"
                        value={rigTruss}
                        onChange={(e) => setRigTruss(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        title={t('patch.truss')}
                      >
                        <option value="all">{t('patch.allTrusses')}</option>
                        {TRUSSES.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.name}
                          </option>
                        ))}
                      </select>
                      <button className="rig-readdress" onClick={readdressByRigOrder} title={t('patch.readdressHint')}>
                        {t('patch.readdress')}
                      </button>
                    </div>
                  </div>
                  <div className="truss-strip" ref={stripRef}>
                    <div className="truss-bar" />
                    {stripFixtures.map(({ pf, n }) => (
                      <div
                        key={pf.id}
                        className={`truss-fx${selection.includes(pf.id) ? ' selected' : ''}`}
                        style={{ left: `${((pf.position.x + 1) / 2) * 100}%` }}
                        title={`${pf.name} — drag to move`}
                        onPointerDown={(e) => onChipDown(e, pf.id)}
                      >
                        <span className="truss-fx-dot" />
                        <span className="truss-fx-lbl">{n}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="section-label">
                {t('patch.patched')} ({show.fixtures.length})
              </div>
              {show.fixtures.length === 0 ? (
                <div className="prog-empty">{t('patch.empty')}</div>
              ) : (
                <div className="patched-list">
                  {show.fixtures.map((pf) => {
                    const def = definitions[pf.definitionId]
                    const fp = def ? fixtureFootprint(def, pf.modeIndex) : 0
                    const end = pf.address + fp - 1
                    const selected = selection.includes(pf.id)
                    return (
                      <div
                        className={`patched-item${selected ? ' selected' : ''}`}
                        key={pf.id}
                        onClick={() => toggleSelect(pf.id)}
                      >
                        <div className="meta">
                          <div className="name">{pf.name}</div>
                          <div className="detail">
                            {def?.model} · {t('patch.address')} {pf.address}–{end}
                          </div>
                        </div>
                        <div className="patch-assign" onClick={(e) => e.stopPropagation()}>
                          <label title={t('patch.truss')}>
                            <span>{t('patch.truss')}</span>
                            <select
                              value={pf.truss ?? DEFAULT_TRUSS}
                              onChange={(e) => setFixtureTruss(pf.id, Number(e.target.value))}
                            >
                              {TRUSSES.map((tr) => (
                                <option key={tr.id} value={tr.id}>
                                  {tr.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label title={t('patch.universe')}>
                            <span>U</span>
                            <select
                              value={pf.universe}
                              onChange={(e) => setFixtureUniverse(pf.id, Number(e.target.value))}
                            >
                              {UNIVERSES.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFixture(pf.id)
                          }}
                        >
                          {t('patch.remove')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <PanelResizeHandle className="rz rz-h" />

      {/* BOTTOM window — the fixture library, collapsible. */}
      <Panel
        ref={libRef}
        collapsible
        collapsedSize={6}
        defaultSize={44}
        minSize={14}
        onCollapse={() => setLibCollapsed(true)}
        onExpand={() => setLibCollapsed(false)}
      >
        <div className="pane">
          <div className="panel" data-tour="library">
            <header>
              <h2>{t('patch.library')}</h2>
              {!libCollapsed && (
                <input
                  className="lib-search"
                  type="search"
                  placeholder={t('patch.search')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
              <button
                className="pane-fold"
                title={libCollapsed ? t('common.expand') : t('common.collapse')}
                onClick={() => (libCollapsed ? libRef.current?.expand() : libRef.current?.collapse())}
              >
                {libCollapsed ? '⌄' : '⌃'}
              </button>
            </header>
            {!libCollapsed && (
              <div className="scroll">
                {groups.length === 0 ? (
                  <div className="prog-empty">{t('patch.noMatch')}</div>
                ) : (
                  groups.map(([cat, defs]) => (
                    <div className="lib-group" key={cat}>
                      <div className="lib-group-title">
                        {CATEGORY_LABELS[cat]} <span className="lib-group-n">{defs.length}</span>
                      </div>
                      <div className="lib-list">
                        {defs.map((def) => {
                          const fp = fixtureFootprint(def, 0)
                          return (
                            <div className="lib-item" key={def.id}>
                              <div className="meta">
                                <div className="name">
                                  {def.manufacturer} {def.model}
                                </div>
                                <div className="detail">
                                  {fp} {t('patch.channels')} · {def.modes[0]?.name}
                                </div>
                              </div>
                              <span className={`badge ${def.source}`}>{def.source}</span>
                              <button className="primary" onClick={() => addFixture(def.id)}>
                                {t('patch.add')}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>
    </PanelGroup>
  )
}
