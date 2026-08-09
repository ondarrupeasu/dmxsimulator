import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { fixtureFootprint } from '../../model/types'

export function PatchView() {
  const { t } = useTranslation()
  const definitions = useShowStore((s) => s.definitions)
  const show = useShowStore((s) => s.show)
  const selection = useShowStore((s) => s.selection)
  const addFixture = useShowStore((s) => s.addFixture)
  const removeFixture = useShowStore((s) => s.removeFixture)
  const toggleSelect = useShowStore((s) => s.toggleSelect)

  const library = useMemo(
    () =>
      Object.values(definitions).sort((a, b) =>
        `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`),
      ),
    [definitions],
  )

  return (
    <div className="panel">
      <header>
        <h2>{t('patch.title')}</h2>
      </header>
      <div className="scroll">
        <div className="section-label">{t('patch.library')}</div>
        <div className="lib-list">
          {library.map((def) => {
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
                      {def?.model} · {t('patch.address')} {pf.address}–{end} · U{pf.universe}
                    </div>
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
  )
}
