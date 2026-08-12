/**
 * Audio engine (Web Audio) — the browser analogue of the Avolites Quartz's built-in
 * "audio line in for triggering". Mirrors Titan's model, which is two SEPARATE systems:
 *   • Sound to Light — the incoming audio is split into 7 fixed frequency bands; when a
 *     band's level crosses its trigger threshold it FIRES a mapped playback (a gate, not
 *     a smooth fade).
 *   • BPM — a separate tempo (Tap Tempo or beat detection) that chases/shapes follow.
 * Source is an mp3 file or line-in/mic (getUserMedia). Live levels/BPM live here (a
 * singleton) so the UI reads them per animation frame without spamming the store.
 */

/** Titan's seven Sound-to-Light band centre frequencies (Hz). */
export const AUDIO_BANDS = [50, 140, 380, 875, 2400, 6200, 14000]

export type AudioSource = 'none' | 'mic' | 'file' | 'system'

class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private data = new Uint8Array(0)
  private srcNode: AudioNode | null = null
  private mediaEl: HTMLAudioElement | null = null
  private stream: MediaStream | null = null
  private url: string | null = null

  gain = 1.4
  source: AudioSource = 'none'
  label = ''
  bpm = 120

  // beat detection state
  private energy: number[] = []
  private lastBeat = 0
  private beatGaps: number[] = []
  // tap tempo state
  private lastTap = 0
  private tapGaps: number[] = []

  private ensureCtx() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.7
      this.data = new Uint8Array(this.analyser.frequencyBinCount)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  async useMic() {
    this.stop()
    this.ensureCtx()
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.srcNode = this.ctx!.createMediaStreamSource(this.stream)
    this.srcNode.connect(this.analyser!) // analyse only — don't feed the speakers (no echo)
    this.source = 'mic'
    this.label = 'Line-in / Mic'
  }

  /** SIMULATOR-ONLY: capture the computer's own audio (a browser tab / the system output,
   *  e.g. a YouTube or Spotify tab) via getDisplayMedia and treat it as the line-in. The
   *  real Quartz can't do this — it only has the physical audio jack. */
  async useSystemAudio() {
    this.stop()
    this.ensureCtx()
    // getDisplayMedia requires video to be requested; we keep only the audio track.
    const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia: (c: MediaStreamConstraints) => Promise<MediaStream> }
    const stream = await md.getDisplayMedia({ video: true, audio: true })
    const audioTracks = stream.getAudioTracks()
    if (!audioTracks.length) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error('no-audio') // the user didn't tick "share audio"
    }
    stream.getVideoTracks().forEach((t) => t.stop()) // we only need the audio
    this.stream = stream
    this.srcNode = this.ctx!.createMediaStreamSource(new MediaStream(audioTracks))
    this.srcNode.connect(this.analyser!) // analyse only — the tab already plays through the speakers
    this.source = 'system'
    this.label = 'System / tab audio'
  }

  async useFile(file: File) {
    this.stop()
    this.ensureCtx()
    this.url = URL.createObjectURL(file)
    const el = new Audio(this.url)
    el.loop = true
    this.mediaEl = el
    this.srcNode = this.ctx!.createMediaElementSource(el)
    this.srcNode.connect(this.analyser!)
    this.analyser!.connect(this.ctx!.destination) // so you hear the track
    await el.play()
    this.source = 'file'
    this.label = file.name
  }

  stop() {
    this.mediaEl?.pause()
    this.mediaEl = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
    try {
      this.srcNode?.disconnect()
    } catch { /* already gone */ }
    this.srcNode = null
    this.source = 'none'
    this.label = ''
    this.energy = []
  }

  /** Level 0..1 per band (gain-scaled), averaging the FFT bins around each centre. */
  bands(): number[] {
    if (!this.analyser) return AUDIO_BANDS.map(() => 0)
    this.analyser.getByteFrequencyData(this.data)
    const sr = this.ctx!.sampleRate
    const n = this.analyser.fftSize
    return AUDIO_BANDS.map((f) => {
      const bin = Math.round((f * n) / sr)
      let sum = 0
      let c = 0
      for (let i = Math.max(0, bin - 1); i <= Math.min(this.data.length - 1, bin + 1); i++) {
        sum += this.data[i]
        c++
      }
      return Math.min(1, (sum / (c || 1) / 255) * this.gain)
    })
  }

  /** Auto Gain (Titan): nudge the input gain so the loudest band peaks near ~0.85.
   *  `peak` is the current max post-gain band level; called each frame while enabled. */
  autoGain(peak: number) {
    if (peak > 0.98) this.gain = Math.max(0.5, this.gain - 0.03)
    else if (peak < 0.6) this.gain = Math.min(4, this.gain + 0.015)
  }

  /** Energy-based beat detection on the kick band → updates bpm. Returns true on a beat. */
  detectBeat(nowMs: number, level: number): boolean {
    this.energy.push(level)
    if (this.energy.length > 43) this.energy.shift()
    const avg = this.energy.reduce((a, b) => a + b, 0) / this.energy.length
    const beat = level > 0.35 && level > avg * 1.35 && nowMs - this.lastBeat > 240
    if (beat) {
      if (this.lastBeat) {
        this.beatGaps.push(nowMs - this.lastBeat)
        if (this.beatGaps.length > 6) this.beatGaps.shift()
        const m = this.beatGaps.reduce((a, b) => a + b, 0) / this.beatGaps.length
        const bpm = 60000 / m
        if (bpm >= 60 && bpm <= 200) this.bpm = Math.round(bpm)
      }
      this.lastBeat = nowMs
    }
    return beat
  }

  /** Tap tempo — call on each tap with performance.now(). Averages the last few gaps. */
  tap(nowMs: number) {
    if (this.lastTap && nowMs - this.lastTap < 2000) {
      this.tapGaps.push(nowMs - this.lastTap)
      if (this.tapGaps.length > 4) this.tapGaps.shift()
      const m = this.tapGaps.reduce((a, b) => a + b, 0) / this.tapGaps.length
      const bpm = 60000 / m
      if (bpm >= 40 && bpm <= 300) this.bpm = Math.round(bpm)
    } else {
      this.tapGaps = []
    }
    this.lastTap = nowMs
  }
}

/** Shared singleton — the desk's one audio input. */
export const audioEngine = new AudioEngine()

// Dev aid: expose the engine for console/tests.
if (import.meta.env.DEV) (window as unknown as { __audio?: unknown }).__audio = audioEngine
