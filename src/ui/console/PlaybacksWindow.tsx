import { useRef } from 'react'
import { useShowStore } from '../../store/showStore'
import { playbacksBySlot } from '../../model/cue'

/** The Playbacks workspace — the show's playback stack. Each card is one fader's playback:
 *  a single cue, or a multi-step CUE LIST / CHASE. Click a card to fire it (connect + Go);
 *  the central Go/Prev/Stop then step the connected one, exactly like the real desk. */
export function PlaybacksWindow() {
  const playbacks = useShowStore((s) => s.playbacks)
  const connectedId = useShowStore((s) => s.connectedId)
  const goCue = useShowStore((s) => s.goCue)
  const deleteCue = useShowStore((s) => s.deleteCue)
  const deleteStep = useShowStore((s) => s.deleteStep)
  const renameCue = useShowStore((s) => s.renameCue)
  const recordCue = useShowStore((s) => s.recordCue)
  const setMode = useShowStore((s) => s.setPlaybackMode)
  const setBpm = useShowStore((s) => s.setPlaybackBpm)
  const progActive = useShowStore((s) => Object.keys(s.programmer).length > 0)

  // Tap Tempo: tap the button in time and the chase's BPM follows. We average the recent
  // intervals (taps older than 2s are dropped, so you can start a new count any time).
  const taps = useRef<Record<string, number[]>>({})
  const tapTempo = (id: string) => {
    const now = performance.now()
    const arr = (taps.current[id] ?? []).filter((t) => now - t < 2000)
    arr.push(now)
    taps.current[id] = arr
    if (arr.length >= 2) {
      const intervals = arr.slice(1).map((t, i) => t - arr[i])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      if (avg > 0) setBpm(id, 60000 / avg)
    }
  }

  const bySlot = playbacksBySlot(playbacks)

  return (
    <div className="pb-grid">
      {bySlot.map((p, slot) =>
        p ? (
          <div key={p.id} className={`pb-card${p.id === connectedId ? ' connected' : ''}`}>
            <div className="pb-head">
              <button className="pb-fire" title={`Fire ${p.name} (connect + Go)`} onClick={() => goCue(p.id)}>
                <span className="pb-slot">{slot + 1}</span>
                <span className="pb-name">{p.name}</span>
              </button>
              <button className="pb-ico" title="Rename" onClick={() => { const n = window.prompt('Nombre del playback:', p.name); if (n != null) renameCue(p.id, n.trim() || p.name) }}>✎</button>
              <button className="pb-ico" title="Delete playback" onClick={() => deleteCue(p.id)}>✕</button>
            </div>

            <div className="pb-meta">
              <span className="pb-badge">{p.steps.length === 1 ? '1 cue' : `${p.steps.length} cues`}</span>
              {p.steps.length > 1 && (
                <>
                  <span className="pb-seg">
                    <button className={p.mode === 'list' ? 'on' : ''} onClick={() => setMode(p.id, 'list')} title="Cue list — stepped by Go">List</button>
                    <button className={p.mode === 'chase' ? 'on' : ''} onClick={() => setMode(p.id, 'chase')} title="Chase — auto-timed by BPM">Chase</button>
                  </span>
                  {p.mode === 'chase' && (
                    <>
                      <label className="pb-bpm" title="Chase tempo (BPM)">
                        <input type="number" min={20} max={600} value={p.bpm ?? 120}
                          onChange={(e) => setBpm(p.id, Number(e.target.value))} /> BPM
                      </label>
                      <button className="pb-tap" title="Tap Tempo — marca el tempo con varios clics y el BPM se ajusta solo" onClick={() => tapTempo(p.id)}>Tap</button>
                    </>
                  )}
                </>
              )}
            </div>

            {p.steps.length > 1 && (
              <ol className="pb-steps">
                {p.steps.map((st, i) => (
                  <li key={st.id} className={i === p.current ? 'live' : ''}>
                    <span className="pb-stepno">{st.number}</span>
                    <span className="pb-stepname">{st.name}</span>
                    <button className="pb-ico sm" title="Delete this cue" onClick={() => deleteStep(p.id, st.id)}>✕</button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          <div key={`empty-${slot}`} className="pb-card empty"><span className="pb-slot dim">{slot + 1}</span></div>
        ),
      )}
      <button className="pb-card rec" onClick={recordCue} disabled={!progActive}
        title="Record the programmer as a new playback (Record onto an existing fader appends a cue to its list)">
        ＋ Record Cue
      </button>
    </div>
  )
}
