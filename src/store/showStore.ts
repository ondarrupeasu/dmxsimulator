/**
 * Global show state: the patch, the programmer, and the fixture library.
 * Persisted to localStorage so a student's work survives a reload.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMemo } from 'react'
import type { FixtureDefinition, PatchedFixture, Show, TrussDef } from '../model/types'
import { fixtureFootprint, nextUserNumber } from '../model/types'
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
import { UNIVERSE_SIZE, mergeProgrammer, computePlaybackBase, resolveLevel, effectivePlaybackLevels, applyHighlight } from '../engine/dmx'

export type AppMode = 'patch' | 'program'

/** Standard Titan window positions (Cog / Window Appearance): quarters, halves, full. */
export type WinPos = 'full' | 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br'
/** One workspace window on the Titan touchscreen. `pos` is a standard slot (Cog); `rect`
 *  (percent l/t/w/h) overrides it when the window has been freely dragged/resized. */
export interface DeskWindow { id: string; screen: string; pos: WinPos; rect?: { l: number; t: number; w: number; h: number }; monitor?: 'main' | 'ext' }

/** Place window `id` on monitor `mon` without covering the windows already there: empty target
 *  → full; if the only one there is full, shrink it to a quarter so the newcomer fits; then the
 *  newcomer takes the first free quarter. Keeps the "windows don't overlap" rule on both screens. */
function tileInto(windows: DeskWindow[], id: string, mon: 'main' | 'ext'): DeskWindow[] {
  let wins = windows
  const onTarget = wins.filter((w) => w.id !== id && (w.monitor ?? 'main') === mon)
  const place = (pos: WinPos) => wins.map((w) => (w.id === id ? { ...w, monitor: mon, rect: undefined, pos } : w))
  if (onTarget.length === 0) return place('full')
  // Second window: stack — the existing one goes on top, the newcomer below (e.g. visualiser
  // over fixtures). This is the common 2-window arrangement on the external monitor.
  if (onTarget.length === 1 && !onTarget[0].rect && onTarget[0].pos === 'full') {
    wins = wins.map((w) => (w.id === onTarget[0].id ? { ...w, pos: 'top' as WinPos } : w))
    return wins.map((w) => (w.id === id ? { ...w, monitor: mon, rect: undefined, pos: 'bottom' as WinPos } : w))
  }
  const taken = new Set(onTarget.map((w) => w.pos))
  return place((['tl', 'tr', 'bl', 'br'] as WinPos[]).find((q) => !taken.has(q)) ?? 'full')
}

