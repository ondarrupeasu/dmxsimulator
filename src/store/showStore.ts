/**
 * Global show state: the patch, the programmer, and the fixture library.
 * Persisted to localStorage so a student's work survives a reload.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMemo } from 'react'
import type { FixtureDefinition, PatchedFixture, Show } from '../model/types'
import { fixtureFootprint } from '../model/types'
import type { Cue } from '../model/cue'
import type { Palette, PaletteKind } from '../model/palette'
import { PALETTE_FUNCTIONS, PALETTE_LABELS } from '../model/palette'
import type { Effect } from '../engine/effects'
import { applyEffects } from '../engine/effects'
import { BUILTIN_FIXTURES } from '../model/library'
import { templateById } from '../model/templates'
import type { ProgrammerValues } from '../engine/dmx'
import { UNIVERSE_SIZE, mergeProgrammer } from '../engine/dmx'

export type AppMode = 'patch' | 'program' | 'run'

interface ShowState {
  show: Show
  /** All available definitions (built-in + imported), by id. */
  definitions: Record<string, FixtureDefinition>
  programmer: ProgrammerValues
  mode: AppMode
  /** Selected control surface (which console the student is practising on). */
  consoleId: string
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

  // Palettes
  /** Capture the programmer's values for a palette kind on the current selection. */
  recordPalette: (kind: PaletteKind) => void
  /** Apply a palette to the current selection (sets its functions in the programmer). */
  applyPalette: (id: string) => void
  deletePalette: (id: string) => void

  // Playback pages
  setPlaybackPage: (page: number) => void

  // Patch
  addFixture: (definitionId: string, opts?: { modeIndex?: number; address?: number }) => void
  removeFixture: (instanceId: string) => void
  renameFixture: (instanceId: string, name: string) => void
  setFixturePosition: (instanceId: string, x: number, y: number) => void
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
  locateSelected: () => void
  clearProgrammer: () => void

  // Active softkey menu context (Titan: root / record / group / patch / palette / ml)
  deskMenu: string
  setDeskMenu: (m: string) => void

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
        set((s) => ({
          cues: s.cues.filter((c) => c.id !== id),
          activeCueId: s.activeCueId === id ? null : s.activeCueId,
        })),

      goCue: (id) => set({ activeCueId: id }),
      releaseCue: () => set({ activeCueId: null }),

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

      setPlaybackPage: (page) => set({ playbackPage: Math.max(0, page) }),
      executorLabels: {},
      setExecutorLabel: (n, label) =>
        set((s) => {
          const next = { ...s.executorLabels }
          if (label.trim()) next[n] = label.trim()
          else delete next[n]
          return { executorLabels: next }
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

      clearProgrammer: () => set({ programmer: {} }),

      deskMenu: 'root',
      setDeskMenu: (m) => set({ deskMenu: m }),

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
        })
        return true
      },

      resetShow: () =>
        set((s) => ({
          show: makeDemoShow(s.definitions),
          programmer: {},
          selection: [],
          cues: [],
          activeCueId: null,
          palettes: [],
          playbackPage: 0,
          effects: [],
          now: 0,
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
        cues: s.cues,
        activeCueId: s.activeCueId,
        palettes: s.palettes,
        effects: s.effects,
        executorLabels: s.executorLabels,
      }),
    },
  ),
)

/**
 * Effective output values = the active playback cue with the live programmer laid
 * on top. This is what the monitor and visualizers should render.
 */
export function useEffectiveProgrammer(): ProgrammerValues {
  const programmer = useShowStore((s) => s.programmer)
  const cues = useShowStore((s) => s.cues)
  const activeCueId = useShowStore((s) => s.activeCueId)
  const effects = useShowStore((s) => s.effects)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const now = useShowStore((s) => s.now)
  return useMemo(() => {
    const base = cues.find((c) => c.id === activeCueId)?.values ?? {}
    const merged = mergeProgrammer(base, programmer)
    return applyEffects(merged, effects, show, definitions, now)
  }, [programmer, cues, activeCueId, effects, show, definitions, now])
}
