import { useEffect, useRef, useState } from 'react'
import { useShowStore } from '../../store/showStore'
import { audioEngine, AUDIO_BANDS } from '../../engine/audio'
import { cuesBySlot } from '../../model/cue'

const bandLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`)

/** Sound to Light + BPM — Titan's "Audio Triggers" workspace. Load a track (mp3) or use
 *  line-in/mic (on a real Quartz this is the built-in audio jack); the 7 bands fire the
 *  playbacks you map to them when they cross threshold. BPM/Tap drives shape speed. */
export function AudioPanel() {
  const enabled = useShowStore((s) => s.audioEnabled)
  const setEnabled = useShowStore((s) => s.setAudioEnabled)
  const bands = useShowStore((s) => s.audioBands)
  const setThreshold = useShowStore((s) => s.setAudioBandThreshold)
  const setBandCue = useShowStore((s) => s.setAudioBandCue)
  const cues = useShowStore((s) => s.cues)
  const effects = useShowStore((s) => s.effects)
  const updateEffect = useShowStore((s) => s.updateEffect)
  const fileRef = useRef<HTMLInputElement>(null)

  const [levels, setLevels] = useState<number[]>(() => AUDIO_BANDS.map(() => 0))
  const [source, setSource] = useState(audioEngine.source)
  const [bpm, setBpm] = useState(audioEngine.bpm)
  const [gain, setGainState] = useState(audioEngine.gain)

  // Live meters + BPM readout at animation rate (levels aren't in the store — no churn).
  useEffect(() => {
    let raf = 0
    const loop = () => {
      setLevels(audioEngine.bands())
      setBpm(audioEngine.bpm)
      setSource(audioEngine.source)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) {
      try {
        await audioEngine.useFile(f)
        setEnabled(true)
      } catch {
        alert('No se pudo reproducir el audio.')
      }
    }
  }
  const useMic = async () => {
    try {
      await audioEngine.useMic()
      setEnabled(true)
    } catch {
      alert('No se pudo abrir el micro / line-in (permiso denegado).')
    }
  }

  const bySlot = cuesBySlot(cues)
  const cueOptions = bySlot
    .map((c, slot) => (c ? { slot, name: c.name } : null))
    .filter((o): o is { slot: number; name: string } => !!o)

  return (
    <div className="audio-panel">
      <div className="audio-row audio-src">
        <button className="audio-file" onClick={() => fileRef.current?.click()}>♪ Load track (mp3)</button>
        <button className="audio-mic" onClick={useMic}>🎙 Line-in / Mic</button>
        <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onFile} />
        <span className="audio-lbl">{source === 'none' ? 'No source' : audioEngine.label}</span>
        <label className="audio-enable">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable
        </label>
      </div>

      <div className="audio-row audio-gain">
        <span>Gain</span>
        <input type="range" min={0.5} max={4} step={0.1} value={gain} onChange={(e) => { const v = Number(e.target.value); audioEngine.gain = v; setGainState(v) }} />
        <span className="audio-bpm">BPM {bpm}
          <button className="audio-tap" onClick={() => audioEngine.tap(performance.now())}>Tap</button>
          <button className="audio-tobeat" title="Set every running shape's speed to the beat"
            onClick={() => effects.forEach((e) => updateEffect(e.id, { speed: Math.min(1, audioEngine.bpm / 60) }))}
            disabled={!effects.length}>→ shapes to beat</button>
        </span>
      </div>

      <div className="section-label">Sound to Light — bands fire the playback you map</div>
      <div className="audio-bands">
        {AUDIO_BANDS.map((hz, i) => {
          const lvl = levels[i] ?? 0
          const over = lvl >= bands[i].threshold
          return (
            <div key={hz} className={`audio-band${over ? ' hit' : ''}`}>
              <span className="ab-hz">{bandLabel(hz)}</span>
              <div className="ab-meter">
                <div className="ab-fill" style={{ height: `${Math.round(lvl * 100)}%` }} />
                <div className="ab-thresh" style={{ bottom: `${Math.round(bands[i].threshold * 100)}%` }} />
              </div>
              <input className="ab-tset" type="range" min={0} max={1} step={0.02}
                value={bands[i].threshold} onChange={(e) => setThreshold(i, Number(e.target.value))} />
              <select className="ab-cue" value={bands[i].cueSlot ?? ''}
                onChange={(e) => setBandCue(i, e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">—</option>
                {cueOptions.map((o) => (
                  <option key={o.slot} value={o.slot}>{o.slot + 1}: {o.name}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