/** A Titan "Workspace": a named snapshot of the on-screen window layout (the whole mosaic). */
export interface DeskWorkspace {
  id: string
  name: string
  windows: DeskWindow[]
  viewer: '2d' | '3d'
  fold: { screen: boolean; fixtures: boolean; monitor: boolean }
}

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
  /** SIMULATOR HELPER: one-click Sound-to-Light demo — records two bright looks (red / blue)
   *  to playbacks and maps them to the bass and mid bands, so you can hear a track and see it
   *  react without building it by hand. */
  setupAudioDemo: () => void

  // Quartz desk UI state (shared between its screen + button panel)
  deskAttr: string
  setDeskAttr: (a: string) => void
  // The focused window's workspace (kept in sync with deskWindows/deskFocus so the many
  // readers/setters of deskScreen — executors, DMX-monitor click, tabs — keep working).
  deskScreen: string
  setDeskScreen: (s: string) => void
  // Titan "External Display" (System → Display Setup): you connect the 2nd monitor first, then
  // send windows to it. Here "connected" = the external-monitor browser window is open.
  extConnected: boolean
  setExtConnected: (v: boolean) => void
  // The PWA side panel (bottom-right, blue) toggles between the DMX monitor and the Patch tool.
  // Patch is a PWA aid (Titan patches via menus, not a window), so it lives here, not in the desk.
  rightPanel: 'monitor' | 'patch'
  setRightPanel: (p: 'monitor' | 'patch') => void
  // Titan mosaic: the touchscreen holds one or more workspace windows, each at a standard
  // position (quarter/half/full). deskFocus = the active window (tabs + Cog act on it).
  deskWindows: DeskWindow[]
  deskFocus: string
  setWindowPos: (id: string, pos: WinPos) => void
  setWindowRect: (id: string, rect: { l: number; t: number; w: number; h: number }) => void
  /** Move a window between the main touchscreen and the external monitor (2nd display). */
  moveWindowMonitor: (id: string, monitor: 'main' | 'ext') => void
  focusWindow: (id: string) => void
  addWindow: (screen?: string) => void
  closeWindow: (id: string) => void

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
  /** "Connect armed" — after pressing Connect, the next playback you touch becomes the one the
   *  central Go/Prev/Stop drive, WITHOUT firing it. */
  connectArm: boolean
  armConnect: () => void
  /** Connect a playback to the central transport without firing it. */
  connectPlayback: (id: string) => void
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
  /** Manual fader position per playback (playbackId → 0–255). Set ONLY by dragging — the
   *  Quartz faders are NOT motorised, so this never animates on its own. */
  playbackLevels: Record<string, number>
  setPlaybackLevel: (playbackId: string, value: number) => void
  /** Fired level per playback — the intensity a Go / flash / executor / audio trigger brings
   *  up (it fades over time). Kept SEPARATE from the manual fader so firing lights a playback
   *  without moving its handle; the output master is HTP(manual fader, fired level). */
  firedLevels: Record<string, number>
  /** In-progress fired-level fades (playbackId → fade), interpolated against `now`. */
  fades: Record<string, Fade>
  /** Playbacks currently FLASHED (added into the output at full, HTP). On the real desk Flash
   *  is momentary (held); a browser can't hold two buttons at once, so here it's a TOGGLE and
   *  several can be latched on together. */
  flashIds: string[]
  /** The playback currently SWOPPED (full while ALL other output is muted). Toggle; solo, so
   *  only one at a time. */
  swopId: string | null
  /** Toggle a playback's Flash on/off (mouse click). */
  flash: (id: string) => void
  /** Toggle a playback's Swop on/off (solo) (mouse click). */
  swop: (id: string) => void
  /** Set a playback's Flash explicitly — used by the keyboard (hold key = on, release = off),
   *  which CAN press several at once (a mouse can't), so it's momentary + multi like the desk. */
  setFlash: (id: string, on: boolean) => void
  /** Set a playback's Swop explicitly (keyboard hold). */
  setSwop: (id: string, on: boolean) => void
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
  /** Patch one or more fixtures. Titan-style: `quantity` units are patched from `address`
   *  (defaults to the next free slot) on `universe`, each auto-advancing by the footprint
   *  (+ `offset` gap). Omit address for pure auto-patch. */
  addFixture: (definitionId: string, opts?: { modeIndex?: number; address?: number; universe?: number; quantity?: number; offset?: number; truss?: number }) => void
  removeFixture: (instanceId: string) => void
  renameFixture: (instanceId: string, name: string) => void
  setFixturePosition: (instanceId: string, x: number, y: number) => void
  /** Move a fixture to another truss (index into venue TRUSSES). */
  setFixtureTruss: (instanceId: string, truss: number) => void
  /** Toggle a fixture between floor-standing and truss-hung. */
  setFixtureFloor: (instanceId: string, floor: boolean) => void
  /** Set a non-moving fixture's physical rigging aim (pan/tilt degrees). */
  setFixtureAim: (instanceId: string, pan: number, tilt: number) => void
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
  /** Spread a function 0→255 across the selection in rig order (legacy one-shot). */
  fanSelected: (fn: string) => void
  /** Fan MODE (Titan): while on, turning a wheel FANS that attribute across the selection
   *  (symmetric Line curve — first/last fixtures move to opposite sides, the centre stays)
   *  instead of setting a uniform value. Held/latched on the desk → a toggle here. */
  fanMode: boolean
  toggleFanMode: () => void
  /** Apply a symmetric fan delta to a function across the selection (used by the wheels while
   *  Fan mode is on). `delta` is how far the wheel turned. */
  fanAdjust: (fn: string, delta: number) => void
  locateSelected: () => void
  clearProgrammer: () => void

  // Active softkey menu context (Titan: root / record / group / patch / palette / ml)
  deskMenu: string
  setDeskMenu: (m: string) => void

  // 3D viewer "house/work lights": lit room to see the rig, off to design the look.
  // The dock (monitor 1) and the external monitor (monitor 2) are INDEPENDENT visualisers —
  // like two separate Capture windows — so each keeps its own room-lights and 2D/3D. The plain
  // `viewLights`/`viewer` are the dock's; `viewLightsExt`/`viewerExt` are the ext monitor's.
  viewLights: boolean
  setViewLights: (v: boolean) => void
  viewLightsExt: boolean
  setViewLightsExt: (v: boolean) => void

  // "Set Legend" armed (Titan's Set Legend flow): the desk waits for you to touch a handle
  // (group, palette, fixture…) and then names it. Transient — never persisted.
  legendArm: boolean
  setLegendArm: (v: boolean) => void

  // What the corner of each Fixtures-window button shows (Titan: User Number Shown / DMX Address
  // Shown / User Number Hidden). Set from the window's Cog (Window Appearance) menu.
  fixtureLabel: 'user' | 'address' | 'hidden'
  setFixtureLabel: (v: 'user' | 'address' | 'hidden') => void

  // Record Mask (Titan): which attribute banks a Record stores. All-on = record everything;
  // turn a bank off to, e.g., record a Colour-only cue. Applies to cue/executor recording.
  recordMask: RecordMask
  toggleRecordMask: (kind: PaletteKind) => void
  clearRecordMask: () => void

  // Visualiser toggle (2D plan ↔ 3D). Lifted into the store so a recalled Workspace/View
  // (Titan's saved window layouts) can restore it along with the rest of the arrangement.
  viewer: '2d' | '3d'
  setViewer: (v: '2d' | '3d') => void
  viewerExt: '2d' | '3d'
  setViewerExt: (v: '2d' | '3d') => void
  // Whether the Visualiser pane is shown. Toggled from the Titan (executor 15 / its hide
  // button), like opening/closing the Capture workspace. When off, the PWA panel fills the
  // right column. Persisted so it survives a reload.
  viewerVisible: boolean
  setViewerVisible: (v: boolean) => void
  // Where the visualiser lives: 'dock' = the right-hand pane on the main screen; 'ext' = a tile
  // on the external monitor (2nd display). Moving it to 'ext' hides the dock pane.
  viewerLocation: 'dock' | 'ext'
  setViewerLocation: (loc: 'dock' | 'ext') => void
  // Which of the right-column panes are folded away. Single source of truth so a View can
  // fold/unfold them; AppShell mirrors these onto the resizable-panel handles.
  fold: { screen: boolean; fixtures: boolean; monitor: boolean }
  setFold: (key: 'screen' | 'fixtures' | 'monitor', val: boolean) => void
  // Titan "Workspaces": named snapshots of the window layout (active desk screen + viewer +
  // which panes are folded). Recorded with Open/View → Record Workspace, recalled by touch.
  workspaces: DeskWorkspace[]
  recordWorkspace: (name: string) => void
  recallWorkspace: (id: string) => void
  deleteWorkspace: (id: string) => void
  // "Record Workspace" armed: the next empty Workspace button becomes the target (Quick Record).
  workspaceRecordArm: boolean
  armWorkspaceRecord: () => void

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
  /** Highlight (Titan): a latching aid that lifts the SELECTED fixtures to full intensity on
   *  stage so you can see what you're controlling — non-destructive (never enters the
   *  programmer). Toggled by the HiLight key. */
  highlight: boolean
  toggleHighlight: () => void

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
export type RecordMask = Record<PaletteKind, boolean>
/** Inverse of PALETTE_FUNCTIONS: channel function → its attribute bank (kind). */
const FUNCTION_KIND: Record<string, PaletteKind> = (() => {
  const m: Record<string, PaletteKind> = {}
  for (const k of Object.keys(PALETTE_FUNCTIONS) as PaletteKind[]) for (const fn of PALETTE_FUNCTIONS[k]) m[fn] = k
  return m
})()
/** Like snapProgrammer, but drops channels whose attribute bank is masked OUT (Titan's Record
 *  Mask). A full mask (every bank on) records everything, including unclassified functions;
 *  once any bank is off, only enabled banks are stored (unclassified functions are kept). */
