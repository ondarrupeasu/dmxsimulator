import { useShowStore } from '../../store/showStore'
import type { PaletteKind } from '../../model/palette'
import { PALETTE_LABELS } from '../../model/palette'
import { EffectsPanel } from '../run/EffectsPanel'

const PALETTE_KINDS: PaletteKind[] = ['colour', 'position', 'gobo', 'beam', 'intensity']

type SoftKey = {
  k: string
  label?: string
  sub?: string
  /** Titan softkey types: action / option (cycles) / new-menu (▸) / text-entry (…). */
  kind?: 'action' | 'option' | 'menu' | 'text'
  onClick?: () => void
  disabled?: boolean
  /** Faithful menu label with no backing function yet (reference only). */
  info?: boolean
}

/** The Quartz touchscreen — Titan-flavoured: a workspace window on the left, the
 * A–G softkey column on the right, and the command line along the bottom. */
export function QuartzScreen() {
  const screen = useShowStore((s) => s.deskScreen)
  const setScreen = useShowStore((s) => s.setDeskScreen)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const select = useShowStore((s) => s.select)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const clearSelection = useShowStore((s) => s.clearSelection)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const programmer = useShowStore((s) => s.programmer)
  const palettes = useShowStore((s) => s.palettes)
  const recordPalette = useShowStore((s) => s.recordPalette)
  const applyPalette = useShowStore((s) => s.applyPalette)
  const deletePalette = useShowStore((s) => s.deletePalette)
  const cmd = useShowStore((s) => s.cmd)
  const deskMenu = useShowStore((s) => s.deskMenu)
  const setMode = useShowStore((s) => s.setMode)

  const fixtures = show.fixtures
  const noFx = fixtures.length === 0
  const noSel = selection.length === 0
  const progActive = Object.keys(programmer).length > 0
  const kind = screen as PaletteKind
  const palKind: PaletteKind = PALETTE_KINDS.includes(kind) ? kind : 'colour'

  const clearAll = () => {
    clearSelection()
    clearProgrammer()
  }

  // The A–G softkeys follow the current desk MENU (root / Record / Group / Patch /
  // Palette / ML), independent of which workspace window is shown. Labels and order
  // are from the official Titan manual; items marked `info` are faithful reference
  // labels for features the simulator doesn't back yet.
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
        { k: 'A', label: 'Group Number', kind: 'text', info: true },
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

  return (
    <div className="qscreen">
      <div className="qscreen-head">
        <span className="qd-brand">Avolites Quartz</span>
        <span className="qd-titan">TITAN</span>
        <div className="qd-tabs">
          <button className={screen === 'fixtures' ? 'on' : ''} onClick={() => setScreen('fixtures')}>
            Fixtures
          </button>
          {PALETTE_KINDS.map((k) => (
            <button
              key={k}
              className={`qd-tab-${k}${screen === k ? ' on' : ''}`}
              onClick={() => setScreen(k)}
            >
              {PALETTE_LABELS[k]}
            </button>
          ))}
          <button className={screen === 'effects' ? 'on' : ''} onClick={() => setScreen('effects')}>
            Shapes
          </button>
        </div>
      </div>

      <div className="qscreen-main">
        <div className="qscreen-body">
          {screen === 'fixtures' ? (
            <div className="qd-fixtures">
              {noFx ? (
                <span className="qd-muted">Patch fixtures first.</span>
              ) : (
                fixtures.map((pf) => (
                  <button
                    key={pf.id}
                    className={`qd-fx${selection.includes(pf.id) ? ' sel' : ''}`}
                    onClick={() => toggleSelect(pf.id)}
                  >
                    <span className="qd-fx-name">{pf.name}</span>
                    <span className="qd-fx-def">{definitions[pf.definitionId]?.model}</span>
                  </button>
                ))
              )}
            </div>
          ) : screen === 'effects' ? (
            <EffectsPanel />
          ) : (
            <div className="qd-palettes">
              <button
                className="qd-key rec qd-pal-rec"
                title={`Record a ${PALETTE_LABELS[kind]} palette from the programmer`}
                disabled={noSel}
                onClick={() => recordPalette(kind)}
              >
                Record {PALETTE_LABELS[kind]}
              </button>
              {palettes.filter((p) => p.kind === kind).length === 0 ? (
                <span className="qd-muted">
                  No {PALETTE_LABELS[kind].toLowerCase()} palettes yet — set a look, select fixtures,
                  then Record.
                </span>
              ) : (
                palettes
                  .filter((p) => p.kind === kind)
                  .map((p) => (
                    <span className="qd-pal" key={p.id}>
                      <button
                        className="qd-pal-apply"
                        title={`Apply ${p.name} to the selection`}
                        disabled={noSel}
                        onClick={() => applyPalette(p.id)}
                      >
                        {p.name}
                      </button>
                      <button
                        className="qd-pal-del"
                        title="Delete palette"
                        onClick={() => deletePalette(p.id)}
                      >
                        ✕
                      </button>
                    </span>
                  ))
              )}
            </div>
          )}
        </div>

        <div className="qscreen-soft">
          <div className="qsk-menu">{menu.title}</div>
          {menu.keys.map((sk) => {
            const suffix = sk.kind === 'menu' ? ' ▸' : sk.kind === 'text' ? ' …' : ''
            return (
              <button
                key={sk.k}
                className={`qsk${sk.label ? '' : ' blank'}${sk.info ? ' info' : ''}`}
                disabled={!sk.label || sk.disabled}
                onClick={sk.onClick}
                title={sk.info ? 'Opción real del menú Titan (referencia)' : sk.sub}
              >
                <span className="qsk-k">{sk.k}</span>
                {sk.label && (
                  <span className="qsk-lbl">
                    {sk.label}
                    {suffix}
                    {sk.kind === 'option' && sk.sub && <span className="qsk-opt">{sk.sub}</span>}
                  </span>
                )}
              </button>
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
