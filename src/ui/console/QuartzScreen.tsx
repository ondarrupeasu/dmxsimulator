import { useShowStore } from '../../store/showStore'
import type { PaletteKind } from '../../model/palette'
import { PALETTE_LABELS } from '../../model/palette'
import { EffectsPanel } from '../run/EffectsPanel'

const PALETTE_KINDS: PaletteKind[] = ['colour', 'position', 'gobo', 'beam', 'intensity']

/** The Quartz touchscreen: contextual windows (Fixtures / palettes / Shapes). */
export function QuartzScreen() {
  const screen = useShowStore((s) => s.deskScreen)
  const setScreen = useShowStore((s) => s.setDeskScreen)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const palettes = useShowStore((s) => s.palettes)
  const recordPalette = useShowStore((s) => s.recordPalette)
  const applyPalette = useShowStore((s) => s.applyPalette)
  const deletePalette = useShowStore((s) => s.deletePalette)
  const noSel = selection.length === 0
  const kind = screen as PaletteKind

  return (
    <div className="qscreen">
      <div className="qscreen-head">
        <span className="qd-brand">Avolites Quartz</span>
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

      <div className="qscreen-body">
        {screen === 'fixtures' ? (
          <div className="qd-fixtures">
            {show.fixtures.length === 0 ? (
              <span className="qd-muted">Patch fixtures first.</span>
            ) : (
              show.fixtures.map((pf) => (
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
    </div>
  )
}
