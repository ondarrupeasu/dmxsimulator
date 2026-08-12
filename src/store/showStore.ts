/**
 * Global show state: the patch, the programmer, and the fixture library.
 * Persisted to localStorage so a student's work survives a reload.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMemo } from 'react'
import type { FixtureDefinition, PatchedFixture, Show, TrussDef } from '../model/types'
import { fixtureFootprint } from '../model/types'
import { DEFAULT_TRUSSES, DEFAULT_TRUSS, nextTrussId } from '../model/venue'
import type { Playback, CueStep, LegacyCue } from '../model/cue'
import { playbacksBySlot, firstFreePlaybackSlot, liveCues, stepValues, migrateLegacyCues } from '../model/cue'
import type { Palette, PaletteKind } from '../model/palette'
import { PALETTE_FUNCTIONS, PALETTE_LABELS } from '../model/palette'
import type { Group } from '../model/group'
import type { Effect, EffectType } from '../engine/effects'
import { applyEffects, activeEffects } from '../engine/effects'
import { BUILTIN_FIXTURES } from '../model/library'
import { templateById } from '../model/templates'
import type { ProgrammerValues } from '../engine/dmx'
import type { Fade } from '../engine/dmx'
import { UNIVERSE_SIZE, mergeProgrammer, computePlaybackBase, resolveLevel, resolveLevels } from '../engine/dmx'

export type AppMode = 'patch' | 'program'

interface ShowState {
  show: Show
  /** All available definitions (built-in + imported), by id. */
  definitions: Record<string, FixtureDefinition>
  programmer: ProgrammerValues
  mode: AppMode
  /** Selected control surface (which console the student is practising on). */
  consoleId: string
  /** Last loaded template id (so the picker shows which rig you're on). */
  templateId: string
  /** Instance ids currently selected in the programmer. */
  selection: string[]
  /** The show's playbacks (each = a fader holding one or more cue steps). */
  playbacks: Playback[]
  /** The connected playback — the one the central Go/Prev/Stop transport drives. */
  connectedId: string | null
  /** Saved palettes (colour/position/gobo/beam/intensity). */
  palettes: Palette[]
  /** Current playback page (0-based); each page shows 10 playbacks. */
  playbackPage: number
  /** User labels for the assignable executors 1–10 (handwritten-tape style). */
  executorLabels: Record<number, string>
  setExecutorLabel: (n: number, label: string) => void
  /** Playback bound to each executor button (executor number → playbackId). */
  executorCues: Record<number, string>
  /** Record the current programmer as a playback and bind it to executor n. */
  recordExecutor: (n: number) => void
  /** Unbind an executor (its playback stays in the stack). */
  clearExecutor: (n: number) => void
  /** Running effects (movement/colour animation). Set by templates for now. */
  effects: Effect[]
  /** Animation clock in seconds (driven while effects run), for 2D/monitor. */
  now: number
  setNow: (t: number) => void
  /** Advance the animation clock by dt seconds. */
  tickClock: (dt: number) => void
  /** Whether effect animations are running (Play) or frozen (Pause). */
  playing: boolean
  setPlaying: (v: boolean) => void
  /** Add a shape (effect) on the current selection, with sensible defaults. */
  addEffect: (type: EffectType) => void
  updateEffect: (id: string, partial: Partial<Effect>) => void
  removeEffect: (id: string) => void

  // Sound to Light — 7 audio bands (see engine/audio.ts), each with a trigger threshold
  // and an optional playback slot it fires when the band crosses that threshold.
  audioEnabled: boolean
  /** Auto Gain (Titan): the engine adjusts input gain automatically. */
  audioAutoGain: boolean
  audioBands: { threshold: number; cueSlot: number | null; enabled: boolean; auto: boolean }[]
  setAudioEnabled: (v: boolean) => void
  setAudioAutoGain: (v: boolean) => void
  setAudioBandThreshold: (i: number, v: number) => void
  setAudioBandCue: (i: number, slot: number | null) => void
  /** Per-band Enable (Titan): disable triggers on this band. */
  setAudioBandEnabled: (i: number, v: boolean) => void
  /** Per-band Auto (Titan): auto-adjust this band's trigger level when idle. */
  setAudioBandAuto: (i: number, v: boolean) => void

  // Quartz desk UI state (shared between its screen + button panel)
  deskAttr: string
  setDeskAttr: (a: string) => void
  deskScreen: string
  setDeskScreen: (s: string) => void

  setMode: (mode: AppMode) => void
  setConsole: (consoleId: string) => void

  // Cues / playback
  /** Record the programmer as a NEW playback (one step) on the first free slot. */
  recordCue: () => void
  /** "Record armed" — after pressing Record, the next playback you touch is the target. */
  recordArm: boolean
  armRecord: () => void
  /** Record onto a specific slot: empty → new playback; occupied → APPEND a step (build a
   *  cue list), exactly like recording again onto the same playback on the real desk. */
  recordCueAt: (index: number) => void
  /** Re-snapshot the current programmer into a playback's live step. */
  updateCue: (id: string) => void
  /** Duplicate a playback onto the first free slot. */
  copyCue: (id: string) => void
  /** Delete a whole playback. */
  deleteCue: (id: string) => void
  /** Delete one step from a playback (removes the playback if it was the last step). */
  deleteStep: (playbackId: string, stepId: string) => void
  /** Fire a playback: connect it and bring up its first step (Go on that handle). */
  goCue: (id: string) => void
  /** Central Go — advance the CONNECTED playback to its next step (wraps at the end). */
  go: () => void
  /** Central Prev — step the connected playback back one. */
  goBack: () => void
  /** Central Stop — release the connected playback. */
  stopPlayback: () => void
  /** Release the connected playback (fade out + disconnect). */
  releaseCue: () => void
  /** Rename a playback (its hand-typed legend). */
  renameCue: (id: string, name: string) => void
  /** Switch a playback between a manual cue list and an auto-timed chase. */
  setPlaybackMode: (id: string, mode: 'list' | 'chase') => void
  /** Set a chase playback's tempo (BPM). */
  setPlaybackBpm: (id: string, bpm: number) => void
  /** Clock hook: advance every running chase to its next step by its BPM. */
  advanceChases: () => void
  /** Per-playback fader level (playbackId → 0–255) — what the desk faders control. */
  playbackLevels: Record<string, number>
  setPlaybackLevel: (playbackId: string, value: number) => void
  /** In-progress Go crossfades (playbackId → fade), interpolated against `now`. */
  fades: Record<string, Fade>
  /** Fade time (seconds) used by the next Go / Release. The TIME key sets it. */
  playbackFade: number
  setPlaybackFade: (seconds: number) => void
  /** Fade a playback out to 0 over the fade time. */
  killPlayback: (playbackId: string) => void
  /** Land completed fades into playbackLevels and drop them (called by the clock). */
  settleFades: () => void

  // Groups — named, reusable selections (Titan's Groups workspace).
  groups: Group[]
  recordGroup: () => void
  recallGroup: (id: string) => void
  renameGroup: (id: string, name: string) => void
  deleteGroup: (id: string) => void

  // Palettes
  /** Capture the programmer's values for a palette kind on the current selection. */
  recordPalette: (kind: PaletteKind) => void
  /** Apply a palette to the current selection (sets its functions in the programmer). */
  applyPalette: (id: string) => void
  deletePalette: (id: string) => void
  /** Rename a palette (its hand-typed legend). */
  renamePalette: (id: string, name: string) => void

  // Playback pages
  setPlaybackPage: (page: number) => void

  // Patch
  addFixture: (definitionId: string, opts?: { modeIndex?: number; address?: number }) => void
  removeFixture: (instanceId: string) => void
  renameFixture: (instanceId: string, name: string) => void
  setFixturePosition: (instanceId: string, x: number, y: number) => void
  /** Move a fixture to another truss (index into venue TRUSSES). */
  setFixtureTruss: (instanceId: string, truss: number) => void
  /** Toggle a fixture between floor-standing and truss-hung. */
  setFixtureFloor: (instanceId: string, floor: boolean) => void
  /** Edit the show's metadata (name / venue / designer) shown in exports. */
  setShowMeta: (patch: Partial<Pick<Show, 'name' | 'venue' | 'designer'>>) => void
  /** Move every selected fixture to a truss / universe at once. */
  setSelectedTruss: (truss: number) => void
  setSelectedUniverse: (universe: number) => void
  /** Rig trusses — add one, remove one (reassigning its fixtures), or edit name/depth/height. */
  addTruss: () => void
  removeTruss: (id: number) => void
  setTruss: (id: number, patch: Partial<Pick<TrussDef, 'name' | 'y' | 'z'>>) => void
  /** Move a fixture to another universe, re-addressing to a free slot there. */
  setFixtureUniverse: (instanceId: string, universe: number) => void
  /** Reorder fixtures left→right by truss position and re-assign DMX addresses in
   *  that order — the way a rig is usually patched (address follows the cable run). */
  readdressByRigOrder: () => void
  /** First free address in a universe for a given footprint, or null if none. */
  findFreeAddress: (footprint: number, universe: number) => number | null

  // Selection + programmer
  select: (instanceIds: string[]) => void
  toggleSelect: (instanceId: string) => void
  clearSelection: () => void
  setChannel: (instanceId: string, channelIndex: number, value: number) => void
  /** Set one channel function across all selected fixtures that have it. */
  setSelectedByFunction: (fn: string, value: number) => void
  /** Remove the given channel functions from the selection's programmer (the Off key). */
  clearSelectedFunctions: (fns: string[]) => void
  /** Spread a function 0→255 across the selection in rig order (the Fan key). */
  fanSelected: (fn: string) => void
  locateSelected: () => void
  clearProgrammer: () => void

  // Active softkey menu context (Titan: root / record / group / patch / palette / ml)
  deskMenu: string
  setDeskMenu: (m: string) => void

  // 3D viewer "house/work lights": lit room to see the rig, off to design the look.
  viewLights: boolean
  setViewLights: (v: boolean) => void

  // Venue behind the rig: either a built-in preset (show.venuePreset, persisted) or a
  // loaded glTF/GLB (venueUrl — transient, its object URL dies on reload). Mutually
  // exclusive: choosing one clears the other.
  venueUrl: string | null
  venueName: string | null
  setVenue: (url: string, name: string) => void
  clearVenue: () => void
  setVenuePreset: (id: string | null) => void

  // Blind: program without the live programmer reaching the real DMX output.
  blind: boolean
  setBlind: (v: boolean) => void

  // Command line (Titan-style keypad syntax, e.g. "1 THRU 4 @ 50")
  cmd: string
  cmdAppend: (token: string) => void
  cmdBackspace: () => void
  cmdClear: () => void
  /** Parse + run the command line (select fixtures by number, optional @level). */
  commitCommand: () => void

  // Library
  addDefinitions: (defs: FixtureDefinition[]) => void

  // Show file / templates
  loadTemplate: (templateId: string) => void
  setShow: (show: Show, programmer?: ProgrammerValues) => void
  /** Serialize the current show to a JSON string for download. */
  exportShow: () => string
  /** Load a show from a parsed JSON object; returns true on success. */
  importShow: (data: unknown) => boolean

  resetShow: () => void
}

