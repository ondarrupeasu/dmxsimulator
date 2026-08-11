/**
 * GDTF import — the inverse of gdtf.ts. Parses a GDTF `description.xml` into a
 * DMXSimulatoR FixtureDefinition: canonical GDTF attribute names map back to our
 * channel functions, and a 16-bit channel (Offset="n,n+1") is split back into a
 * coarse + fine pair. Category is inferred from the attributes present.
 */
import type { FixtureDefinition, ChannelDefinition, ChannelFunction, FixtureCategory } from './types'

/** GDTF attribute name → our channel function (covers the names we emit + common aliases). */
const REV: Record<string, ChannelFunction> = {
  Dimmer: 'dimmer',
  Pan: 'pan', Tilt: 'tilt',
  ColorAdd_R: 'red', ColorAdd_G: 'green', ColorAdd_B: 'blue', ColorAdd_W: 'white',
  ColorAdd_RY: 'amber', ColorAdd_A: 'amber', ColorAdd_UV: 'uv',
  ColorRGB_Red: 'red', ColorRGB_Green: 'green', ColorRGB_Blue: 'blue',
  Red: 'red', Green: 'green', Blue: 'blue', White: 'white', Amber: 'amber',
  CTO: 'colorTemp', CTB: 'colorTemp', CTC: 'colorTemp', ColorMacro: 'colorWheel',
  Color1: 'colorWheel', Color2: 'colorWheel', Color1WheelSpin: 'colorWheel',
  Gobo1: 'gobo', Gobo2: 'gobo', Gobo1Pos: 'goboRotation', Gobo1PosRotate: 'goboRotation', Gobo1WheelSpin: 'goboRotation',
  Prism1: 'prism', Prism1Pos: 'prism', Prism1PosRotate: 'goboRotation',
  Zoom: 'zoom', Focus1: 'focus', Iris: 'iris', Frost1: 'iris',
  Shutter1: 'shutter', Shutter1Strobe: 'strobe', Shutter1StrobeRandom: 'strobe',
  StrobeRate: 'strobe', StrobeDuration: 'strobe',
  Haze: 'haze', Fog: 'haze',
  NoFeature: 'control',
}
const fnFromAttr = (a: string | null): ChannelFunction => (a && REV[a]) || 'control'

/** A GDTF DMXValue like "128/1" or "65535/2" → an 8-bit 0..255 value. */
function dmxValue(s: string | null): number | undefined {
  if (!s || s === 'None') return undefined
  const [v, bytes] = s.split('/')
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Number(bytes) >= 2 ? Math.round(n / 257) : n // 16-bit → 8-bit
}

function guessCategory(channels: ChannelDefinition[]): FixtureCategory {
  const fns = new Set(channels.map((c) => c.function))
  if (fns.has('pan') || fns.has('tilt')) return 'movingHead'
  if (fns.has('haze')) return 'hazer'
  if (['red', 'green', 'blue', 'white', 'amber', 'uv'].some((f) => fns.has(f as ChannelFunction))) return 'par'
  if (fns.has('strobe') && !fns.has('dimmer')) return 'strobe'
  if (fns.has('dimmer') && channels.length <= 2) return 'dimmer'
  return 'other'
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function parseGdtfDescription(xml: string): FixtureDefinition {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid GDTF XML')
  const ft = doc.querySelector('FixtureType')
  if (!ft) throw new Error('No FixtureType in GDTF')
  const manufacturer = ft.getAttribute('Manufacturer') || 'Imported'
  const model = ft.getAttribute('Name') || ft.getAttribute('LongName') || 'GDTF Fixture'

  const modes = [...doc.querySelectorAll('DMXModes > DMXMode')].map((m) => {
    const slots: (ChannelDefinition | undefined)[] = []
    let maxOff = 0
    for (const dc of m.querySelectorAll('DMXChannels > DMXChannel')) {
      const offs = (dc.getAttribute('Offset') || '')
        .split(',').map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n))
      if (!offs.length) continue // virtual channel — no DMX footprint
      const cf = dc.querySelector('LogicalChannel > ChannelFunction') || dc.querySelector('ChannelFunction')
      const attr = dc.querySelector('LogicalChannel')?.getAttribute('Attribute') || cf?.getAttribute('Attribute') || null
      const fn = fnFromAttr(attr)
      const name = cf?.getAttribute('Name') || attr || `Ch ${offs[0]}`
      const def = dmxValue(dc.getAttribute('Default')) ?? 0
      const hl = dmxValue(dc.getAttribute('Highlight'))
      slots[offs[0] - 1] = { name, function: fn, defaultValue: def, ...(hl != null ? { highlightValue: hl } : {}) }
      if (offs.length > 1) {
        const fineFn: ChannelFunction = fn === 'pan' ? 'panFine' : fn === 'tilt' ? 'tiltFine' : 'control'
        slots[offs[1] - 1] = { name: `${name} Fine`, function: fineFn, defaultValue: 0, fine: true }
      }
      maxOff = Math.max(maxOff, ...offs)
    }
    const channels: ChannelDefinition[] = []
    for (let i = 0; i < maxOff; i++) channels.push(slots[i] ?? { name: `Channel ${i + 1}`, function: 'generic', defaultValue: 0 })
    return { name: m.getAttribute('Name') || 'Mode', channels }
  }).filter((m) => m.channels.length > 0)

  if (!modes.length) throw new Error('GDTF has no usable DMX modes')
  return {
    id: `gdtf-${slug(manufacturer)}-${slug(model)}`,
    manufacturer,
    model,
    category: guessCategory(modes[0].channels),
    source: 'gdtf',
    modes,
  }
}

/** Parse a .gdtf file (a ZIP with description.xml at its root) into a definition. */
export async function importGdtfFile(data: ArrayBuffer): Promise<FixtureDefinition> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data)
  const entry = zip.file('description.xml') || zip.file(/description\.xml$/i)[0]
  if (!entry) throw new Error('No description.xml in GDTF')
  return parseGdtfDescription(await entry.async('string'))
}
