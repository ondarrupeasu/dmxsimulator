import { useShowStore } from '../../store/showStore'
import type { PaletteKind } from '../../model/palette'
import { PALETTE_LABELS } from '../../model/palette'
import { EffectsPanel } from '../run/EffectsPanel'

const PALETTE_KINDS: PaletteKind[] = ['colour', 'position', 'gobo', 'beam', 'intensity']

// Touchscreen workspace tabs (Fixtures lives in its own docked window on the right).
const TABS: { key: string; label: string }[] = [
  { key: 'groups', label: 'Groups' },
  { key: 'colour', label: 'Colour' },
  { key: 'position', label: 'Position' },
  { key: 'gobo', label: 'Gobo' },
  { key: 'beam', label: 'Beam' },
  { key: 'intensity', label: 'Intensity' },
  { key: 'playbacks', label: 'Playbacks' },
  { key: 'effects', label: 'Shapes' },
]

type SoftKey = {
  k: string
  label?: string
  sub?: string
  kind?: 'action' | 'option' | 'menu' | 'text'
  onClick?: () => void
  disabled?: boolean
  info?: boolean
}

const askLegend = (current: string, apply: (name: string) => void) => {
  const name = window.prompt('Nombre (legend):', current)
  if (name !== null && name.trim()) apply(name.trim())
}

/** The Quartz touchscreen — Titan-style: workspace windows of hand-legended buttons
 * on the left, the A–G softkey column (physical-look keys) on the right, and the
 * command line along the bottom. */