let instanceCounter = 0
function nextInstanceId(): string {
  instanceCounter += 1
  return `fx-${Date.now().toString(36)}-${instanceCounter}`
}

function defsRecord(defs: FixtureDefinition[]): Record<string, FixtureDefinition> {
  return Object.fromEntries(defs.map((d) => [d.id, d]))
}

// --- Playback helpers -------------------------------------------------------
/** Per-chase next-advance clock time (seconds), keyed by playback id. Module-level cache;
 *  it's only a timing memo, so it doesn't need to live in the persisted store. */
const chaseClock: Record<string, number> = {}

/** Deep-copy the current programmer values (instance → channel → 0–255). */
function snapProgrammer(s: { programmer: ProgrammerValues }): ProgrammerValues {
  const values: ProgrammerValues = {}
  for (const id in s.programmer) values[id] = { ...s.programmer[id] }
  return values
}
/** Deep-copy the running shapes (so a cue keeps its own effect instances). */
function snapEffects(s: { effects: Effect[] }): Effect[] {
  return s.effects.map((e) => ({ ...e, fixtureIds: [...e.fixtureIds] }))
}
/** Build a fresh one-step playback at a slot. */
function makePlayback(id: string, slot: number, values: ProgrammerValues, effects: Effect[]): Playback {
  return {
    id,
    slot,
    name: `Playback ${slot + 1}`,
    current: -1,
    mode: 'list',
    steps: [{ id: `${id}-s1`, number: 1, name: 'Cue 1', values, effects }],
  }
}
/** Step the connected playback by ±1 (wrapping), holding its level up over the step's fade
 *  time. Returns the partial state for `set`. Shared by the central Go / Prev keys. */
