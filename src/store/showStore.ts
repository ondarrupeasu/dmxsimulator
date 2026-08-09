/**
 * Global show state: the patch, the programmer, and the fixture library.
 * Persisted to localStorage so a student's work survives a reload.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FixtureDefinition, PatchedFixture, Show } from '../model/types'
import { fixtureFootprint } from '../model/types'
import { BUILTIN_FIXTURES } from '../model/library'
import type { ProgrammerValues } from '../engine/dmx'
import { UNIVERSE_SIZE } from '../engine/dmx'

export type AppMode = 'patch' | 'program' | 'run'

interface ShowState {
  show: Show
  /** All available definitions (built-in + imported), by id. */
  definitions: Record<string, FixtureDefinition>
  programmer: ProgrammerValues
  mode: AppMode
  /** Instance ids currently selected in the programmer. */
  selection: string[]

  setMode: (mode: AppMode) => void

  // Patch
  addFixture: (definitionId: string, opts?: { modeIndex?: number; address?: number }) => void
  removeFixture: (instanceId: string) => void
  renameFixture: (instanceId: string, name: string) => void
  setFixturePosition: (instanceId: string, x: number, y: number) => void
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

  // Library
  addDefinitions: (defs: FixtureDefinition[]) => void

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
      selection: [],

      setMode: (mode) => set({ mode }),

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

      addDefinitions: (defs) =>
        set((s) => ({ definitions: { ...s.definitions, ...defsRecord(defs) } })),

      resetShow: () =>
        set((s) => ({
          show: makeDemoShow(s.definitions),
          programmer: {},
          selection: [],
        })),
    }),
    {
      name: 'dmxsimulator-show',
      // Persist the work, not transient UI state.
      partialize: (s) => ({ show: s.show, programmer: s.programmer }),
    },
  ),
)
