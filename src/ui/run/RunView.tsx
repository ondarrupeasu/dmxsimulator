import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { EffectsPanel } from './EffectsPanel'

/** Run mode: the cue list / playback. Record snapshots the programmer; Go fires. */
export function RunView() {
  const { t } = useTranslation()
  const cues = useShowStore((s) => s.cues)
  const activeCueId = useShowStore((s) => s.activeCueId)
  const recordCue = useShowStore((s) => s.recordCue)
  const deleteCue = useShowStore((s) => s.deleteCue)
  const goCue = useShowStore((s) => s.goCue)
  const releaseCue = useShowStore((s) => s.releaseCue)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const programmerEmpty = useShowStore((s) => Object.keys(s.programmer).length === 0)

  return (
    <div className="panel">
      <header>
        <h2>{t('run.title')}</h2>
        <span className="sub">{cues.length} cues</span>
      </header>
      <div className="scroll">
        <div className="row-actions">
          <button className="primary" onClick={recordCue} disabled={programmerEmpty}>
            {t('run.record')}
          </button>
          <button onClick={releaseCue} disabled={!activeCueId}>
            {t('run.release')}
          </button>
        </div>
        <div className="prog-empty" style={{ marginBottom: 14 }}>
          {t('run.recordHint')}
        </div>

        {cues.length === 0 ? (
          <div className="prog-empty">{t('run.empty')}</div>
        ) : (
          <div className="cue-list">
            {cues.map((cue, i) => {
              const active = cue.id === activeCueId
              return (
                <div className={`cue-item${active ? ' active' : ''}`} key={cue.id}>
                  <span className="cue-num">{i + 1}</span>
                  <span className="cue-name">{cue.name}</span>
                  <button className={active ? 'primary' : ''} onClick={() => goCue(cue.id)}>
                    {t('run.go')}
                  </button>
                  <button onClick={() => deleteCue(cue.id)}>✕</button>
                </div>
              )
            })}
          </div>
        )}

        {!programmerEmpty && (
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button onClick={clearProgrammer}>{t('program.clear')}</button>
          </div>
        )}

        <EffectsPanel />
      </div>
    </div>
  )
}