function snapProgrammerMasked(s: { programmer: ProgrammerValues; show: Show; definitions: Record<string, FixtureDefinition>; recordMask: RecordMask }): ProgrammerValues {
  const base = snapProgrammer(s)
  if ((Object.values(s.recordMask) as boolean[]).every(Boolean)) return base
  const out: ProgrammerValues = {}
  for (const id in base) {
    const pf = s.show.fixtures.find((f) => f.id === id)
    const channels = pf && s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
    if (!channels) { out[id] = base[id]; continue }
    const kept: Record<number, number> = {}
    for (const idxStr in base[id]) {
      const idx = Number(idxStr)
      const kind = FUNCTION_KIND[channels[idx]?.function]
      if (!kind || s.recordMask[kind]) kept[idx] = base[id][idx] // unclassified functions stay
    }
    if (Object.keys(kept).length) out[id] = kept
  }
  return out
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
  const dur = pb.steps[next].fadeIn ?? s.playbackFade
  // Central Go only steps + cross-fades the LOOK over the fade time. It does NOT change any
  // level: the intensity keeps coming from whatever master is active (the manual fader, or a
  // fired level) — so the physical fader never moves when you press Go, like the real desk.
  const fromValues = stepValues(pb, s.now)
  const transition = dur > 0 ? { fromValues, start: s.now, dur } : undefined
  return { playbacks: s.playbacks.map((p) => (p.id === id ? { ...p, current: next, transition } : p)) }
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

      setupAudioDemo: () =>
        set((s) => {
          const fx = s.show.fixtures
          if (fx.length === 0) return s
          // A full-intensity look in one colour (dimmer + open shutter + RGB) across all fixtures.
          const look = (rgb: [number, number, number]): ProgrammerValues => {
            const values: ProgrammerValues = {}
            for (const pf of fx) {
              const channels = s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
              if (!channels) continue
              const v: Record<number, number> = {}
              channels.forEach((ch, i) => {
                if (ch.function === 'dimmer') v[i] = 255
                else if (ch.function === 'shutter') v[i] = 255
                else if (ch.function === 'red') v[i] = rgb[0]
                else if (ch.function === 'green') v[i] = rgb[1]
                else if (ch.function === 'blue') v[i] = rgb[2]
              })
              if (Object.keys(v).length) values[pf.id] = v
            }
            return values
          }
          const mk = (slot: number, name: string, rgb: [number, number, number]): Playback => {
            const pb = makePlayback(nextInstanceId(), slot, look(rgb), [])
            pb.name = name
            pb.steps[0].name = name
            return pb
          }
          const red = mk(0, 'Demo · Red (graves)', [255, 0, 0])
          const blue = mk(1, 'Demo · Blue (agudos)', [0, 40, 255])
          return {
            playbacks: [red, blue],
            connectedId: null,
            playbackLevels: {},
            firedLevels: {},
            fades: {},
            // Bass band (50 Hz) fires red, mid band (875 Hz) fires blue; snappy so each hit flashes.
            playbackFade: 0.15,
            audioEnabled: true,
            audioBands: s.audioBands.map((b, i) => ({
              ...b,
              enabled: i === 0 || i === 3,
              threshold: 0.28,
              cueSlot: i === 0 ? 0 : i === 3 ? 1 : null,
            })),
          }
        }),

      deskAttr: 'Intensity',
      setDeskAttr: (a) => set({ deskAttr: a }),
      extConnected: false,
      setExtConnected: (v) => set({ extConnected: v }),
      rightPanel: 'monitor',
      setRightPanel: (p) => set({ rightPanel: p }),
      deskScreen: 'fixtures',
      // Default mosaic: just the Fixtures workspace, full. The Visualiser is its own big pane
      // (bottom-right), not a mosaic window, so it can grow independently of the desk.
      deskWindows: [{ id: 'w-fx', screen: 'fixtures', pos: 'full' }],
      deskFocus: 'w-fx',
      // Setting "the desk screen" now means: point the FOCUSED window at that workspace.
      setDeskScreen: (screen) =>
        set((s) => {
          const focus = s.deskWindows.some((w) => w.id === s.deskFocus) ? s.deskFocus : s.deskWindows[0]?.id
          if (!focus) {
            const w: DeskWindow = { id: 'w-main', screen, pos: 'full' }
            return { deskWindows: [w], deskFocus: w.id, deskScreen: screen }
          }
          return { deskWindows: s.deskWindows.map((w) => (w.id === focus ? { ...w, screen } : w)), deskScreen: screen }
        }),
      // Cog picks a standard slot → drop any free rect so the standard position takes over.
      setWindowPos: (id, pos) => set((s) => ({ deskWindows: s.deskWindows.map((w) => (w.id === id ? { ...w, pos, rect: undefined } : w)) })),
      setWindowRect: (id, rect) => set((s) => ({ deskWindows: s.deskWindows.map((w) => (w.id === id ? { ...w, rect } : w)) })),
      // Send a window to the external monitor (or bring it back). Give it a fresh full-screen
      // rect on arrival so it doesn't inherit a cramped position; focus it.
      moveWindowMonitor: (id, monitor) =>
        set((s) => ({ deskWindows: tileInto(s.deskWindows, id, monitor), deskFocus: id })),
      focusWindow: (id) =>
        set((s) => {
          const w = s.deskWindows.find((x) => x.id === id)
          return w ? { deskFocus: id, deskScreen: w.screen } : {}
        }),
      addWindow: (screen) =>
        set((s) => {
          // ⊞ adds to the MAIN monitor. Count/tile only main windows (the external monitor's
          // windows are independent, so a full 2nd monitor never blocks adding on the 1st).
          const others = s.deskWindows.filter((w) => (w.monitor ?? 'main') !== 'main')
          let mains = s.deskWindows.filter((w) => (w.monitor ?? 'main') === 'main')
          if (mains.length >= 4) return {} // 2×2 grid is full on this monitor
          const taken = new Set(mains.map((w) => w.pos))
          // A lone full window shrinks to the top-left quarter so both are visible.
          if (mains.length === 1 && mains[0].pos === 'full') {
            mains = [{ ...mains[0], pos: 'tl' }]
            taken.clear()
            taken.add('tl')
          }
          const free = (['tl', 'tr', 'bl', 'br'] as WinPos[]).find((q) => !taken.has(q)) ?? 'br'
          const id = `w-${Date.now().toString(36)}-${mains.length}`
          const scr = screen ?? s.deskScreen ?? 'groups'
          return { deskWindows: [...others, ...mains, { id, screen: scr, pos: free, monitor: 'main' }], deskFocus: id, deskScreen: scr }
        }),
      closeWindow: (id) =>
        set((s) => {
          if (s.deskWindows.length <= 1) return {} // never close the last window
          const remaining = s.deskWindows.filter((w) => w.id !== id)
          // If only one window is left, let it fill the screen again.
          const windows = remaining.length === 1 ? [{ ...remaining[0], pos: 'full' as WinPos }] : remaining
          const focus = windows.some((w) => w.id === s.deskFocus) ? s.deskFocus : windows[0].id
          const fw = windows.find((w) => w.id === focus)!
          return { deskWindows: windows, deskFocus: focus, deskScreen: fw.screen }
        }),

      setMode: (mode) => set({ mode }),
      setConsole: (consoleId) => set({ consoleId }),

      recordCue: () =>
        set((s) => {
          // Plain Record → a NEW one-step playback on the first free slot.
          const slot = firstFreePlaybackSlot(s.playbacks)
          return { playbacks: [...s.playbacks, makePlayback(nextInstanceId(), slot, snapProgrammerMasked(s), snapEffects(s))] }
        }),

      recordArm: false,
      armRecord: () => set((s) => ({ recordArm: !s.recordArm })),
      recordCueAt: (index) =>
        set((s) => {
          const values = snapProgrammerMasked(s)
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
          const fl = { ...s.firedLevels }
          delete fl[id]
          const fades = { ...s.fades }
          delete fades[id]
          return {
            playbacks: s.playbacks.filter((p) => p.id !== id),
            connectedId: s.connectedId === id ? null : s.connectedId,
            playbackLevels: levels,
            firedLevels: fl,
            fades,
            flashIds: s.flashIds.filter((x) => x !== id),
            swopId: s.swopId === id ? null : s.swopId,
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
            const fl = { ...s.firedLevels }
            delete fl[playbackId]
            const fades = { ...s.fades }
            delete fades[playbackId]
            return {
              playbacks: s.playbacks.filter((p) => p.id !== playbackId),
              connectedId: s.connectedId === playbackId ? null : s.connectedId,
              playbackLevels: levels,
              firedLevels: fl,
              fades,
              flashIds: s.flashIds.filter((x) => x !== playbackId),
              swopId: s.swopId === playbackId ? null : s.swopId,
            }
          }
          const steps = kept.map((st, i) => ({ ...st, number: i + 1 }))
          const current = pb.current >= steps.length ? steps.length - 1 : pb.current
          return { playbacks: s.playbacks.map((p) => (p.id === playbackId ? { ...p, steps, current } : p)) }
        }),

      // Go on a handle fires the playback: connect it + bring up its first step over the fade
      // time. This lifts the FIRED level (not the manual fader) so the handle doesn't move.
      goCue: (id) =>
        set((s) => {
          const pb = s.playbacks.find((p) => p.id === id)
          if (!pb || pb.steps.length === 0) return s
          const playbacks = s.playbacks.map((p) => (p.id === id ? { ...p, current: 0, transition: undefined } : p))
          const from = resolveLevel(id, s.firedLevels, s.fades, s.now)
          if (s.playbackFade <= 0) {
            const fades = { ...s.fades }
            delete fades[id]
            return { connectedId: id, playbacks, firedLevels: { ...s.firedLevels, [id]: 255 }, fades }
          }
          return { connectedId: id, playbacks, fades: { ...s.fades, [id]: { from, to: 255, start: s.now, dur: s.playbackFade } } }
        }),

      // Central Go — advance the CONNECTED playback to its next step (wraps at the end).
      go: () => set((s) => stepConnected(s, +1)),
      goBack: () => set((s) => stepConnected(s, -1)),
      stopPlayback: () => get().releaseCue(),
      connectArm: false,
      armConnect: () => set((s) => ({ connectArm: !s.connectArm })),
      connectPlayback: (id) => set({ connectedId: id, connectArm: false }),

      setPlaybackMode: (id, mode) =>
        set((s) => ({ playbacks: s.playbacks.map((p) => (p.id === id ? { ...p, mode, bpm: p.bpm ?? 120 } : p)) })),
      setPlaybackBpm: (id, bpm) =>
        set((s) => ({ playbacks: s.playbacks.map((p) => (p.id === id ? { ...p, bpm: Math.max(20, Math.min(600, Math.round(bpm))) } : p)) })),

      advanceChases: () =>
        set((s) => {
          let changed = false
          const playbacks = s.playbacks.map((p) => {
            if (p.mode !== 'chase' || p.steps.length < 2) return p
            const up = Math.max(s.playbackLevels[p.id] ?? 0, resolveLevel(p.id, s.firedLevels, s.fades, s.now))
            if (up <= 0) return p
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

      // Kill / Release fade the FIRED level back out (the manual fader is left where it is —
      // it's physical, the desk can't move it).
      killPlayback: (id) =>
        set((s) => {
          const from = resolveLevel(id, s.firedLevels, s.fades, s.now)
          if (s.playbackFade <= 0) {
            const fl = { ...s.firedLevels }
            delete fl[id]
            const fades = { ...s.fades }
            delete fades[id]
            return { firedLevels: fl, fades }
          }
          return { fades: { ...s.fades, [id]: { from, to: 0, start: s.now, dur: s.playbackFade } } }
        }),
      releaseCue: () =>
        set((s) => {
          if (!s.connectedId) return s
          const id = s.connectedId
          const from = resolveLevel(id, s.firedLevels, s.fades, s.now)
          if (s.playbackFade <= 0) {
            const fl = { ...s.firedLevels }
            delete fl[id]
            const fades = { ...s.fades }
            delete fades[id]
            return { connectedId: null, firedLevels: fl, fades }
          }
          return { connectedId: null, fades: { ...s.fades, [id]: { from, to: 0, start: s.now, dur: s.playbackFade } } }
        }),
      renameCue: (id, name) =>
        set((s) => ({ playbacks: s.playbacks.map((p) => (p.id === id ? { ...p, name } : p)) })),
      playbackLevels: {},
      firedLevels: {},
      flashIds: [],
      swopId: null,
      flash: (id) => set((s) => ({ flashIds: s.flashIds.includes(id) ? s.flashIds.filter((x) => x !== id) : [...s.flashIds, id] })),
      swop: (id) => set((s) => ({ swopId: s.swopId === id ? null : id })),
      setFlash: (id, on) => set((s) => ({ flashIds: on ? (s.flashIds.includes(id) ? s.flashIds : [...s.flashIds, id]) : s.flashIds.filter((x) => x !== id) })),
      setSwop: (id, on) => set((s) => ({ swopId: on ? id : s.swopId === id ? null : s.swopId })),
      // The faders are manual and NON-motorised: dragging is the only thing that moves a
      // handle. Raising from 0 connects the playback + brings up its first step (like pushing
      // the fader up on the real desk). Never animated by Go/fire. Touching the fader also
      // GRABS the playback: it clears any fired level (from Go / a Sound-to-Light trigger),
      // so the fader is the real master and pulling it to 0 turns the playback OFF.
      setPlaybackLevel: (id, value) =>
        set((s) => {
          const v = Math.max(0, Math.min(255, value))
          const prev = s.playbackLevels[id] ?? 0
          const firedLevels = { ...s.firedLevels }
          delete firedLevels[id]
          const fades = { ...s.fades }
          delete fades[id]
          if (prev <= 0 && v > 0) {
            const playbacks = s.playbacks.map((p) => (p.id === id && p.current < 0 ? { ...p, current: 0 } : p))
            return { playbackLevels: { ...s.playbackLevels, [id]: v }, firedLevels, fades, playbacks, connectedId: id }
          }
          return { playbackLevels: { ...s.playbackLevels, [id]: v }, firedLevels, fades }
        }),
      fades: {},
      playbackFade: 3,
      setPlaybackFade: (seconds) => set({ playbackFade: Math.max(0, Math.min(60, seconds)) }),
      settleFades: () =>
        set((s) => {
          const ids = Object.keys(s.fades)
          if (ids.length === 0) return s
          const fades = { ...s.fades }
          const fl = { ...s.firedLevels }
          let changed = false
          for (const id of ids) {
            const f = s.fades[id]
            if (s.now >= f.start + f.dur) {
              if (f.to <= 0) delete fl[id]
              else fl[id] = f.to
              delete fades[id]
              changed = true
            }
          }
          return changed ? { fades, firedLevels: fl } : s
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
          const pb = makePlayback(nextInstanceId(), -1, snapProgrammerMasked(s), snapEffects(s))
          pb.executor = true // lives on the executor button, not a fader slot
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
        const universe = opts?.universe ?? 1
        const quantity = Math.max(1, Math.min(96, opts?.quantity ?? 1))
        const offset = Math.max(0, opts?.offset ?? 0)
        let address = opts?.address ?? get().findFreeAddress(footprint, universe)
        if (address == null) return // universe full
        const existing = [...get().show.fixtures]
        const acc: PatchedFixture[] = []
        let count = existing.filter((f) => f.definitionId === definitionId).length
        // Spread new fixtures along the default truss so they don't stack on one spot — the
        // student then drags them where the real rig has them. Continues past what's already
        // on that truss; wraps every 10 across the width (x ∈ [-0.9, 0.9]).
        const truss = opts?.truss ?? DEFAULT_TRUSS
        let slot = existing.filter((f) => (f.truss ?? DEFAULT_TRUSS) === truss).length
        for (let i = 0; i < quantity; i++) {
          if (address + footprint - 1 > 512) break // no room left in this universe
          count += 1
          acc.push({
            id: nextInstanceId(),
            definitionId,
            modeIndex,
            name: `${def.model} ${count}`,
            userNumber: nextUserNumber([...existing, ...acc]),
            universe,
            address,
            truss,
            position: { x: -0.9 + 0.2 * (slot % 10), y: 0.6, z: 0 },
          })
          slot += 1
          address += footprint + offset // auto-increment past this fixture (+ gap)
        }
        if (acc.length) set((s) => ({ show: { ...s.show, fixtures: [...s.show.fixtures, ...acc] } }))
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

      setFixtureAim: (instanceId, pan, tilt) =>
        set((s) => ({
          show: {
            ...s.show,
            fixtures: s.show.fixtures.map((f) => (f.id === instanceId ? { ...f, aim: { pan, tilt } } : f)),
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

      fanMode: false,
      toggleFanMode: () => set((s) => ({ fanMode: !s.fanMode })),
      fanAdjust: (fn, delta) =>
        set((s) => {
          const order = s.show.fixtures.map((f) => f.id)
          const ids = s.selection.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b))
          if (ids.length < 2) return s
          const n = ids.length
          const programmer = { ...s.programmer }
          ids.forEach((id, idx) => {
            const pf = s.show.fixtures.find((f) => f.id === id)
            const channels = pf && s.definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
            if (!channels) return
            // Line curve: centre value maps to 0, ends to ∓1 (first goes down, last up).
            const centered = (idx - (n - 1) / 2) / ((n - 1) / 2)
            channels.forEach((ch, i) => {
              if (ch.function !== fn) return
              const cur = programmer[id]?.[i] ?? ch.defaultValue ?? 128
              const v = Math.max(0, Math.min(255, Math.round(cur + centered * delta)))
              programmer[id] = { ...programmer[id], [i]: v }
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
      viewLightsExt: false,
      setViewLightsExt: (v) => set({ viewLightsExt: v }),
      legendArm: false,
      setLegendArm: (v) => set({ legendArm: v }),
      fixtureLabel: 'user',
      setFixtureLabel: (v) => set({ fixtureLabel: v }),
      recordMask: { intensity: true, position: true, colour: true, gobo: true, beam: true },
      toggleRecordMask: (kind) => set((s) => ({ recordMask: { ...s.recordMask, [kind]: !s.recordMask[kind] } })),
      clearRecordMask: () => set({ recordMask: { intensity: true, position: true, colour: true, gobo: true, beam: true } }),

      viewer: '3d',
      setViewer: (v) => set({ viewer: v }),
      viewerExt: '3d',
      setViewerExt: (v) => set({ viewerExt: v }),
      viewerVisible: true,
      setViewerVisible: (v) => set({ viewerVisible: v }),
      viewerLocation: 'dock',
      // Move the visualiser to the external monitor (a 'visualiser' tile there) or back to the
      // dock pane on the main screen. Keeps a single 'w-viz-ext' window for the ext tile.
      setViewerLocation: (loc) =>
        set((s) => {
          const without = s.deskWindows.filter((w) => w.id !== 'w-viz-ext')
          if (loc === 'ext') {
            const win: DeskWindow = { id: 'w-viz-ext', screen: 'visualiser', pos: 'full', monitor: 'ext' }
            // Seed the ext monitor's visualiser from the dock's current look so it doesn't jump;
            // from here on the two are independent.
            return {
              viewerLocation: 'ext', deskWindows: tileInto([...without, win], 'w-viz-ext', 'ext'), deskFocus: 'w-viz-ext',
              viewerExt: s.viewer, viewLightsExt: s.viewLights,
            }
          }
          return { viewerLocation: 'dock', deskWindows: without }
        }),
      fold: { screen: false, fixtures: false, monitor: false },
      setFold: (key, val) => set((s) => (s.fold[key] === val ? {} : { fold: { ...s.fold, [key]: val } })),
      // Saved Workspaces (Open/View → Record Workspace). Empty by default — the student
      // records their own named layouts, exactly like the real desk (no invented presets).
      workspaces: [],
      workspaceRecordArm: false,
      armWorkspaceRecord: () => set((s) => ({ workspaceRecordArm: !s.workspaceRecordArm })),
      recordWorkspace: (name) =>
        set((s) => {
          const snap: DeskWorkspace = {
            id: `ws-${s.workspaces.length + 1}-${name.toLowerCase().replace(/\s+/g, '-').slice(0, 12)}`,
            name: name.trim() || `View ${s.workspaces.length + 1}`,
            windows: s.deskWindows.map((w) => ({ ...w })),
            viewer: s.viewer,
            fold: { ...s.fold },
          }
          return { workspaces: [...s.workspaces, snap], workspaceRecordArm: false }
        }),
      recallWorkspace: (id) =>
        set((s) => {
          const ws = s.workspaces.find((w) => w.id === id)
          if (!ws) return {}
          // Back-compat: an old View saved before mosaic stored a single `screen`.
          const legacy = (ws as unknown as { screen?: string }).screen
          const windows = (ws.windows && ws.windows.length ? ws.windows : [{ id: 'w-main', screen: legacy ?? 'fixtures', pos: 'full' as WinPos }]).map((w) => ({ ...w }))
          const focus = windows[0]?.id ?? 'w-main'
          return { deskWindows: windows, deskFocus: focus, deskScreen: windows[0]?.screen ?? 'fixtures', viewer: ws.viewer, fold: { ...ws.fold } }
        }),
      deleteWorkspace: (id) => set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) })),

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
      highlight: false,
      toggleHighlight: () => set((s) => ({ highlight: !s.highlight })),

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
          // Resolve by Titan user number (falls back to list position for older shows).
          const byNum = new Map<number, string>()
          fixtures.forEach((f, i) => byNum.set(f.userNumber ?? i + 1, f.id))
          const ids = [...nums].map((n) => byNum.get(n)).filter((id): id is string => !!id)
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
          firedLevels: {},
          fades: {},
          flashIds: [],
          swopId: null,
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
          firedLevels: {},
          fades: {},
          flashIds: [],
          swopId: null,
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
          firedLevels: {},
          fades: {},
          flashIds: [],
          swopId: null,
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
          firedLevels: {},
          fades: {},
          flashIds: [],
          swopId: null,
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
        workspaces: s.workspaces,
        viewer: s.viewer,
        viewerExt: s.viewerExt,
        fixtureLabel: s.fixtureLabel,
        viewerVisible: s.viewerVisible,
        viewerLocation: s.viewerLocation,
        deskWindows: s.deskWindows,
        deskFocus: s.deskFocus,
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
  const firedLevels = useShowStore((s) => s.firedLevels)
  const fades = useShowStore((s) => s.fades)
  const flashIds = useShowStore((s) => s.flashIds)
  const swopId = useShowStore((s) => s.swopId)
  const effects = useShowStore((s) => s.effects)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const now = useShowStore((s) => s.now)
  const blind = useShowStore((s) => s.blind)
  const highlight = useShowStore((s) => s.highlight)
  const selection = useShowStore((s) => s.selection)
  return useMemo(() => {
    // Each playback contributes its live step (id = playback id) to the merge, interpolated
    // while a Go cross-fade is in progress. Its master = HTP(manual fader, fired level),
    // plus any momentary Flash/Swop.
    const cues = liveCues(playbacks, now)
    const levels = effectivePlaybackLevels(playbackLevels, firedLevels, fades, now, flashIds, swopId)
    const base = computePlaybackBase(cues, levels, show, definitions)
    const merged = respectBlind && blind ? base : mergeProgrammer(base, programmer)
    // Blind holds the whole programmer from the real output — its live shapes too, not
    // just the static values. Playback (cue) shapes still run.
    const liveEffects = respectBlind && blind ? [] : effects
    const active = activeEffects(cues, levels, {}, now, liveEffects)
    const out = applyEffects(merged, active, show, definitions, now)
    // HiLight overlay lifts the selected fixtures' intensity in the output only (never the
    // programmer). It's a live stage aid, so it shows even through Blind.
    return highlight ? applyHighlight(out, selection, show, definitions) : out
  }, [programmer, playbacks, playbackLevels, firedLevels, fades, flashIds, swopId, effects, show, definitions, now, blind, highlight, selection, respectBlind])
}