export function QuartzScreen() {
  const rawScreen = useShowStore((s) => s.deskScreen)
  const setScreen = useShowStore((s) => s.setDeskScreen)
  const selection = useShowStore((s) => s.selection)
  const select = useShowStore((s) => s.select)
  const clearSelection = useShowStore((s) => s.clearSelection)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const programmer = useShowStore((s) => s.programmer)
  const show = useShowStore((s) => s.show)
  const cmd = useShowStore((s) => s.cmd)
  const deskMenu = useShowStore((s) => s.deskMenu)
  const setMode = useShowStore((s) => s.setMode)

  const groups = useShowStore((s) => s.groups)
  const recordGroup = useShowStore((s) => s.recordGroup)
  const recallGroup = useShowStore((s) => s.recallGroup)
  const renameGroup = useShowStore((s) => s.renameGroup)
  const deleteGroup = useShowStore((s) => s.deleteGroup)
  const palettes = useShowStore((s) => s.palettes)
  const recordPalette = useShowStore((s) => s.recordPalette)
  const applyPalette = useShowStore((s) => s.applyPalette)
  const deletePalette = useShowStore((s) => s.deletePalette)
  const renamePalette = useShowStore((s) => s.renamePalette)
  const cues = useShowStore((s) => s.cues)
  const activeCueId = useShowStore((s) => s.activeCueId)
  const recordCue = useShowStore((s) => s.recordCue)
  const goCue = useShowStore((s) => s.goCue)
  const deleteCue = useShowStore((s) => s.deleteCue)
  const renameCue = useShowStore((s) => s.renameCue)

  const fixtures = show.fixtures
  const noFx = fixtures.length === 0
  const noSel = selection.length === 0
  const progActive = Object.keys(programmer).length > 0
  const screen = TABS.some((tb) => tb.key === rawScreen) ? rawScreen : 'groups'
  const kind: PaletteKind = PALETTE_KINDS.includes(rawScreen as PaletteKind) ? (rawScreen as PaletteKind) : 'colour'
  const palKind = kind

  const clearAll = () => {
    clearSelection()
    clearProgrammer()
  }

  // ---- Softkey menus (unchanged content; from the Titan manual) ----
  const MENUS: Record<string, { title: string; keys: SoftKey[] }> = {
    root: {
      title: 'Root',
      keys: [
        { k: 'A', label: 'All', sub: 'Select all', kind: 'action', onClick: () => select(fixtures.map((f) => f.id)), disabled: noFx },
        { k: 'B', label: 'Locate', sub: 'Home values', kind: 'action', onClick: locateSelected, disabled: noSel },
        { k: 'C', label: 'Highlight', sub: 'Intensity full', kind: 'action', onClick: () => setByFn('dimmer', 255), disabled: noSel },
        { k: 'D', label: 'Clear', sub: 'Programmer', kind: 'action', onClick: clearAll, disabled: noSel && !progActive },
        { k: 'E', label: 'Set Legend', kind: 'text', info: true },
        { k: 'F', label: 'Open Workspace', kind: 'menu', info: true },
        { k: 'G' },
      ],
    },
    record: {
      title: 'Record',
      keys: [
        { k: 'A', label: 'Record Mode', sub: 'By Fixture', kind: 'option', info: true },
        { k: 'B', label: 'Set Mask', kind: 'menu', info: true },
        { k: 'C', label: 'Clear Record Mask', kind: 'action', info: true },
        { k: 'D', label: 'Convert to Chase', kind: 'action', info: true },
        { k: 'E', label: 'Convert to Cue List', kind: 'action', info: true },
        { k: 'F' },
        { k: 'G' },
      ],
    },
    group: {
      title: 'Group',
      keys: [
        { k: 'A', label: 'Record Group', kind: 'action', onClick: recordGroup, disabled: noSel },
        { k: 'B', label: 'Provide a Legend', kind: 'text', info: true },
        { k: 'C', label: 'Recall Group', kind: 'menu', info: true },
        { k: 'D', label: 'Fixture Order', kind: 'menu', info: true },
        { k: 'E', label: 'Edit Layout', kind: 'menu', info: true },
        { k: 'F' },
        { k: 'G' },
      ],
    },
    patch: {
      title: 'Patch',
      keys: [
        { k: 'A', label: 'Dimmers', kind: 'menu', info: true },
        { k: 'B', label: 'Fixtures', kind: 'menu', info: true },
        { k: 'C', label: 'DMX Line =', kind: 'text', info: true },
        { k: 'D', label: 'Address =', kind: 'text', info: true },
        { k: 'E', label: 'Quantity', kind: 'text', info: true },
        { k: 'F', label: 'User Number =', kind: 'text', info: true },
        { k: 'G', label: 'Open Patch View', kind: 'action', onClick: () => setMode('patch') },
      ],
    },
    palette: {
      title: 'Palettes',
      keys: [
        { k: 'A', label: `Record ${PALETTE_LABELS[palKind]}`, kind: 'action', onClick: () => recordPalette(palKind), disabled: noSel },
        { k: 'B', label: 'Set Mask', kind: 'menu', info: true },
        { k: 'C', label: 'Global / Shared', kind: 'option', info: true },
        { k: 'D', label: 'Record By…', kind: 'option', info: true },
        { k: 'E', label: 'Nested Palettes', kind: 'option', info: true },
        { k: 'F', label: 'Provide a Legend', kind: 'text', info: true },
        { k: 'G' },
      ],
    },
    ml: {
      title: 'ML Menu',
      keys: [
        { k: 'A', label: 'Align', kind: 'menu', info: true },
        { k: 'B', label: 'Flip', kind: 'action', info: true },
        { k: 'C', label: 'Macros', kind: 'menu', info: true },
        { k: 'D' },
        { k: 'E' },
        { k: 'F' },
        { k: 'G' },
      ],
    },
  }
  const menu = MENUS[deskMenu] ?? MENUS.root

  const selNames = fixtures.filter((f) => selection.includes(f.id)).map((f) => f.name)

  // ---- Workspace body ----
  const renderCell = (
    id: string,
    legend: string,
    onClick: () => void,
    onRename: () => void,
    onDelete: () => void,
    opts: { active?: boolean; colorClass?: string; disabled?: boolean } = {},
  ) => (
    <div key={id} className={`qd-cell${opts.active ? ' active' : ''} ${opts.colorClass ?? ''}`}>
      <button className="qd-cell-hit" onClick={onClick} disabled={opts.disabled} title={legend}>
        {legend}
      </button>
      <button className="qd-cell-edit" onClick={onRename} title="Rename legend">✎</button>
      <button className="qd-cell-del" onClick={onDelete} title="Delete">✕</button>
    </div>
  )

  let body: React.ReactNode
  if (screen === 'effects') {
    body = <EffectsPanel />
  } else if (screen === 'groups') {
    body = (
      <div className="qd-ws-grid">
        {groups.map((g) => {
          const sameSel = g.fixtureIds.length === selection.length && g.fixtureIds.every((id) => selection.includes(id))
          return renderCell(
            g.id,
            g.name,
            () => recallGroup(g.id),
            () => askLegend(g.name, (n) => renameGroup(g.id, n)),
            () => deleteGroup(g.id),
            { active: sameSel && !noSel, colorClass: 'ws-group' },
          )
        })}
        <button className="qd-cell rec" onClick={recordGroup} disabled={noSel} title="Record the current selection as a group">
          ＋ Record Group
        </button>
      </div>
    )
  } else if (screen === 'playbacks') {
    body = (
      <div className="qd-ws-grid">
        {cues.map((c) =>
          renderCell(
            c.id,
            c.name,
            () => goCue(c.id),
            () => askLegend(c.name, (n) => renameCue(c.id, n)),
            () => deleteCue(c.id),
            { active: c.id === activeCueId, colorClass: 'ws-playback' },
          ),
        )}
        <button className="qd-cell rec" onClick={recordCue} disabled={!progActive} title="Record the programmer as a new cue">
          ＋ Record Cue
        </button>
      </div>
    )
  } else {
    const list = palettes.filter((p) => p.kind === kind)
    body = (
      <div className="qd-ws-grid">
        {list.map((p) =>
          renderCell(
            p.id,
            p.name,
            () => applyPalette(p.id),
            () => askLegend(p.name, (n) => renamePalette(p.id, n)),
            () => deletePalette(p.id),
            { colorClass: `ws-${kind}`, disabled: noSel },
          ),
        )}
        <button
          className="qd-cell rec"
          onClick={() => recordPalette(kind)}
          disabled={noSel}
          title={`Record a ${PALETTE_LABELS[kind]} palette from the programmer`}
        >
          ＋ Record {PALETTE_LABELS[kind]}
        </button>
      </div>
    )
  }

  return (
    <div className="qscreen">
      <div className="qscreen-head">
        <span className="qd-brand">Avolites Quartz</span>
        <span className="qd-titan">TITAN</span>
        <div className="qd-tabs">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              className={`qd-tab-${tb.key}${screen === tb.key ? ' on' : ''}`}
              onClick={() => setScreen(tb.key)}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="qscreen-main">
        <div className="qscreen-body">{body}</div>

        <div className="qscreen-soft">
          <div className="qsk-menu">{menu.title}</div>
          {menu.keys.map((sk) => {
            const suffix = sk.kind === 'menu' ? ' ▸' : sk.kind === 'text' ? ' …' : ''
            return (
              <div key={sk.k} className={`qskrow${sk.info ? ' info' : ''}${sk.label ? '' : ' blank'}`}>
                <span className="qsk-lbl" title={sk.info ? 'Opción real del menú Titan (referencia)' : sk.sub}>
                  {sk.label ? (
                    <>
                      {sk.label}
                      {suffix}
                      {sk.kind === 'option' && sk.sub && <span className="qsk-opt">{sk.sub}</span>}
                    </>
                  ) : null}
                </span>
                <button
                  className="qsk-key"
                  disabled={!sk.label || sk.disabled}
                  onClick={sk.onClick}
                  title={sk.label ?? ''}
                >
                  {sk.k}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="qscreen-cmd">
        <span className="qcmd-prompt">›</span>
        {cmd ? (
          <span className="qcmd-line"><span className="qcmd-typed">{cmd}</span></span>
        ) : noSel ? (
          <span className="qcmd-hint">Fixture</span>
        ) : (
          <span className="qcmd-line">
            <span className="qcmd-kw">Fixture</span>
            <span className="qcmd-sel">{selNames.slice(0, 6).join(' + ')}{selNames.length > 6 ? ` +${selNames.length - 6}` : ''}</span>
          </span>
        )}
        <span className="qcmd-cursor" />
        <span className="qscreen-spacer" />
        <span className={`qcmd-stat${progActive ? ' live' : ''}`}>
          {progActive ? '● Programmer active' : 'Programmer clear'}
        </span>
      </div>
    </div>
  )
}
