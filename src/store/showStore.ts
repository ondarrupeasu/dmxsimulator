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
import type { Cue } from '../model/cue'
import type { Palette, PaletteKind } from '../model/palette'
import { PALETTE_FUNCTIONS, PALETTE_LABELS } from '../model/palette'
import type { Group } from '../model/group'
import type { Effect } from '../engine/effects'
import { applyEffects } from '../engine/effects'
import { BUILTIN_FIXTURES } from '../model/library'
import { templateById } from '../model/templates'
import type { ProgrammerValues } from '../engine/dmx'
import type { Fade } from '../engine/dmx'
import { UNIVERSE_SIZE, mergeProgrammer, computePlaybackBase, resolveLevel, resolveLevels } from '../engine/dmx'

export type AppMode = 'patch' | 'program' | 'run'

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
  /** Recorded cues (the show's playback stack). */
  cues: Cue[]
  /** Cue currently output by the playback, or null. */
  activeCueId: string | null
  /** Saved palettes (colour/position/gobo/beam/intensity). */
  palettes: Palette[]
  /** Current playback page (0-based); each page shows 10 cues. */
  playbackPage: number
  /** User labels for the assignable executors 1–10 (handwritten-tape style). */
  executorLabels: Record<number, string>
  setExecutorLabel: (n: number, label: string) => void
  /** Cue bound to each executor button (executor number → cueId). */
  executorCues: Record<number, string>
  /** Record the current programmer as a cue and bind it to executor n. */
  recordExecutor: (n: number) => void
  /** Unbind an executor (its cue stays in the cue list). */
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
  updateEffect: (id: string, partial: Partial<Effect>) => void
  removeEffect: (id: string) => void

  // Quartz desk UI state (shared between its screen + button panel)
  deskAttr: string
  setDeskAttr: (a: string) => void
  deskScreen: string
  setDeskScreen: (s: string) => void

  setMode: (mode: AppMode) => void
  setConsole: (consoleId: string) => void

  // Cues / playback
  recordCue: () => void
  /** Re-snapshot the current programmer into an existing cue. */
  updateCue: (id: string) => void
  /** Duplicate a cue at the end of the list. */
  copyCue: (id: string) => void
  deleteCue: (id: string) => void
  goCue: (id: string) => void
  releaseCue: () => void
  /** Rename a cue (its hand-typed legend). */
  renameCue: (id: string, name: string) => void
  /** Per-playback fader level (cueId → 0–255) — what the desk faders control. */
  playbackLevels: Record<string, number>
  setPlaybackLevel: (cueId: string, value: number) => void
  /** In-progress Go crossfades (cueId → fade), interpolated against `now`. */
  fades: Record<string, Fade>
  /** Fade time (seconds) used by the next Go / Release. The TIME key sets it. */
  playbackFade: number
  setPlaybackFade: (seconds: number) => void
  /** Fade a playback out to 0 over the fade time. */
  killPlayback: (cueId: string) => void
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

  // Blind: program without the live programmer reaching the real DMX output.
  blind: boolean
  setBlind: (v: boolean) => void

  // Smoke trigger: a fog/haze machine has no real dimmer — you open or close its
  // valve. This latches every patched hazer's haze channel fully on/off at once,
  // like the dedicated smoke button on the desk.
  smoke: boolean
  toggleSmoke: () => void

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
      cues: [],
      activeCueId: null,
      palettes: [],
      playbackPage: 0,
      effects: [],
      now: 0,
      setNow: (t) => set({ now: t }),
      tickClock: (dt) => set((s) => ({ now: s.now + dt })),
      playing: true,
      setPlaying: (v) => set({ playing: v }),
      updateEffect: (id, partial) =>
        set((s) => ({
          effects: s.effects.map((e) => (e.id === id ? { ...e, ...partial } : e)),
        })),
      removeEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),

      deskAttr: 'Intensity',
      setDeskAttr: (a) => set({ deskAttr: a }),
      deskScreen: 'fixtures',
      setDeskScreen: (screen) => set({ deskScreen: screen }),

      setMode: (mode) => set({ mode }),
      setConsole: (consoleId) => set({ consoleId }),

      recordCue: () =>
        set((s) => {
          // Deep-copy the current programmer as the cue snapshot.
          const values: ProgrammerValues = {}
          for (const id in s.programmer) values[id] = { ...s.programmer[id] }
          const cue: Cue = { id: nextInstanceId(), name: `Cue ${s.cues.length + 1}`, values }
          return { cues: [...s.cues, cue] }
        }),

      updateCue: (id) =>
        set((s) => {
          const values: ProgrammerValues = {}
          for (const inst in s.programmer) values[inst] = { ...s.programmer[inst] }
          return { cues: s.cues.map((c) => (c.id === id ? { ...c, values } : c)) }
        }),

      copyCue: (id) =>
        set((s) => {
          const src = s.cues.find((c) => c.id === id)
          if (!src) return s
          const values: ProgrammerValues = {}
          for (const inst in src.values) values[inst] = { ...src.values[inst] }
          const cue: Cue = { id: nextInstanceId(), name: `Cue ${s.cues.length + 1}`, values }
          return { cues: [...s.cues, cue] }
        }),

      deleteCue: (id) =>
        set((s) => {
          const levels = { ...s.playbackLevels }
          delete levels[id]
          const fades = { ...s.fades }
          delete fades[id]
          return {
            cues: s.cues.filter((c) => c.id !== id),
            activeCueId: s.activeCueId === id ? null : s.activeCueId,
            playbackLevels: levels,
            fades,
          }
        }),

      // Go / flash fades the playback up to full over the fade time and connects it;
      // the fader can then scale it. Release fades the connected playback back out.
      goCue: (id) =>
        set((s) => {
          const from = resolveLevel(id, s.playbackLevels, s.fades, s.now)
          if (s.playbackFade <= 0) {
            const fades = { ...s.fades }
            delete fades[id]
            return { activeCueId: id, playbackLevels: { ...s.playbackLevels, [id]: 255 }, fades }
          }
          return { activeCueId: id, fades: { ...s.fades, [id]: { from, to: 255, start: s.now, dur: s.playbackFade } } }
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
          if (!s.activeCueId) return s
          const id = s.activeCueId
          const from = resolveLevel(id, s.playbackLevels, s.fades, s.now)
          if (s.playbackFade <= 0) {
            const levels = { ...s.playbackLevels }
            delete levels[id]
            const fades = { ...s.fades }
            delete fades[id]
            return { activeCueId: null, playbackLevels: levels, fades }
          }
          return { activeCueId: null, fades: { ...s.fades, [id]: { from, to: 0, start: s.now, dur: s.playbackFade } } }
        }),
      renameCue: (id, name) =>
        set((s) => ({ cues: s.cues.map((c) => (c.id === id ? { ...c, name } : c)) })),
      playbackLevels: {},
      // Faders are manual: set the level directly and cancel any fade on that playback.
      setPlaybackLevel: (cueId, value) =>
        set((s) => {
          const fades = { ...s.fades }
          delete fades[cueId]
          return { playbackLevels: { ...s.playbackLevels, [cueId]: Math.max(0, Math.min(255, value)) }, fades }
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
          const values: ProgrammerValues = {}
          for (const inst in s.programmer) values[inst] = { ...s.programmer[inst] }
          const cue: Cue = { id: nextInstanceId(), name: s.executorLabels[n] ?? `Exec ${n}`, values }
          return {
            cues: [...s.cues, cue],
            executorCues: { ...s.executorCues, [n]: cue.id },
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

      clearProgrammer: () => set({ programmer: {}, smoke: false }),

      deskMenu: 'root',
      setDeskMenu: (m) => set({ deskMenu: m }),

      viewLights: false,
      setViewLights: (v) => set({ viewLights: v }),

      blind: false,
      setBlind: (v) => set({ blind: v }),

      smoke: false,
      toggleSmoke: () =>
        set((s) => {
          const on = !s.smoke
          const programmer = { ...s.programmer }
          for (const pf of s.show.fixtures) {
            const def = s.definitions[pf.definitionId]
            if (def?.category !== 'hazer') continue
            const channels = def.modes[pf.modeIndex]?.channels ?? []
            const edits = { ...programmer[pf.id] }
            channels.forEach((ch, i) => {
              // Open the haze valve full, and spin the fan so it actually comes out.
              if (ch.function === 'haze') on ? (edits[i] = 255) : delete edits[i]
              else if (ch.function === 'control' && on) edits[i] = 255
            })
            if (Object.keys(edits).length) programmer[pf.id] = edits
            else delete programmer[pf.id]
          }
          return { smoke: on, programmer }
        }),

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
          cues: [],
          activeCueId: null,
          palettes: [],
          playbackPage: 0,
          templateId,
          smoke: false,
        })
      },

      setShow: (show, programmer = {}) =>
        set({
          show,
          programmer,
          effects: [],
          now: 0,
          selection: [],
          cues: [],
          activeCueId: null,
          palettes: [],
          playbackPage: 0,
          smoke: false,
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
          cues: [],
          activeCueId: null,
          playbackPage: 0,
          templateId: '',
          smoke: false,
        })
        return true
      },

      resetShow: () =>
        set((s) => ({
          show: makeDemoShow(s.definitions),
          programmer: {},
          smoke: false,
          selection: [],
          cues: [],
          activeCueId: null,
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
      version: 2,
      // Persist the work + chosen console, not transient UI state.
      partialize: (s) => ({
        show: s.show,
        programmer: s.programmer,
        consoleId: s.consoleId,
        templateId: s.templateId,
        cues: s.cues,
        activeCueId: s.activeCueId,
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
  const cues = useShowStore((s) => s.cues)
  const playbackLevels = useShowStore((s) => s.playbackLevels)
  const fades = useShowStore((s) => s.fades)
  const effects = useShowStore((s) => s.effects)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const now = useShowStore((s) => s.now)
  const blind = useShowStore((s) => s.blind)
  return useMemo(() => {
    const levels = resolveLevels(playbackLevels, fades, now)
    const base = computePlaybackBase(cues, levels, show, definitions)
    const merged = respectBlind && blind ? base : mergeProgrammer(base, programmer)
    return applyEffects(merged, effects, show, definitions, now)
  }, [programmer, cues, playbackLevels, fades, effects, show, definitions, now, blind, respectBlind])
}
