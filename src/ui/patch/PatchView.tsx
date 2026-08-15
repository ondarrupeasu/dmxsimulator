import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import { useShowStore } from '../../store/showStore'
import { fixtureFootprint, fixtureAttributeKeys, ATTRIBUTE_BANKS, type FixtureCategory, type FixtureDefinition } from '../../model/types'
import { getTrusses, DEFAULT_TRUSS } from '../../model/venue'

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
  const setFixtureFloor = useShowStore((s) => s.setFixtureFloor)
  const setFixtureUniverse = useShowStore((s) => s.setFixtureUniverse)
  const setSelectedTruss = useShowStore((s) => s.setSelectedTruss)
  const setSelectedUniverse = useShowStore((s) => s.setSelectedUniverse)
  const addTruss = useShowStore((s) => s.addTruss)
  const removeTruss = useShowStore((s) => s.removeTruss)
  const setTruss = useShowStore((s) => s.setTruss)
  const trusses = getTrusses(show)
  const readdressByRigOrder = useShowStore((s) => s.readdressByRigOrder)
  const setShowMeta = useShowStore((s) => s.setShowMeta)

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
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  // Titan-style patch controls: DMX line (universe), start address (blank = auto next-free),
  // and quantity. Adding advances the manual address by footprint×qty (auto-increment).
  const [patchLine, setPatchLine] = useState(1)
  const [patchAddr, setPatchAddr] = useState('')
  const [patchQty, setPatchQty] = useState(1)
  const [patchTruss, setPatchTruss] = useState(DEFAULT_TRUSS)
  // Keep the chosen truss valid if trusses are added/removed.
  const patchTrussSafe = trusses.some((tr) => tr.id === patchTruss) ? patchTruss : (trusses[0]?.id ?? DEFAULT_TRUSS)
  const doAdd = (def: FixtureDefinition) => {
    const manual = patchAddr.trim() !== ''
    const addr = manual ? Math.max(1, Math.min(512, parseInt(patchAddr, 10) || 1)) : undefined
    addFixture(def.id, { universe: patchLine, address: addr, quantity: patchQty, truss: patchTrussSafe })
    if (manual && addr !== undefined) setPatchAddr(String(Math.min(513, addr + fixtureFootprint(def, 0) * patchQty)))
  }
  const toggleCat = (cat: string) =>
    setCollapsedCats((s) => {
      const n = new Set(s)
      n.has(cat) ? n.delete(cat) : n.add(cat)
      return n
    })
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
              <div className="section-label">Show</div>
              <div className="show-meta">
                <label>
                  <span>Name</span>
                  <input
                    value={show.name}
                    placeholder="Untitled show"
                    onChange={(e) => setShowMeta({ name: e.target.value })}
                  />
                </label>
                <label>
                  <span>Venue</span>
                  <input
                    value={show.venue ?? ''}
                    placeholder="e.g. CIFP Tartanga"
                    onChange={(e) => setShowMeta({ venue: e.target.value })}
                  />
                </label>
                <label>
                  <span>Designer</span>
                  <input
                    value={show.designer ?? ''}
                    placeholder="Drawn by…"
                    onChange={(e) => setShowMeta({ designer: e.target.value })}
                  />
                </label>
              </div>
              <div className="section-label rig-label">
                <span>{t('patch.trusses')}</span>
                <button className="rig-readdress" onClick={addTruss} title={t('patch.addTrussHint')}>
                  ＋ {t('patch.addTruss')}
                </button>
              </div>
              <div className="truss-editor">
                {trusses.map((tr) => (
                  <div className="truss-row" key={tr.id}>
                    <input
                      className="truss-name"
                      value={tr.name}
                      onChange={(e) => setTruss(tr.id, { name: e.target.value })}
                    />
                    <label title={t('patch.trussDepth')}>
                      <span>Z</span>
                      <input type="number" step={0.5} value={tr.z} onChange={(e) => setTruss(tr.id, { z: Number(e.target.value) })} />
                    </label>
                    <label title={t('patch.trussHeight')}>
                      <span>Y</span>
                      <input type="number" step={0.5} min={0} value={tr.y} onChange={(e) => setTruss(tr.id, { y: Number(e.target.value) })} />
                    </label>
                    <button
                      className="truss-del"
                      onClick={() => removeTruss(tr.id)}
                      disabled={trusses.length <= 1}
                      title={t('patch.removeTruss')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

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
                        {trusses.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rig-readdress"
                        onClick={() => {
                          const items = [...stripFixtures].sort((a, b) => a.pf.position.x - b.pf.position.x)
                          const n = items.length
                          items.forEach((it, i) => {
                            const x = n < 2 ? 0 : -0.9 + (1.8 * i) / (n - 1)
                            setFixturePosition(it.pf.id, x, it.pf.position.y ?? 0.6)
                          })
                        }}
                        title="Space the fixtures shown evenly across the truss width"
                      >
                        ⇹ Space
                      </button>
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
              {selection.length > 1 && (
                <div className="batch-bar">
                  <span className="batch-n">{t('patch.batchSel', { n: selection.length })}</span>
                  <label>
                    <span>{t('patch.truss')}</span>
                    <select value="" onChange={(e) => e.target.value && setSelectedTruss(Number(e.target.value))}>
                      <option value="">—</option>
                      {trusses.map((tr) => (
                        <option key={tr.id} value={tr.id}>{tr.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{t('patch.universe')}</span>
                    <select value="" onChange={(e) => e.target.value && setSelectedUniverse(Number(e.target.value))}>
                      <option value="">—</option>
                      {UNIVERSES.map((u) => (
                        <option key={u} value={u}>U{u}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
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
                          {def && (
                            <div className="patch-attrs" title="Bancos de atributos del fixture (Intensity · Position · Colour · Gobo · Beam · Effect · Special)">
                              {(() => {
                                const has = fixtureAttributeKeys(def, pf.modeIndex)
                                return ATTRIBUTE_BANKS.map((b) => (
                                  <span key={b.key} className={has.has(b.key) ? 'on' : ''} title={b.label}>{b.key}</span>
                                ))
                              })()}
                            </div>
                          )}
                        </div>
                        <div className="patch-assign" onClick={(e) => e.stopPropagation()}>
                          {def?.category === 'hazer' ? (
                            <label title={t('patch.mount')}>
                              <span>{t('patch.mount')}</span>
                              <select
                                value={
                                  pf.floor === false
                                    ? `t:${pf.truss ?? DEFAULT_TRUSS}`
                                    : `f:${pf.position.x < -0.25 ? 'l' : pf.position.x > 0.25 ? 'r' : 'c'}`
                                }
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v.startsWith('t:')) setFixtureTruss(pf.id, Number(v.slice(2)))
                                  else {
                                    setFixtureFloor(pf.id, true)
                                    const side = v.slice(2)
                                    setFixturePosition(pf.id, side === 'l' ? -0.75 : side === 'r' ? 0.75 : 0, pf.position.y)
                                  }
                                }}
                              >
                                <optgroup label={t('patch.floor')}>
                                  <option value="f:l">{t('patch.floor')} · {t('patch.sideLeft')}</option>
                                  <option value="f:c">{t('patch.floor')} · {t('patch.sideCenter')}</option>
                                  <option value="f:r">{t('patch.floor')} · {t('patch.sideRight')}</option>
                                </optgroup>
                                <optgroup label={t('patch.trusses')}>
                                  {trusses.map((tr) => (
                                    <option key={tr.id} value={`t:${tr.id}`}>{tr.name}</option>
                                  ))}
                                </optgroup>
                              </select>
                            </label>
                          ) : (
                            <label title={t('patch.truss')}>
                              <span>{t('patch.truss')}</span>
                              <select
                                value={pf.truss ?? DEFAULT_TRUSS}
                                onChange={(e) => setFixtureTruss(pf.id, Number(e.target.value))}
                              >
                                {trusses.map((tr) => (
                                  <option key={tr.id} value={tr.id}>
                                    {tr.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
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
              <div className="patch-bar" title="Como en Titan (DMX Line / Address / Quantity). Universe = la línea/salida DMX (1–4), NO el truss (el truss lo eliges arrastrando el fixture al montarlo). Address vacío = auto (siguiente libre); Qty parchea varios ya espaciados y la dirección avanza sola.">
                <label>Truss
                  <select value={patchTrussSafe} onChange={(e) => setPatchTruss(Number(e.target.value))}>
                    {trusses.map((tr) => (<option key={tr.id} value={tr.id}>{tr.name}</option>))}
                  </select>
                </label>
                <label>Universe
                  <select value={patchLine} onChange={(e) => setPatchLine(Number(e.target.value))}>
                    {UNIVERSES.map((u) => (<option key={u} value={u}>{u}</option>))}
                  </select>
                </label>
                <label>Address
                  <input type="text" inputMode="numeric" placeholder="auto" value={patchAddr}
                    onChange={(e) => setPatchAddr(e.target.value.replace(/[^0-9]/g, ''))} />
                </label>
                <label>Qty
                  <input type="number" min={1} max={96} value={patchQty}
                    onChange={(e) => setPatchQty(Math.max(1, Math.min(96, Number(e.target.value) || 1)))} />
                </label>
              </div>
            )}
            {!libCollapsed && (
              <div className="scroll">
                {groups.length === 0 ? (
                  <div className="prog-empty">{t('patch.noMatch')}</div>
                ) : (
                  groups.map(([cat, defs]) => {
                    const open = !collapsedCats.has(cat)
                    return (
                      <div className="lib-group" key={cat}>
                        <button className="lib-group-title" onClick={() => toggleCat(cat)} aria-expanded={open}>
                          <span className={`lib-caret${open ? ' open' : ''}`}>▸</span>
                          {CATEGORY_LABELS[cat]} <span className="lib-group-n">{defs.length}</span>
                        </button>
                        {open && (
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
                                  <button className="lib-add" onClick={() => doAdd(def)}>
                                    {t('patch.add')}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>
    </PanelGroup>
  )
}
