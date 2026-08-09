/**
 * Open Fixture Library importer.
 *
 * Converts an OFL fixture JSON (https://open-fixture-library.org, the raw
 * per-fixture format) into our brand-neutral FixtureDefinition. OFL keeps the
 * manufacturer name out of the fixture file (it lives in manufacturers.json),
 * so it is passed in.
 *
 * This covers the common personality features we simulate today; capability
 * types we don't model yet fall back to `generic` rather than failing.
 */
import type {
  ChannelDefinition,
  ChannelFunction,
  FixtureCategory,
  FixtureDefinition,
  FixtureMode,
} from '../model/types'

interface OflCapability {
  dmxRange?: [number, number]
  type?: string
  color?: string
  comment?: string
}

interface OflChannel {
  defaultValue?: number | string
  fineChannelAliases?: string[]
  capability?: OflCapability
  capabilities?: OflCapability[]
}

interface OflFixture {
  name?: string
  categories?: string[]
  availableChannels?: Record<string, OflChannel>
  modes?: { name?: string; channels?: (string | null)[] }[]
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function mapCategory(categories: string[] = []): FixtureCategory {
  const c = categories.map((x) => x.toLowerCase())
  if (c.some((x) => x.includes('moving head'))) return 'movingHead'
  if (c.some((x) => x.includes('strobe'))) return 'strobe'
  if (c.some((x) => x.includes('hazer') || x.includes('smoke') || x.includes('fog')))
    return 'hazer'
  if (c.some((x) => x.includes('color changer') || x.includes('par') || x.includes('flood')))
    return 'par'
  if (c.some((x) => x.includes('dimmer'))) return 'dimmer'
  return 'other'
}

/** Map an OFL capability type (+ color) to our channel function. */
function mapFunction(cap: OflCapability | undefined): ChannelFunction {
  const type = cap?.type ?? ''
  switch (type) {
    case 'Intensity':
      return 'dimmer'
    case 'ColorIntensity':
      switch ((cap?.color ?? '').toLowerCase()) {
        case 'red':
          return 'red'
        case 'green':
          return 'green'
        case 'blue':
          return 'blue'
        case 'white':
          return 'white'
        case 'amber':
          return 'amber'
        case 'uv':
          return 'uv'
        default:
          return 'generic'
      }
    case 'ColorTemperature':
      return 'colorTemp'
    case 'Pan':
      return 'pan'
    case 'Tilt':
      return 'tilt'
    case 'ShutterStrobe':
      return 'shutter'
    case 'WheelSlot':
    case 'WheelRotation':
      return 'gobo'
    case 'ColorPreset':
    case 'ColorWheelIndex':
    case 'ColorWheelRotation':
      return 'colorWheel'
    case 'Zoom':
      return 'zoom'
    case 'Focus':
      return 'focus'
    case 'Iris':
      return 'iris'
    case 'Prism':
    case 'PrismRotation':
      return 'prism'
    case 'Maintenance':
    case 'NoFunction':
      return 'control'
    default:
      return 'generic'
  }
}

function capsOf(ch: OflChannel): OflCapability[] {
  if (ch.capabilities) return ch.capabilities
  if (ch.capability) return [ch.capability]
  return []
}

function toByte(v: number | string | undefined): number {
  if (typeof v === 'number') return Math.max(0, Math.min(255, v))
  return 0
}

function buildChannel(name: string, ch: OflChannel): ChannelDefinition {
  const caps = capsOf(ch)
  // Pick the function from the most descriptive capability.
  const fn = mapFunction(caps.find((c) => c.type && c.type !== 'NoFunction') ?? caps[0])
  const def: ChannelDefinition = {
    name,
    function: fn,
    defaultValue: toByte(ch.defaultValue),
  }
  if (fn === 'dimmer' || fn.length <= 5 /* red/green/blue/white/amber/uv/pan/tilt */)
    def.highlightValue = fn === 'pan' || fn === 'tilt' ? 128 : 255
  if (caps.length > 0) {
    def.capabilities = caps
      .filter((c) => c.dmxRange)
      .map((c) => ({
        rangeStart: c.dmxRange![0],
        rangeEnd: c.dmxRange![1],
        label: c.comment ?? c.type ?? '',
      }))
  }
  return def
}

/** Resolve a mode's channel list against availableChannels + fine aliases. */
function buildMode(
  mode: { name?: string; channels?: (string | null)[] },
  available: Record<string, OflChannel>,
): FixtureMode {
  // Index fine aliases → their coarse channel name.
  const fineToCoarse: Record<string, string> = {}
  for (const [coarseName, ch] of Object.entries(available)) {
    for (const alias of ch.fineChannelAliases ?? []) fineToCoarse[alias] = coarseName
  }

  const channels: ChannelDefinition[] = (mode.channels ?? []).map((chanName) => {
    if (chanName == null) {
      return { name: 'Unused', function: 'generic', defaultValue: 0 }
    }
    const coarse = available[chanName]
    if (coarse) return buildChannel(chanName, coarse)

    // A fine channel referenced in the mode.
    const coarseName = fineToCoarse[chanName]
    if (coarseName) {
      const parentFn = buildChannel(coarseName, available[coarseName]).function
      const fineFn: ChannelFunction =
        parentFn === 'pan' ? 'panFine' : parentFn === 'tilt' ? 'tiltFine' : 'generic'
      return { name: chanName, function: fineFn, defaultValue: 0, fine: true }
    }
    return { name: chanName, function: 'generic', defaultValue: 0 }
  })

  return { name: mode.name ?? 'Mode', channels }
}

export function fixtureFromOFL(json: OflFixture, manufacturer: string): FixtureDefinition {
  const model = json.name ?? 'Unknown'
  const available = json.availableChannels ?? {}
  const modes = (json.modes ?? []).map((m) => buildMode(m, available))
  return {
    id: `ofl-${slugify(manufacturer)}-${slugify(model)}`,
    manufacturer,
    model,
    category: mapCategory(json.categories),
    source: 'ofl',
    modes: modes.length > 0 ? modes : [{ name: 'Default', channels: [] }],
  }
}