function stepConnected(
  s: ShowState,
  dir: 1 | -1,
): Partial<ShowState> | ShowState {
  const id = s.connectedId
  if (!id) return s
  const pb = s.playbacks.find((p) => p.id === id)
  if (!pb || pb.steps.length === 0) return s
  const n = pb.steps.length
  const next = pb.current < 0 ? (dir > 0 ? 0 : n - 1) : (pb.current + dir + n) % n
  const step = pb.steps[next]
  const dur = step.fadeIn ?? s.playbackFade
  const from = resolveLevel(id, s.playbackLevels, s.fades, s.now)
  // Cross-fade the LOOK from what's live now into the new step over the same time.
  const fromValues = stepValues(pb, s.now)
  const transition = dur > 0 ? { fromValues, start: s.now, dur } : undefined
  const playbacks = s.playbacks.map((p) => (p.id === id ? { ...p, current: next, transition } : p))
  if (dur <= 0 || from >= 255) {
    const fades = { ...s.fades }
    delete fades[id]
    return { playbacks, playbackLevels: { ...s.playbackLevels, [id]: 255 }, fades }
  }
  return { playbacks, fades: { ...s.fades, [id]: { from, to: 255, start: s.now, dur } } }
}

/** Build a small demo show so the app shows something on first launch. */
function makeDemoShow(defs: Record<string, FixtureDefinition>): Show {
  const fixtures: PatchedFixture[] = []
  let address = 1
  const add = (definitionId: string, modeIndex: number, name: string, x: number) => {
    const def = defs[definitionId]
    if (!def) return
    fixtures.push({
      id: nextInstanceId(),
      definitionId,
      modeIndex,
      name,
      universe: 1,
      address,
      position: { x, y: 0.6, z: 0 },
    })
    address += fixtureFootprint(def, modeIndex)
  }
  // Tartanga-style rig: mostly Showtec Phantom 50 spots, a couple of PAR fills.
  add('showtec-phantom-50-led-spot-mkii', 0, 'Phantom 1', -0.6)
  add('showtec-phantom-50-led-spot-mkii', 0, 'Phantom 2', -0.2)
  add('showtec-phantom-50-led-spot-mkii', 0, 'Phantom 3', 0.2)
  add('showtec-phantom-50-led-spot-mkii', 0, 'Phantom 4', 0.6)
  add('generic-rgbw-par', 0, 'PAR 1', -0.4)
  add('generic-rgbw-par', 0, 'PAR 2', 0.4)
  return { name: 'Untitled show', universeCount: 1, fixtures }
}

const initialDefs = defsRecord(BUILTIN_FIXTURES)

