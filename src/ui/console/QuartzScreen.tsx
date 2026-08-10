import { useShowStore } from '../../store/showStore'
import type { PaletteKind } from '../../model/palette'
import { PALETTE_LABELS } from '../../model/palette'
import { EffectsPanel } from '../run/EffectsPanel'

const PALETTE_KINDS: PaletteKind[] = ['colour', 'position', 'gobo', 'beam', 'intensity']

type SoftKey = {
  k: string
  label?: string
  sub?: string
  onClick?: () => void
  disabled?: boolean
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

  const fixtures = show.fixtures
  const noFx = fixtures.length === 0
  const noSel = selection.length === 0
  const progActive = Object.keys(programmer).length > 0
  const kind = screen as PaletteKind

  const clearAll = () => {
    clearSelection()
    clearProgrammer()
  }
  const step = (dir: 1 | -1) => {
    if (noFx) return
    const picked = fixtures.map((f, i) => (selection.includes(f.id) ? i : -1)).filter((i) => i >= 0)
    let base = dir > 0 ? Math.max(...picked, -1) : picked.length ? Math.min(...picked) : -1
    let ni = base < 0 ? (dir > 0 ? 0 : fixtures.length - 1) : base + dir
    ni = ((ni % fixtures.length) + fixtures.length) % fixtures.length
    select([fixtures[ni].id])
  }

  // Contextual softkeys — always 7 slots (A–G), blank ones render inert.
  const MENU: Record<string, string> = {
    fixtures: 'Fixtures',
    effects: 'Shapes / Effects',
    colour: 'Colour Palettes',
    position: 'Position Palettes',
    gobo: 'Gobo Palettes',
    beam: 'Beam Palettes',
    intensity: 'Intensity Palettes',
  }
  const menuTitle = MENU[screen] ?? 'Programmer'

  let keys: SoftKey[]
  if (screen === 'fixtures') {
    keys = [
      { k: 'A', label: 'All', sub: 'Select all', onClick: () => select(fixtures.map((f) => f.id)), disabled: noFx },
      { k: 'B', label: 'Invert', sub: 'Selection', onClick: () => select(fixtures.filter((f) => !selection.includes(f.id)).map((f) => f.id)), disabled: noFx },
      { k: 'C', label: 'Prev', sub: 'Fixture', onClick: () => step(-1), disabled: fixtures.length < 2 },
      { k: 'D', label: 'Next', sub: 'Fixture', onClick: () => step(1), disabled: fixtures.length < 2 },
      { k: 'E', label: 'Locate', sub: 'Home values', onClick: locateSelected, disabled: noSel },
      { k: 'F', label: 'Highlight', sub: 'Intensity full', onClick: () => setByFn('dimmer', 255), disabled: noSel },
      { k: 'G', label: 'Clear', sub: 'Programmer', onClick: clearAll, disabled: noSel && !progActive },
    ]
  } else if (screen === 'effects') {
    keys = [
      { k: 'A' }, { k: 'B' }, { k: 'C' }, { k: 'D' },
      { k: 'E', label: 'Locate', sub: 'Home values', onClick: locateSelected, disabled: noSel },
      { k: 'F' },
      { k: 'G', label: 'Clear', sub: 'Programmer', onClick: clearAll, disabled: noSel && !progActive },
    ]
  } else {
    keys = [
      { k: 'A', label: 'Record', sub: PALETTE_LABELS[kind], onClick: () => recordPalette(kind), disabled: noSel },
      { k: 'B' }, { k: 'C' }, { k: 'D' },
      { k: 'E', label: 'Locate', sub: 'Home values', onClick: locateSelected, disabled: noSel },
      { k: 'F', label: 'Highlight', sub: 'Intensity full', onClick: () => setByFn('dimmer', 255), disabled: noSel },
      { k: 'G', label: 'Clear', sub: 'Programmer', onClick: clearAll, disabled: noSel && !progActive },
    ]
  }

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
          <div className="qsk-menu">{menuTitle}</div>
          {keys.map((sk) => (
            <button
              key={sk.k}
              className={`qsk${sk.label ? '' : ' blank'}`}
              disabled={!sk.label || sk.disabled}
              onClick={sk.onClick}
              title={sk.sub}
            >
              <span className="qsk-k">{sk.k}</span>
              {sk.label && <span className="qsk-lbl">{sk.label}</span>}
            </button>
          ))}
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
