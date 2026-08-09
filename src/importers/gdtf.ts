/**
 * GDTF importer (General Device Type Format, https://gdtf-share.com).
 *
 * A .gdtf file is a ZIP whose `description.xml` holds the personality (and,
 * optionally, 3D geometry we'll use for the visualizer later). This module
 * parses that XML into our neutral FixtureDefinition.
 *
 * Unzipping the container is a separate concern: when we wire the file picker
 * we'll unzip with `fflate` and hand the `description.xml` text to
 * `fixtureFromGDTFDescription`. Keeping the parser XML-in/definition-out makes
 * it testable without a zip library.
 */
import type {
  ChannelDefinition,
  ChannelFunction,
  FixtureCategory,
  FixtureDefinition,
  FixtureMode,
} from '../model/types'

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Map a GDTF attribute name to our channel function. */
function mapAttribute(attr: string): ChannelFunction {
  const a = attr.toLowerCase()
  if (a === 'dimmer') return 'dimmer'
  if (a.startsWith('coloradd_r') || a === 'colorrgb_red') return 'red'
  if (a.startsWith('coloradd_g') || a === 'colorrgb_green') return 'green'
  if (a.startsWith('coloradd_b') || a === 'colorrgb_blue') return 'blue'
  if (a.startsWith('coloradd_w') || a.startsWith('colorrgb_white')) return 'white'
  if (a.startsWith('coloradd_a') || a.startsWith('colorrgb_amber')) return 'amber'
  if (a.startsWith('coloradd_uv')) return 'uv'
  if (a === 'pan') return 'pan'
  if (a === 'tilt') return 'tilt'
  if (a.startsWith('shutter')) return 'shutter'
  if (a.startsWith('zoom')) return 'zoom'
  if (a.startsWith('focus')) return 'focus'
  if (a.startsWith('iris')) return 'iris'
  if (a.startsWith('prism')) return 'prism'
  if (a.startsWith('gobo')) return 'gobo'
  if (a.startsWith('color')) return 'colorWheel'
  if (a === 'ctc' || a === 'cto' || a === 'ctb') return 'colorTemp'
  return 'generic'
}

function mapCategory(fn: ChannelFunction[]): FixtureCategory {
  if (fn.includes('pan') || fn.includes('tilt')) return 'movingHead'
  if (fn.includes('red') || fn.includes('green') || fn.includes('blue')) return 'par'
  if (fn.includes('shutter') && !fn.includes('dimmer')) return 'strobe'
  if (fn.includes('dimmer')) return 'dimmer'
  return 'other'
}

function highlightFor(fn: ChannelFunction): number | undefined {
  if (fn === 'pan' || fn === 'tilt') return 128
  if (['dimmer', 'red', 'green', 'blue', 'white', 'amber', 'uv'].includes(fn)) return 255
  return undefined
}

/** Parse a GDTF Offset attribute ("1,2" | "1" | "None"/"") into byte offsets. */
function parseOffset(raw: string | null): number[] {
  if (!raw || raw.toLowerCase() === 'none') return []
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
}

function buildMode(modeEl: Element): FixtureMode {
  const name = modeEl.getAttribute('Name') ?? 'Mode'
  // Collect {byteOffset, channelDefinition}; a 16-bit channel yields two slots.
  const slots: { offset: number; def: ChannelDefinition }[] = []

  for (const chan of Array.from(modeEl.querySelectorAll('DMXChannel'))) {
    const offsets = parseOffset(chan.getAttribute('Offset'))
    if (offsets.length === 0) continue // virtual channel, no DMX footprint
    // Attribute lives on the LogicalChannel (or first ChannelFunction).
    const logical = chan.querySelector('LogicalChannel')
    const attr =
      logical?.getAttribute('Attribute') ??
      chan.querySelector('ChannelFunction')?.getAttribute('Attribute') ??
      'Generic'
    const fn = mapAttribute(attr)

    slots.push({
      offset: offsets[0],
      def: { name: attr, function: fn, defaultValue: 0, highlightValue: highlightFor(fn) },
    })
    if (offsets[1]) {
      const fineFn: ChannelFunction =
        fn === 'pan' ? 'panFine' : fn === 'tilt' ? 'tiltFine' : 'generic'
      slots.push({
        offset: offsets[1],
        def: { name: `${attr} (fine)`, function: fineFn, defaultValue: 0, fine: true },
      })
    }
  }

  slots.sort((a, b) => a.offset - b.offset)
  return { name, channels: slots.map((s) => s.def) }
}

export function fixtureFromGDTFDescription(xml: string): FixtureDefinition {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid GDTF description.xml')
  }
  const ft = doc.querySelector('FixtureType')
  const manufacturer = ft?.getAttribute('Manufacturer') ?? 'Unknown'
  const model = ft?.getAttribute('Name') ?? ft?.getAttribute('LongName') ?? 'Unknown'

  const modeEls = Array.from(doc.querySelectorAll('DMXModes > DMXMode'))
  const modes = modeEls.map(buildMode)
  const allFns = modes.flatMap((m) => m.channels.map((c) => c.function))

  return {
    id: `gdtf-${slugify(manufacturer)}-${slugify(model)}`,
    manufacturer,
    model,
    category: mapCategory(allFns),
    source: 'gdtf',
    modes: modes.length > 0 ? modes : [{ name: 'Default', channels: [] }],
  }
}
