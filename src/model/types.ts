/**
 * Core DMX domain model.
 *
 * The whole app is built around a brand-neutral fixture model. Fixtures from the
 * built-in library, from Open Fixture Library, and from GDTF are all normalized
 * into `FixtureDefinition` so the rest of the app never cares where a fixture
 * came from. See src/importers/.
 */

/** Semantic role of a DMX channel, used by the UI and the 2D/3D visualizer. */
export type ChannelFunction =
  | 'dimmer'
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'amber'
  | 'uv'
  | 'colorTemp'
  | 'pan'
  | 'tilt'
  | 'panFine'
  | 'tiltFine'
  | 'colorWheel'
  | 'gobo'
  | 'goboRotation'
  | 'prism'
  | 'zoom'
  | 'focus'
  | 'iris'
  | 'strobe'
  | 'shutter'
  | 'control'
  | 'haze'
  | 'generic'

/** A labelled DMX value range within a channel (e.g. "Gobo 1", "Strobe slow→fast"). */
export interface ChannelCapability {
  /** 0–255 inclusive. */
  rangeStart: number
  /** 0–255 inclusive. */
  rangeEnd: number
  label: string
}

/** One channel slot in a fixture mode. Order in a mode = its DMX footprint. */
export interface ChannelDefinition {
  name: string
  function: ChannelFunction
  /** 0–255, applied when a fixture is patched and nothing is programmed. */
  defaultValue: number
  /** 0–255 value used by Locate/Highlight (e.g. dimmer full, pan/tilt centre). */
  highlightValue?: number
  /** True for the fine (LSB) half of a 16-bit pair. */
  fine?: boolean
  capabilities?: ChannelCapability[]
}

export type FixtureCategory =
  | 'dimmer'
  | 'par'
  | 'movingHead'
  | 'strobe'
  | 'hazer'
  | 'other'

/** A named channel layout for a fixture (fixtures often have several). */
export interface FixtureMode {
  name: string
  channels: ChannelDefinition[]
}

/** Where a normalized fixture definition originated. */
export type FixtureSource = 'builtin' | 'ofl' | 'gdtf'

/** A brand-neutral fixture personality. */
export interface FixtureDefinition {
  /** Stable slug, unique across the library, e.g. "generic-rgbw-par". */
  id: string
  manufacturer: string
  model: string
  category: FixtureCategory
  source: FixtureSource
  modes: FixtureMode[]
}

/** A fixture placed into a universe at an address — one instance in the show. */
export interface PatchedFixture {
  /** Instance id (unique within the show). */
  id: string
  /** References FixtureDefinition.id. */
  definitionId: string
  /** Index into the definition's modes[]. */
  modeIndex: number
  /** User-facing label, e.g. "PAR 1". */
  name: string
  /** 1-based universe number. */
  universe: number
  /** 1-based start channel (1–512). */
  address: number
  /** Normalized stage position for the visualizer, each axis roughly -1..1. */
  position: { x: number; y: number; z: number }
  /** Which truss the fixture hangs on (index into venue TRUSSES). Defaults to the
   *  middle stage truss when absent (older shows). */
  truss?: number
  /** Floor-standing (e.g. a hazer on the stage deck) instead of hung on a truss. */
  floor?: boolean
}

/** A truss in the rig — a hanging bar at a depth (z) and height (y). */
export interface TrussDef {
  id: number
  name: string
  z: number // world Z (positive = toward the audience/downstage)
  y: number // hang height in metres
  foh?: boolean // front-of-house: hangs over the audience, aims at the stage
}

export interface Show {
  name: string
  /** Venue / room name — shown on the plot title block. */
  venue?: string
  /** Lighting designer / drawn-by — shown on the plot title block. */
  designer?: string
  /** Number of universes (v1 typically 1). */
  universeCount: number
  fixtures: PatchedFixture[]
  /** The rig's trusses. Optional — when absent the default venue set is used. */
  trusses?: TrussDef[]
}

/** DMX footprint (channel count) of a patched fixture's active mode. */
export function fixtureFootprint(def: FixtureDefinition, modeIndex: number): number {
  return def.modes[modeIndex]?.channels.length ?? 0
}