export const useShowStore = create<ShowState>()(
  persist(
    (set, get) => ({
      show: makeDemoShow(initialDefs),
      definitions: initialDefs,
      programmer: {},
      mode: 'patch',
      consoleId: 'avolites-quartz',
      templateId: '',
      selection: [],
      playbacks: [],
      connectedId: null,
      palettes: [],
      playbackPage: 0,
      effects: [],
      now: 0,
      setNow: (t) => set({ now: t }),
      tickClock: (dt) => set((s) => ({ now: s.now + dt })),
      playing: true,
      setPlaying: (v) => set({ playing: v }),
      addEffect: (type) =>
        set((s) => {
          if (s.selection.length === 0) return s
          const d =
            type === 'circle' ? { speed: 0.12, size: 60, spread: 1.3 }
            : type === 'colourCycle' ? { speed: 0.08, size: 0, spread: 1.6 }
            : { speed: 0.4, size: 0, spread: 1.0 }
          const eff: Effect = { id: `fx-${Date.now().toString(36)}`, type, fixtureIds: [...s.selection], ...d }
          return { effects: [...s.effects, eff], playing: true }
        }),
      updateEffect: (id, partial) =>
        set((s) => ({
          effects: s.effects.map((e) => (e.id === id ? { ...e, ...partial } : e)),
        })),
      removeEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),

      audioEnabled: false,
      audioAutoGain: false,
      audioBands: Array.from({ length: 7 }, () => ({ threshold: 0.5, cueSlot: null as number | null, enabled: true, auto: false })),
      setAudioEnabled: (v) => set({ audioEnabled: v }),
      setAudioAutoGain: (v) => set({ audioAutoGain: v }),
      setAudioBandThreshold: (i, v) =>
        set((s) => ({ audioBands: s.audioBands.map((b, j) => (j === i ? { ...b, threshold: v, auto: false } : b)) })),
      setAudioBandCue: (i, slot) =>
        set((s) => ({ audioBands: s.audioBands.map((b, j) => (j === i ? { ...b, cueSlot: slot } : b)) })),
      setAudioBandEnabled: (i, v) =>
        set((s) => ({ audioBands: s.audioBands.map((b, j) => (j === i ? { ...b, enabled: v } : b)) })),
      setAudioBandAuto: (i, v) =>
        set((s) => ({ audioBands: s.audioBands.map((b, j) => (j === i ? { ...b, auto: v } : b)) })),

      deskAttr: 'Intensity',
      setDeskAttr: (a) => set({ deskAttr: a }),
      deskScreen: 'fixtures',
      setDeskScreen: (screen) => set({ deskScreen: screen }),

      setMode: (mode) => set({ mode }),
      setConsole: (consoleId) => set({ consoleId }),

      recordCue: () =>
        set((s) => {
          // Plain Record → a NEW one-step playback on the first free slot.
          const slot = firstFreePlaybackSlot(s.playbacks)
          return { playbacks: [...s.playbacks, makePlayback(nextInstanceId(), slot, snapProgrammer(s), snapEffects(s))] }
        }),

      recordArm: false,
      armRecord: () => set((s) => ({ recordArm: !s.recordArm })),
      recordCueAt: (index) =>
        set((s) => {
          const values = snapProgrammer(s)
          const effects = snapEffects(s)
          const existing = playbacksBySlot(s.playbacks)[index]
          if (existing) {
            // Record again onto the same handle → APPEND a step (grow the cue list),
            // exactly like the real desk.
            const num = (existing.steps[existing.steps.length - 1]?.number ?? 0) + 1
            const step: CueStep = { id: `${existing.id}-s${num}-${nextInstanceId()}`, number: num, name: `Cue ${num}`, values, effects }
            return {
              playbacks: s.playbacks.map((p) => (p.id === existing.id ? { ...p, steps: [...p.steps, step] } : p)),
              recordArm: false,
            }
          }
          return { playbacks: [...s.playbacks, makePlayback(nextInstanceId(), index, values, effects)], recordArm: false }
        }),

      updateCue: (id) =>
        set((s) => {
          // Re-snapshot the playback's live step.
          const values = snapProgrammer(s)
          const effects = snapEffects(s)
          return {
            playbacks: s.playbacks.map((p) => {
              if (p.id !== id) return p
              const i = p.current >= 0 ? p.current : 0
              return { ...p, steps: p.steps.map((st, j) => (j === i ? { ...st, values, effects } : st)) }
            }),
          }
        }),

      copyCue: (id) =>
        set((s) => {
          const src = s.playbacks.find((p) => p.id === id)
          if (!src) return s
          const slot = firstFreePlaybackSlot(s.playbacks)
          const pid = nextInstanceId()
          const steps: CueStep[] = src.steps.map((st, k) => ({
            ...st,
            id: `${pid}-s${k + 1}`,
            values: Object.fromEntries(Object.entries(st.values).map(([inst, chs]) => [inst, { ...chs }])),
            effects: st.effects?.map((e) => ({ ...e, fixtureIds: [...e.fixtureIds] })),
          }))
          const pb: Playback = { ...src, id: pid, slot, name: `Playback ${slot + 1}`, current: -1, steps }
          return { playbacks: [...s.playbacks, pb] }
        }),

      deleteCue: (id) =>
        set((s) => {
          const levels = { ...s.playbackLevels }
          delete levels[id]
          const fades = { ...s.fades }
          delete fades[id]
          return {
            playbacks: s.playbacks.filter((p) => p.id !== id),
            connectedId: s.connectedId === id ? null : s.connectedId,
            playbackLevels: levels,
            fades,
          }
        }),

      deleteStep: (playbackId, stepId) =>
        set((s) => {
          const pb = s.playbacks.find((p) => p.id === playbackId)
          if (!pb) return s
          const kept = pb.steps.filter((st) => st.id !== stepId)
          if (kept.length === 0) {
            // Removing the last step drops the whole playback.
            const levels = { ...s.playbackLevels }
            delete levels[playbackId]
            const fades = { ...s.fades }
            delete fades[playbackId]
            return {
              playbacks: s.playbacks.filter((p) => p.id !== playbackId),
              connectedId: s.connectedId === playbackId ? null : s.connectedId,
              playbackLevels: levels,
              fades,
            }
          }
          const steps = kept.map((st, i) => ({ ...st, number: i + 1 }))
          const current = pb.current >= steps.length ? steps.length - 1 : pb.current
          return { playbacks: s.playbacks.map((p) => (p.id === playbackId ? { ...p, steps, current } : p)) }
        }),

      // Go on a handle fires the playback: connect it + bring up its first step over the
      // fade time; the fader then scales it.
      goCue: (id) =>
        set((s) => {
          const pb = s.playbacks.find((p) => p.id === id)
          if (!pb || pb.steps.length === 0) return s
          const playbacks = s.playbacks.map((p) => (p.id === id ? { ...p, current: 0, transition: undefined } : p))
          const from = resolveLevel(id, s.playbackLevels, s.fades, s.now)
          if (s.playbackFade <= 0) {
            const fades = { ...s.fades }
            delete fades[id]
            return { connectedId: id, playbacks, playbackLevels: { ...s.playbackLevels, [id]: 255 }, fades }
          }
          return { connectedId: id, playbacks, fades: { ...s.fades, [id]: { from, to: 255, start: s.now, dur: s.playbackFade } } }
        }),

      // Central Go — advance the CONNECTED playback to its next step (wraps at the end).
      go: () => set((s) => stepConnected(s, +1)),
      goBack: () => set((s) => stepConnected(s, -1)),
      stopPlayback: () => get().releaseCue(),

      setPlaybackMode: (id, mode) =>
        set((s) => ({ playbacks: s.playbacks.map((p) => (p.id === id ? { ...p, mode, bpm: p.bpm ?? 120 } : p)) })),
      setPlaybackBpm: (id, bpm) =>
        set((s) => ({ playbacks: s.playbacks.map((p) => (p.id === id ? { ...p, bpm: Math.max(20, Math.min(600, Math.round(bpm))) } : p)) })),

      advanceChases: () =>
        set((s) => {
          let changed = false
          const playbacks = s.playbacks.map((p) => {
            if (p.mode !== 'chase' || p.steps.length < 2) return p
            if (resolveLevel(p.id, s.playbackLevels, s.fades, s.now) <= 0) return p
            const interval = 60 / (p.bpm ?? 120)
            if (chaseClock[p.id] == null) chaseClock[p.id] = s.now + interval
            if (s.now >= chaseClock[p.id]) {
              chaseClock[p.id] = s.now + interval
              changed = true
              return { ...p, current: p.current < 0 ? 0 : (p.current + 1) % p.steps.length }
            }
            return p
          })
          return changed ? { playbacks } : s
        }),

      killPlayback: (id) =>
        set((s) => {
          const from = resolveLevel(id, s.playbackLevels, s.fades, s.now)
          if (s.playbackFade <= 0) {
            const levels = { ...s.playbackLevels }
            delete levels[id]
            const fades = { ...s.fades }
            delete fades[id]
            return { playbackLevels: levels, fades }
          }
          return { fades: { ...s.fades, [id]: { from, to: 0, start: s.now, dur: s.playbackFade } } }
        }),
      releaseCue: () =>
        set((s) => {
          if (!s.connectedId) return s
          const id = s.connectedId
          const from = resolveLevel(id, s.playbackLevels, s.fades, s.now)
          if (s.playbackFade <= 0) {
            const levels = { ...s.playbackLevels }
            delete levels[id]
            const fades = { ...s.fades }
            delete fades[id]
            return { connectedId: null, playbackLevels: levels, fades }
          }
          return { connectedId: null, fades: { ...s.fades, [id]: { from, to: 0, start: s.now, dur: s.playbackFade } } }
        }),
      renameCue: (id, name) =>
        set((s) => ({ playbacks: s.playbacks.map((p) => (p.id === id ? { ...p, name } : p)) })),
      playbackLevels: {},
      // Faders are manual: set the level directly. Raising from 0 fires the playback's first
      // step and connects it (like raising a fader on the real desk).
      setPlaybackLevel: (id, value) =>
        set((s) => {
          const v = Math.max(0, Math.min(255, value))
          const fades = { ...s.fades }
          delete fades[id]
          const prev = s.playbackLevels[id] ?? 0
          if (prev <= 0 && v > 0) {
            const playbacks = s.playbacks.map((p) => (p.id === id && p.current < 0 ? { ...p, current: 0 } : p))
            return { playbackLevels: { ...s.playbackLevels, [id]: v }, fades, playbacks, connectedId: id }
          }
          return { playbackLevels: { ...s.playbackLevels, [id]: v }, fades }
        }),
      fades: {},
      playbackFade: 3,
      setPlaybackFade: (seconds) => set({ playbackFade: Math.max(0, Math.min(60, seconds)) }),
      settleFades: () =>
        set((s) => {
          const ids = Object.keys(s.fades)
          if (ids.length === 0) return s
          const fades = { ...s.fades }
          const levels = { ...s.playbackLevels }
          let changed = false
          for (const id of ids) {
            const f = s.fades[id]
            if (s.now >= f.start + f.dur) {
              if (f.to <= 0) delete levels[id]
              else levels[id] = f.to
              delete fades[id]
              changed = true
            }
          }
          return changed ? { fades, playbackLevels: levels } : s
        }),

      groups: [],
      recordGroup: () =>
        set((s) => {
          if (s.selection.length === 0) return s
          const group: Group = {
            id: nextInstanceId(),
            name: `Group ${s.groups.length + 1}`,
            fixtureIds: [...s.selection],
          }
          return { groups: [...s.groups, group] }
        }),
      recallGroup: (id) =>
        set((s) => {
          const g = s.groups.find((x) => x.id === id)
          if (!g) return s
          const live = new Set(s.show.fixtures.map((f) => f.id))
          return { selection: g.fixtureIds.filter((fid) => live.has(fid)) }
        }),
      renameGroup: (id, name) =>
        set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)) })),
      deleteGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

      recordPalette: (kind) =>
        set((s) => {
          const fns = new Set<string>(PALETTE_FUNCTIONS[kind])
          const values: Palette['values'] = {}
          // Capture only functions the user actually programmed on the selection.
          for (const id of s.selection) {
            const pf = s.show.fixtures.find((f) => f.id === id)
            const channels = pf && s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
            const edits = s.programmer[id]
            if (!channels || !edits) continue
            channels.forEach((ch, i) => {
              if (fns.has(ch.function) && edits[i] !== undefined) {
                values[ch.function] = edits[i]
              }
            })
          }
          if (Object.keys(values).length === 0) return s // nothing to store
          const count = s.palettes.filter((p) => p.kind === kind).length
          const palette: Palette = {
            id: nextInstanceId(),
            name: `${PALETTE_LABELS[kind]} ${count + 1}`,
            kind,
            values,
          }
          return { palettes: [...s.palettes, palette] }
        }),

      applyPalette: (id) =>
        set((s) => {
          const palette = s.palettes.find((p) => p.id === id)
          if (!palette) return s
          const programmer = { ...s.programmer }
          for (const inst of s.selection) {
            const pf = s.show.fixtures.find((f) => f.id === inst)
            const channels = pf && s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
            if (!channels) continue
            channels.forEach((ch, i) => {
              const v = palette.values[ch.function]
              if (v !== undefined) programmer[inst] = { ...programmer[inst], [i]: v }
            })
          }
          return { programmer }
        }),

      deletePalette: (id) =>
        set((s) => ({ palettes: s.palettes.filter((p) => p.id !== id) })),
      renamePalette: (id, name) =>
        set((s) => ({ palettes: s.palettes.map((p) => (p.id === id ? { ...p, name } : p)) })),

      setPlaybackPage: (page) => set({ playbackPage: Math.max(0, page) }),
      executorLabels: {},
      setExecutorLabel: (n, label) =>
        set((s) => {
          const next = { ...s.executorLabels }
          if (label.trim()) next[n] = label.trim()
          else delete next[n]
          return { executorLabels: next }
        }),
      executorCues: {},
      recordExecutor: (n) =>
        set((s) => {
          if (Object.keys(s.programmer).length === 0) return s
          const slot = firstFreePlaybackSlot(s.playbacks)
          const pb = makePlayback(nextInstanceId(), slot, snapProgrammer(s), snapEffects(s))
          pb.name = s.executorLabels[n] ?? `Exec ${n}`
          pb.steps[0].name = pb.name
          return {
            playbacks: [...s.playbacks, pb],
            executorCues: { ...s.executorCues, [n]: pb.id },
          }
        }),
      clearExecutor: (n) =>
        set((s) => {
          const next = { ...s.executorCues }
          delete next[n]
          return { executorCues: next }
        }),

      findFreeAddress: (footprint, universe) => {
        const occupied = new Uint8Array(UNIVERSE_SIZE + 1) // 1-based
        for (const pf of get().show.fixtures) {
          if (pf.universe !== universe) continue
          const fp = fixtureFootprint(get().definitions[pf.definitionId], pf.modeIndex)
          for (let a = pf.address; a < pf.address + fp && a <= UNIVERSE_SIZE; a++) {
            occupied[a] = 1
          }
        }
        for (let start = 1; start + footprint - 1 <= UNIVERSE_SIZE; start++) {
          let free = true
          for (let a = start; a < start + footprint; a++) {
            if (occupied[a]) {
              free = false
              break
            }
          }
          if (free) return start
        }
        return null
      },

      addFixture: (definitionId, opts) => {
        const def = get().definitions[definitionId]
        if (!def) return
        const modeIndex = opts?.modeIndex ?? 0
        const footprint = fixtureFootprint(def, modeIndex)
        const address = opts?.address ?? get().findFreeAddress(footprint, 1)
        if (address == null) return // universe full
        const count = get().show.fixtures.filter((f) => f.definitionId === definitionId).length
        const fixture: PatchedFixture = {
          id: nextInstanceId(),
          definitionId,
          modeIndex,
          name: `${def.model} ${count + 1}`,
          universe: 1,
          address,
          position: { x: 0, y: 0.6, z: 0 },
        }
        set((s) => ({ show: { ...s.show, fixtures: [...s.show.fixtures, fixture] } }))
      },

      readdressByRigOrder: () =>
        set((s) => {
          const defs = s.definitions
          // Left→right by truss position; current address breaks ties.
          const ordered = [...s.show.fixtures].sort(
            (a, b) => a.position.x - b.position.x || a.address - b.address,
          )
          // Pack addresses sequentially per universe, in that order.
          const nextByUniverse: Record<number, number> = {}
          const fixtures = ordered.map((f) => {
            const def = defs[f.definitionId]
            const fp = def ? fixtureFootprint(def, f.modeIndex) : 1
            const start = nextByUniverse[f.universe] ?? 1
            nextByUniverse[f.universe] = start + fp
            return { ...f, address: start }
          })
          return { show: { ...s.show, fixtures } }
        }),

      removeFixture: (instanceId) =>
        set((s) => {
          const programmer = { ...s.programmer }
          delete programmer[instanceId]
          return {
            show: { ...s.show, fixtures: s.show.fixtures.filter((f) => f.id !== instanceId) },
            programmer,
            selection: s.selection.filter((id) => id !== instanceId),
          }
        }),

      renameFixture: (instanceId, name) =>
        set((s) => ({
          show: {
            ...s.show,
            fixtures: s.show.fixtures.map((f) => (f.id === instanceId ? { ...f, name } : f)),
          },
        })),

      setFixturePosition: (instanceId, x, y) =>
        set((s) => ({
          show: {
            ...s.show,
            fixtures: s.show.fixtures.map((f) =>
              f.id === instanceId ? { ...f, position: { ...f.position, x, y } } : f,
            ),
          },
        })),

      setFixtureTruss: (instanceId, truss) =>
        set((s) => ({
          show: {
            ...s.show,
            fixtures: s.show.fixtures.map((f) => (f.id === instanceId ? { ...f, truss, floor: false } : f)),
          },
        })),

      setFixtureFloor: (instanceId, floor) =>
        set((s) => ({
          show: {
            ...s.show,
            fixtures: s.show.fixtures.map((f) => (f.id === instanceId ? { ...f, floor } : f)),
          },
        })),

      setShowMeta: (patch) => set((s) => ({ show: { ...s.show, ...patch } })),

      setSelectedTruss: (truss) =>
        set((s) => {
          const sel = new Set(s.selection)
          if (sel.size === 0) return {}
          return {
            show: { ...s.show, fixtures: s.show.fixtures.map((f) => (sel.has(f.id) ? { ...f, truss } : f)) },
          }
        }),

      addTruss: () =>
        set((s) => {
          const trusses = s.show.trusses ?? DEFAULT_TRUSSES
          const nt: TrussDef = { id: nextTrussId(trusses), name: `Truss ${trusses.length + 1}`, z: 0, y: 5 }
          return { show: { ...s.show, trusses: [...trusses, nt] } }
        }),
      removeTruss: (id) =>
        set((s) => {
          const trusses = s.show.trusses ?? DEFAULT_TRUSSES
          if (trusses.length <= 1) return {} // always keep at least one truss
          const remaining = trusses.filter((t) => t.id !== id)
          const fallback = remaining[0].id
          const fixtures = s.show.fixtures.map((f) =>
            (f.truss ?? DEFAULT_TRUSS) === id ? { ...f, truss: fallback } : f,
          )
          return { show: { ...s.show, trusses: remaining, fixtures } }
        }),
      setTruss: (id, patch) =>
        set((s) => {
          const trusses = s.show.trusses ?? DEFAULT_TRUSSES
          return { show: { ...s.show, trusses: trusses.map((t) => (t.id === id ? { ...t, ...patch } : t)) } }
        }),

      setSelectedUniverse: (universe) =>
        set((s) => {
          const sel = s.selection
          if (sel.length === 0) return {}
          const selSet = new Set(sel)
          // Occupancy from fixtures already in the target universe that we're NOT moving.
          const occupied = new Uint8Array(UNIVERSE_SIZE + 1)
          for (const o of s.show.fixtures) {
            if (o.universe !== universe || selSet.has(o.id)) continue
            const ofp = fixtureFootprint(s.definitions[o.definitionId], o.modeIndex)
            for (let a = o.address; a < o.address + ofp && a <= UNIVERSE_SIZE; a++) occupied[a] = 1
          }
          // Pack each selected fixture into the next free block, in list order.
          const moves = new Map<string, number>()
          for (const pf of s.show.fixtures) {
            if (!selSet.has(pf.id)) continue
            const fp = fixtureFootprint(s.definitions[pf.definitionId], pf.modeIndex)
            let address: number | null = null
            for (let start = 1; start + fp - 1 <= UNIVERSE_SIZE; start++) {
              let free = true
              for (let a = start; a < start + fp; a++) if (occupied[a]) { free = false; break }
              if (free) { address = start; break }
            }
            if (address == null) continue // target universe full — leave this one put
            for (let a = address; a < address + fp; a++) occupied[a] = 1
            moves.set(pf.id, address)
          }
          if (moves.size === 0) return {}
          return {
            show: {
              ...s.show,
              universeCount: Math.max(s.show.universeCount, universe),
              fixtures: s.show.fixtures.map((f) =>
                moves.has(f.id) ? { ...f, universe, address: moves.get(f.id)! } : f,
              ),
            },
          }
        }),

      setFixtureUniverse: (instanceId, universe) =>
        set((s) => {
          const pf = s.show.fixtures.find((f) => f.id === instanceId)
          if (!pf || pf.universe === universe) return {}
          const fp = fixtureFootprint(s.definitions[pf.definitionId], pf.modeIndex)
          // Find a free block in the target universe (ignoring this fixture's own).
          const occupied = new Uint8Array(UNIVERSE_SIZE + 1)
          for (const o of s.show.fixtures) {
            if (o.universe !== universe || o.id === instanceId) continue
            const ofp = fixtureFootprint(s.definitions[o.definitionId], o.modeIndex)
            for (let a = o.address; a < o.address + ofp && a <= UNIVERSE_SIZE; a++) occupied[a] = 1
          }
          let address: number | null = null
          for (let start = 1; start + fp - 1 <= UNIVERSE_SIZE; start++) {
            let free = true
            for (let a = start; a < start + fp; a++) if (occupied[a]) { free = false; break }
            if (free) { address = start; break }
          }
          if (address == null) return {} // target universe full — leave as-is
          return {
            show: {
              ...s.show,
              universeCount: Math.max(s.show.universeCount, universe),
              fixtures: s.show.fixtures.map((f) => (f.id === instanceId ? { ...f, universe, address } : f)),
            },
          }
        }),

      select: (instanceIds) => set({ selection: instanceIds }),
      toggleSelect: (instanceId) =>
        set((s) => ({
          selection: s.selection.includes(instanceId)
            ? s.selection.filter((id) => id !== instanceId)
            : [...s.selection, instanceId],
        })),
      clearSelection: () => set({ selection: [] }),

      setChannel: (instanceId, channelIndex, value) =>
        set((s) => ({
          programmer: {
            ...s.programmer,
            [instanceId]: { ...s.programmer[instanceId], [channelIndex]: value },
          },
        })),

      setSelectedByFunction: (fn, value) =>
        set((s) => {
          const programmer = { ...s.programmer }
          for (const id of s.selection) {
            const pf = s.show.fixtures.find((f) => f.id === id)
            if (!pf) continue
            const channels = s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels ?? []
            channels.forEach((ch, i) => {
              if (ch.function === fn) {
                programmer[id] = { ...programmer[id], [i]: value }
              }
            })
          }
          return { programmer }
        }),

      clearSelectedFunctions: (fns) =>
        set((s) => {
          const wanted = new Set(fns)
          const programmer = { ...s.programmer }
          for (const id of s.selection) {
            if (!programmer[id]) continue
            const pf = s.show.fixtures.find((f) => f.id === id)
            const channels = pf && s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
            if (!channels) continue
            const edits = { ...programmer[id] }
            channels.forEach((ch, i) => {
              if (wanted.has(ch.function)) delete edits[i]
            })
            if (Object.keys(edits).length) programmer[id] = edits
            else delete programmer[id]
          }
          return { programmer }
        }),

      fanSelected: (fn) =>
        set((s) => {
          // Spread 0→255 across the selection in rig (fixture-list) order.
          const order = s.show.fixtures.map((f) => f.id)
          const ids = s.selection.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))
          if (ids.length < 2) return s
          const programmer = { ...s.programmer }
          ids.forEach((id, idx) => {
            const pf = s.show.fixtures.find((f) => f.id === id)
            const channels = pf && s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
            if (!channels) return
            const value = Math.round((idx / (ids.length - 1)) * 255)
            channels.forEach((ch, i) => {
              if (ch.function === fn) programmer[id] = { ...programmer[id], [i]: value }
            })
          })
          return { programmer }
        }),

      locateSelected: () =>
        set((s) => {
          const programmer = { ...s.programmer }
          for (const id of s.selection) {
            const pf = s.show.fixtures.find((f) => f.id === id)
            if (!pf) continue
            const channels = s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels ?? []
            const edits: Record<number, number> = { ...programmer[id] }
            channels.forEach((ch, i) => {
              edits[i] = ch.highlightValue ?? ch.defaultValue
            })
            programmer[id] = edits
          }
          return { programmer }
        }),

      // Clear empties the programmer — static values AND any running shapes.
      clearProgrammer: () => set({ programmer: {}, effects: [] }),

      deskMenu: 'root',
      setDeskMenu: (m) => set({ deskMenu: m }),

      viewLights: false,
      setViewLights: (v) => set({ viewLights: v }),

      venueUrl: null,
      venueName: null,
      // Loading a custom glTF clears any preset (they're mutually exclusive).
      setVenue: (url, name) =>
        set((s) => {
          if (s.venueUrl) URL.revokeObjectURL(s.venueUrl)
          return { venueUrl: url, venueName: name, show: { ...s.show, venuePreset: undefined } }
        }),
      clearVenue: () =>
        set((s) => {
          if (s.venueUrl) URL.revokeObjectURL(s.venueUrl)
          return { venueUrl: null, venueName: null, show: { ...s.show, venuePreset: undefined } }
        }),
      // Choosing a built-in preset clears any loaded custom model.
      setVenuePreset: (id) =>
        set((s) => {
          if (s.venueUrl) URL.revokeObjectURL(s.venueUrl)
          return { venueUrl: null, venueName: null, show: { ...s.show, venuePreset: id ?? undefined } }
        }),

      blind: false,
      setBlind: (v) => set({ blind: v }),

      cmd: '',
      cmdAppend: (token) => set((s) => ({ cmd: s.cmd + token })),
      cmdBackspace: () => set((s) => ({ cmd: s.cmd.replace(/\s*\S+\s*$/, '') })),
      cmdClear: () => set({ cmd: '' }),
      commitCommand: () =>
        set((s) => {
          const fixtures = s.show.fixtures
          const raw = s.cmd.trim()
          if (!raw) return { cmd: '' }
          // Titan command line: "<selection> @ <level>". "@ @" (or a bare @) = full,
          // "@ <n>" = n%. Keywords Through / Thru / > and And, case-insensitive.
          const hasAt = raw.includes('@')
          const atIdx = raw.indexOf('@')
          const selPart = hasAt ? raw.slice(0, atIdx) : raw
          const atRaw = hasAt ? raw.slice(atIdx).replace(/@/g, '').trim() : undefined
          const toks = selPart.trim().split(/\s+/).filter(Boolean).map((t) => t.toUpperCase())
          const isRange = (t?: string) => t === 'THROUGH' || t === 'THRU' || t === '>'
          const nums = new Set<number>()
          for (let i = 0; i < toks.length; ) {
            if (/^\d+$/.test(toks[i])) {
              if (isRange(toks[i + 1]) && /^\d+$/.test(toks[i + 2] ?? '')) {
                const a = +toks[i], b = +toks[i + 2]
                for (let n = Math.min(a, b); n <= Math.max(a, b); n++) nums.add(n)
                i += 3
              } else {
                nums.add(+toks[i])
                i += 1
              }
            } else i += 1 // skip And / stray keywords
          }
          const ids = [...nums].filter((n) => n >= 1 && n <= fixtures.length).map((n) => fixtures[n - 1].id)
          const selection = ids.length ? ids : s.selection
          let programmer = s.programmer
          if (hasAt) {
            // Empty (@ @ or bare @) → full; otherwise clamp the typed percentage.
            const value = atRaw === '' ? 255 : Math.round((Math.max(0, Math.min(100, +atRaw! || 0)) / 100) * 255)
            programmer = { ...programmer }
            for (const id of selection) {
              const pf = fixtures.find((f) => f.id === id)
              if (!pf) continue
              const channels = s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels ?? []
              channels.forEach((ch, i) => {
                if (ch.function === 'dimmer') programmer[id] = { ...programmer[id], [i]: value }
              })
            }
          }
          return { selection, programmer, cmd: '' }
        }),

      addDefinitions: (defs) =>
        set((s) => ({ definitions: { ...s.definitions, ...defsRecord(defs) } })),

      loadTemplate: (templateId) => {
        const tpl = templateById(templateId)
        if (!tpl) return
        const { show, programmer, effects } = tpl.build(get().definitions)
        set({
          show,
          programmer,
          effects: effects ?? [],
          now: 0,
          selection: [],
          playbacks: [],
          connectedId: null,
          palettes: [],
          playbackPage: 0,
          templateId,
        })
      },

      setShow: (show, programmer = {}) =>
        set({
          show,
          programmer,
          effects: [],
          now: 0,
          selection: [],
          playbacks: [],
          connectedId: null,
          palettes: [],
          playbackPage: 0,
        }),

      exportShow: () => {
        const { show, programmer, effects, palettes } = get()
        return JSON.stringify(
          { app: 'DMXSimulatoR', version: 1, show, programmer, effects, palettes },
          null,
          2,
        )
      },

      importShow: (data) => {
        if (typeof data !== 'object' || data === null) return false
        const d = data as {
          show?: Show
          programmer?: ProgrammerValues
          effects?: Effect[]
          palettes?: Palette[]
        }
        if (!d.show || !Array.isArray(d.show.fixtures)) return false
        // Drop fixtures whose definition isn't in the library (unknown import).
        const defs = get().definitions
        const fixtures = d.show.fixtures.filter((f) => defs[f.definitionId])
        set({
          show: { ...d.show, fixtures },
          programmer: d.programmer ?? {},
          effects: d.effects ?? [],
          palettes: d.palettes ?? [],
          now: 0,
          selection: [],
          playbacks: [],
          connectedId: null,
          playbackPage: 0,
          templateId: '',
        })
        return true
      },

      resetShow: () =>
        set((s) => ({
          show: makeDemoShow(s.definitions),
          programmer: {},
          selection: [],
          playbacks: [],
          connectedId: null,
          playbackLevels: {},
          fades: {},
          executorCues: {},
          palettes: [],
          groups: [],
          playbackPage: 0,
          effects: [],
          now: 0,
          templateId: '',
        })),
    }),
    {
      name: 'dmxsimulator-show',
      version: 3,
      // v3: cues (one per fader) → playbacks (a fader holds a list of cue steps). Reuse the
      // old cue id as the playback id so persisted levels/fades/executor bindings stay valid.
      migrate: (persisted, version) => {
        const s = persisted as Record<string, unknown>
        if (version < 3 && Array.isArray(s.cues)) {
          s.playbacks = migrateLegacyCues(s.cues as LegacyCue[])
          s.connectedId = (s.activeCueId as string | null) ?? null
          delete s.cues
          delete s.activeCueId
        }
        return s
      },
      // Persist the work + chosen console, not transient UI state.
      partialize: (s) => ({
        show: s.show,
        programmer: s.programmer,
        consoleId: s.consoleId,
        templateId: s.templateId,
        playbacks: s.playbacks,
        connectedId: s.connectedId,
        playbackLevels: s.playbackLevels,
        playbackFade: s.playbackFade,
        palettes: s.palettes,
        groups: s.groups,
        effects: s.effects,
        executorLabels: s.executorLabels,
        executorCues: s.executorCues,
      }),
    },
  ),
)

