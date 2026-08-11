import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'

/** The Fixtures / Groups workspace, docked on the right next to the visualiser.
 *  Selecting here drives the desk exactly as selecting on the touchscreen does. */
export function FixturesWindow() {
  const { t } = useTranslation()
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const select = useShowStore((s) => s.select)
  const clearSelection = useShowStore((s) => s.clearSelection)
  const noFx = show.fixtures.length === 0

  return (
    <div className="panel">
      <header>
        <h2>{t('fixturesWindow.title')}</h2>
        <div className="vh-tools">
          <button
            className="ghost-btn"
            disabled={noFx}
            onClick={() => select(show.fixtures.map((f) => f.id))}
          >
            {t('fixturesWindow.all')}
          </button>
          <button
            className="ghost-btn"
            disabled={selection.length === 0}
            onClick={clearSelection}
          >
            {t('fixturesWindow.clear')}
          </button>
        </div>
      </header>
      <div className="scroll">
        <div className="qd-fixtures">
          {noFx ? (
            <span className="qd-muted">{t('fixturesWindow.empty')}</span>
          ) : (
            show.fixtures.map((pf) => (
              <button
                key={pf.id}
                className={`qd-fx${selection.includes(pf.id) ? ' sel' : ''}`}
                onClick={() => toggleSelect(pf.id)}
                title={`${pf.name} · ${definitions[pf.definitionId]?.model} · @${pf.address}`}
              >
                <span className="qd-fx-name">{pf.name}</span>
                <span className="qd-fx-def">{definitions[pf.definitionId]?.model}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
