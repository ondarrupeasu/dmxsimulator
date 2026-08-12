import { useEffect, useRef, useState } from 'react'
import { useShowStore } from '../../store/showStore'
import { audioEngine, AUDIO_BANDS } from '../../engine/audio'
import { cuesBySlot } from '../../model/cue'
import { PwaTag } from '../PwaTag'

const bandLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`)

/** Sound to Light — Titan's "Audio Triggers" workspace (real on the Quartz/Arena, which
 *  have the audio hardware). The 7 fixed bands fire the playback you map to them when they
 *  cross their trigger level. Gain / Auto Gain and per-band Enable / Auto mirror the desk.
 *  Loading an mp3/aac file is a SIMULATOR-ONLY convenience (the real desk only has the
 *  physical line-in jack) — flagged with the PWA marker so students know it's not on Titan. */
export function AudioPanel() {
  const enabled = useShowStore((s) => s.audioEnabled)
  const setEnabled = useShowStore((s) => s.setAudioEnabled)
  const autoGain = useShowStore((s) => s.audioAutoGain)
  const setAutoGain = useShowStore((s) => s.setAudioAutoGain)
  const bands = useShowStore((s) => s.audioBands)
  const setThreshold = useShowStore((s) => s.setAudioBandThreshold)
  const setBandCue = useShowStore((s) => s.setAudioBandCue)
  const setBandEnabled = useShowStore((s) => s.setAudioBandEnabled)
  const setBandAuto = useShowStore((s) => s.setAudioBandAuto)
  const cues = useShowStore((s) => s.cues)
  const fileRef = useRef<HTMLInputElement>(null)

  const [levels, setLevels] = useState<number[]>(() => AUDIO_BANDS.map(() => 0))
  const [source, setSource] = useState(audioEngine.source)
  const [gain, setGainState] = useState(audioEngine.gain)

  // Live meters + gain readout at animation rate (levels aren't in the store — no churn).
  useEffect(() => {
    let raf = 0
    const loop = () => {
      setLevels(audioEngine.bands())
      setSource(audioEngine.source)
      setGainState(audioEngine.gain) // reflects Auto Gain moving the slider
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
  const useSystem = async () => {
    try {
      await audioEngine.useSystemAudio()
      setEnabled(true)
    } catch (e) {
      alert(e instanceof Error && e.message === 'no-audio'
        ? 'Marca la casilla "Compartir audio de la pestaña/sistema" al elegir la fuente.'
        : 'No se pudo capturar el audio del sistema.')
    }
  }

  const bySlot = cuesBySlot(cues)
  const cueOptions = bySlot
    .map((c, slot) => (c ? { slot, name: c.name } : null))
    .filter((o): o is { slot: number; name: string } => !!o)

  return (
    <div className="audio-panel">
      <div className="audio-row audio-src">
        <button className="audio-mic" title="La opción fiel: en la Quartz real es el jack de audio (line-in) integrado. Aquí usa el micro / entrada de línea del ordenador." onClick={useMic}>🎙 Line-in / Mic</button>
        <button className="audio-file pwa-only" onClick={() => fileRef.current?.click()}>♪ Track (mp3/aac)
          <PwaTag sim="cargas un archivo de audio y las bandas reaccionan a él" real="no carga archivos: solo entra sonido por el jack line-in físico" /></button>
        <button className="audio-sys pwa-only" onClick={useSystem}>🖥 Audio del sistema
          <PwaTag sim="captura el sonido de una pestaña/pantalla (YouTube, Spotify…) como si fuera el line-in" real="no existe: el sonido entra solo por el jack físico de audio" /></button>
        <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={onFile} />
        <span className="audio-lbl">{source === 'none' ? 'No source' : audioEngine.label}</span>
        <label className="audio-enable">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable
        </label>
      </div>

      <div className="audio-row audio-gain">
        <span>Gain</span>
        <input type="range" min={0.5} max={4} step={0.1} value={gain} disabled={autoGain}
          onChange={(e) => { const v = Number(e.target.value); audioEngine.gain = v; setGainState(v) }} />
        <label className="audio-enable" title="Auto Gain: la mesa ajusta la ganancia sola">
          <input type="checkbox" checked={autoGain} onChange={(e) => setAutoGain(e.target.checked)} /> Auto Gain
        </label>
      </div>

      <div className="section-label">Sound to Light — bands fire the playback you map</div>
      <div className="audio-bands">
        {AUDIO_BANDS.map((hz, i) => {
          const b = bands[i]
          const lvl = levels[i] ?? 0
          const over = b.enabled && lvl >= b.threshold
          return (
            <div key={hz} className={`audio-band${over ? ' hit' : ''}${b.enabled ? '' : ' off'}`}>
              <span className="ab-hz">{bandLabel(hz)}</span>
              <div className="ab-meter">
                <div className="ab-fill" style={{ height: `${Math.round(lvl * 100)}%` }} />
                <div className="ab-thresh" style={{ bottom: `${Math.round(b.threshold * 100)}%` }} />
              </div>
              <input className="ab-tset" type="range" min={0} max={1} step={0.02}
                value={b.threshold} disabled={b.auto} onChange={(e) => setThreshold(i, Number(e.target.value))} />
              <div className="ab-switches">
                <label title="Enable: activa/desactiva el trigger de esta banda">
                  <input type="checkbox" checked={b.enabled} onChange={(e) => setBandEnabled(i, e.target.checked)} /> En
                </label>
                <label title="Auto: ajusta el nivel de disparo solo cuando no hay triggers">
                  <input type="checkbox" checked={b.auto} onChange={(e) => setBandAuto(i, e.target.checked)} /> Auto
                </label>
              </div>
              <select className="ab-cue" value={b.cueSlot ?? ''}
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