// Dev aid: expose the live store on window so it can be driven from the console/tests
// (bare `import()` in the console gets a different HMR module instance).
if (import.meta.env.DEV) (window as unknown as { __showStore?: unknown }).__showStore = useShowStore

/**
 * Effective output values = the active playback cue with the live programmer laid
 * on top. This is what the monitor and visualizers should render.
 */
/**
 * The merged output values. `respectBlind` is used by the DMX monitor (the real
 * output): in blind mode the live programmer is withheld so it doesn't reach the
 * rig, while the visualisers keep showing the programmer as a blind preview.
 */
export function useEffectiveProgrammer(respectBlind = false): ProgrammerValues {
  const programmer = useShowStore((s) => s.programmer)
  const playbacks = useShowStore((s) => s.playbacks)
  const playbackLevels = useShowStore((s) => s.playbackLevels)
  const fades = useShowStore((s) => s.fades)
  const effects = useShowStore((s) => s.effects)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const now = useShowStore((s) => s.now)
  const blind = useShowStore((s) => s.blind)
  return useMemo(() => {
    // Each playback contributes its live step (id = playback id) to the merge, interpolated
    // while a Go cross-fade is in progress.
    const cues = liveCues(playbacks, now)
    const levels = resolveLevels(playbackLevels, fades, now)
    const base = computePlaybackBase(cues, levels, show, definitions)
    const merged = respectBlind && blind ? base : mergeProgrammer(base, programmer)
    // Blind holds the whole programmer from the real output — its live shapes too, not
    // just the static values. Playback (cue) shapes still run.
    const liveEffects = respectBlind && blind ? [] : effects
    const active = activeEffects(cues, playbackLevels, fades, now, liveEffects)
    return applyEffects(merged, active, show, definitions, now)
  }, [programmer, playbacks, playbackLevels, fades, effects, show, definitions, now, blind, respectBlind])
}
