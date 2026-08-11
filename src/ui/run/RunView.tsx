import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { resolveLevel } from '../../engine/dmx'

/**
 * Show / operator mode — run the show, don't build it. A theatre-style master GO
 * that steps through the cue list, plus a playbacks list where each cue sits on its
 * own fader with a flash and a Go (busking). No programming tools live here.
 */
export function RunView() {
  const { t } = useTranslation()
  const cues = useShowStore((s) => s.cues)
  const activeCueId = useShowStore((s) => s.activeCueId)
  const goCue = useShowStore((s) => s.goCue)
  const killPlayback = useShowStore((s) => s.killPlayback)
  const playbackLevels = useShowStore((s) => s.playbackLevels)
  const setPlaybackLevel = useShowStore((s) => s.setPlaybackLevel)
  const fades = useShowStore((s) => s.fades)
  const now = useShowStore((s) => s.now) // ticks during fades → the faders animate
  const playbackFade = useShowStore((s) => s.playbackFade)
  const setPlaybackFade = useShowStore((s) => s.setPlaybackFade)

  // Live level of a playback = its fader, or the in-progress Go fade interpolated.
  const levelOf = (id: string) => Math.round(resolveLevel(id, playbackLevels, fades, now))
  const isUp = (id: string) => levelOf(id) > 0 || !!(fades[id] && fades[id].to > 0)
  const liveIdx = cues.findIndex((c) => c.id === activeCueId)
  const liveCue = liveIdx >= 0 ? cues[liveIdx] : undefined
  const nextCue = cues.length ? cues[liveIdx < 0 ? 0 : (liveIdx + 1) % cues.length] : undefined

  // Sequential playback: GO fires the next cue and crossfades out the current one.
  const goRel = (dir: 1 | -1) => {
    if (!cues.length) return
    const idx = cues.findIndex((c) => c.id === activeCueId)
    const nextId = cues[idx < 0 ? (dir > 0 ? 0 : cues.length - 1) : (idx + dir + cues.length) % cues.length].id
    if (activeCueId && activeCueId !== nextId) killPlayback(activeCueId)
    goCue(nextId)
  }
  const editFade = () => {
    const v = window.prompt('Fade time for GO (seconds):', String(playbackFade))
    if (v !== null) setPlaybackFade(Number(v.replace(',', '.')) || 0)
  }

  return (
    <div className="panel run-panel">
      <header>
        <h2>{t('run.title')}</h2>
        <span className="sub">{cues.length} cues</span>
      </header>
      <div className="scroll">
        {cues.length === 0 ? (
          <div className="prog-empty">
            {t('run.empty')} — {t('run.recordHint')}
          </div>
        ) : (
          <>
            {/* Master GO transport */}
            <div className="run-transport">
              <div className="run-nownext">
                <div className="run-live">
                  <span className="lbl">LIVE</span>
                  <span className="val">{liveCue ? liveCue.name : '—'}</span>
                </div>
                <div className="run-next">
                  <span className="lbl">NEXT</span>
                  <span className="val">{nextCue ? nextCue.name : '—'}</span>
                </div>
              </div>
              <div className="run-gobar">
                <button className="run-step" onClick={() => goRel(-1)} title="Previous cue">◀</button>
                <button className="run-go" onClick={() => goRel(1)} title="Go — fire the next cue">GO</button>
                <button className="run-step" onClick={() => goRel(1)} title="Next cue">▶</button>
              </div>
              <button className="run-fade" onClick={editFade} title="Fade time for GO (click to change)">
                Fade {playbackFade}s{playbackFade === 0 ? ' · Snap' : ''}
              </button>
            </div>

            {/* Playbacks — every cue on its own fader, with flash + Go. */}
            <div className="section-label">Playbacks</div>
            <div className="run-pblist">
              {cues.map((cue, i) => {
                const lvl = levelOf(cue.id)
                const live = lvl > 0 || !!(fades[cue.id] && fades[cue.id].to > 0)
                return (
                  <div className={`run-pb${live ? ' live' : ''}${cue.id === activeCueId ? ' active' : ''}`} key={cue.id}>
                    <span className="run-pb-num">{i + 1}</span>
                    <button
                      className="run-pb-flash"
                      title="Flash — fire this cue"
                      onClick={() => (isUp(cue.id) ? killPlayback(cue.id) : goCue(cue.id))}
                    >
                      {live ? '■' : '▶'}
                    </button>
                    <span className="run-pb-name" title={cue.name}>{cue.name}</span>
                    <input
                      type="range" min={0} max={255} value={lvl}
                      title={`${Math.round((lvl / 255) * 100)}%`}
                      onChange={(e) => setPlaybackLevel(cue.id, Number(e.target.value))}
                    />
                    <span className="run-pb-pct">{Math.round((lvl / 255) * 100)}</span>
                  </div>
                )
              })}
            </div>
            <div className="run-hint">{t('run.recordHint')}</div>
          </>
        )}
      </div>
    </div>
  )
}
