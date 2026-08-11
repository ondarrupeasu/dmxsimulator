/**
 * GDTF (General Device Type Format) export — turns a DMXSimulatoR fixture definition
 * into a GDTF `description.xml`, so the rig can be opened in Capture / Vectorworks /
 * grandMA etc. Channel functions map to the canonical GDTF attribute names; a coarse
 * channel immediately followed by a `fine` one is emitted as a single 16-bit channel.
 * Geometry is primitive (no external 3D model) — importers that match by channel count
 * (Capture) accept that. Spec: github.com/mvrdevelopment/spec.
 */
import type { FixtureDefinition, ChannelDefinition, ChannelFunction } from './types'

export const xmlEsc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

const san = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')

/** Deterministic RFC-4122-ish GUID from a string (stable across exports). */
function hash32(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
export function guidFrom(s: string): string {
  const hex = [0, 1, 2, 3].map((n) => hash32(`${s}|${n}`).toString(16).padStart(8, '0')).join('')
  const b = hex.toUpperCase().split('')
  b[12] = '4' // version 4
  b[16] = '89AB'[parseInt(hex[16], 16) % 4] // variant
  const j = b.join('')
  return `${j.slice(0, 8)}-${j.slice(8, 12)}-${j.slice(12, 16)}-${j.slice(16, 20)}-${j.slice(20, 32)}`
}

/** Canonical GDTF attribute + its FeatureGroup.Feature (+ ActivationGroup) per function. */
interface Attr { name: string; fg?: string; feat?: string; ag?: string; unit?: string }
const ATTR: Record<ChannelFunction, Attr> = {
  dimmer: { name: 'Dimmer', fg: 'Dimmer', feat: 'Dimmer', unit: 'LuminousIntensity' },
  pan: { name: 'Pan', fg: 'Position', feat: 'PanTilt', ag: 'PanTilt', unit: 'Angle' },
  tilt: { name: 'Tilt', fg: 'Position', feat: 'PanTilt', ag: 'PanTilt', unit: 'Angle' },
  panFine: { name: 'Pan', fg: 'Position', feat: 'PanTilt', ag: 'PanTilt', unit: 'Angle' },
  tiltFine: { name: 'Tilt', fg: 'Position', feat: 'PanTilt', ag: 'PanTilt', unit: 'Angle' },
  red: { name: 'ColorAdd_R', fg: 'Color', feat: 'RGB', ag: 'ColorRGB', unit: 'ColorComponent' },
  green: { name: 'ColorAdd_G', fg: 'Color', feat: 'RGB', ag: 'ColorRGB', unit: 'ColorComponent' },
  blue: { name: 'ColorAdd_B', fg: 'Color', feat: 'RGB', ag: 'ColorRGB', unit: 'ColorComponent' },
  white: { name: 'ColorAdd_W', fg: 'Color', feat: 'RGB', ag: 'ColorRGB', unit: 'ColorComponent' },
  amber: { name: 'ColorAdd_RY', fg: 'Color', feat: 'RGB', ag: 'ColorRGB', unit: 'ColorComponent' },
  uv: { name: 'ColorAdd_UV', fg: 'Color', feat: 'RGB', ag: 'ColorRGB', unit: 'ColorComponent' },
  colorTemp: { name: 'CTO', fg: 'Color', feat: 'Color', unit: 'Temperature' },
  colorWheel: { name: 'Color1', fg: 'Color', feat: 'Color' },
  gobo: { name: 'Gobo1', fg: 'Gobo', feat: 'Gobo', ag: 'Gobo1' },
  goboRotation: { name: 'Gobo1PosRotate', fg: 'Gobo', feat: 'Gobo' },
  prism: { name: 'Prism1', fg: 'Beam', feat: 'Beam' },
  zoom: { name: 'Zoom', fg: 'Focus', feat: 'Focus', unit: 'Angle' },
  focus: { name: 'Focus1', fg: 'Focus', feat: 'Focus' },
  iris: { name: 'Iris', fg: 'Beam', feat: 'Beam' },
  strobe: { name: 'Shutter1Strobe', fg: 'Beam', feat: 'Beam', unit: 'Frequency' },
  shutter: { name: 'Shutter1', fg: 'Beam', feat: 'Beam' },
  haze: { name: 'Haze', fg: 'Control', feat: 'Control' },
  control: { name: 'NoFeature' },
  generic: { name: 'NoFeature' },
}
const attrOf = (fn: ChannelFunction): Attr => ATTR[fn] ?? ATTR.generic

export const gdtfFileName = (def: FixtureDefinition) => `${san(def.manufacturer)}@${san(def.model)}.gdtf`

/** Walk a mode's channels into GDTF DMXChannels, folding coarse+fine into 16-bit. */
function modeChannels(channels: ChannelDefinition[]): string {
  const out: string[] = []
  let offset = 1
  let i = 0
  while (i < channels.length) {
    const ch = channels[i]
    const is16 = !!channels[i + 1]?.fine && !ch.fine
    const off = is16 ? `${offset},${offset + 1}` : `${offset}`
    const a = attrOf(ch.function)
    const def = `${ch.defaultValue ?? 0}/1`
    const hl = ch.highlightValue != null ? `${ch.highlightValue}/1` : 'None'
    out.push(
      `          <DMXChannel DMXBreak="1" Offset="${off}" Default="${def}" Highlight="${hl}" Geometry="Base">\n` +
      `            <LogicalChannel Attribute="${a.name}">\n` +
      `              <ChannelFunction Attribute="${a.name}" Name="${xmlEsc(ch.name)}" DMXFrom="0/1" Default="${def}"/>\n` +
      `            </LogicalChannel>\n` +
      `          </DMXChannel>`,
    )
    offset += is16 ? 2 : 1
    i += is16 ? 2 : 1
  }
  return out.join('\n')
}

export function buildGdtfDescription(def: FixtureDefinition): string {
  // Collect every attribute used across all modes (NoFeature needs no declaration).
  const attrs = new Map<string, Attr>()
  const ags = new Set<string>()
  const fgs = new Map<string, Set<string>>()
  for (const mode of def.modes) {
    for (const ch of mode.channels) {
      const a = attrOf(ch.function)
      if (a.name === 'NoFeature' || !a.fg) continue
      attrs.set(a.name, a)
      if (a.ag) ags.add(a.ag)
      if (!fgs.has(a.fg)) fgs.set(a.fg, new Set())
      fgs.get(a.fg)!.add(a.feat as string)
    }
  }
  const agXml = [...ags].map((g) => `        <ActivationGroup Name="${g}"/>`).join('\n')
  const fgXml = [...fgs.entries()]
    .map(([g, feats]) =>
      `        <FeatureGroup Name="${g}" Pretty="${g}">\n` +
      [...feats].map((f) => `          <Feature Name="${f}"/>`).join('\n') +
      `\n        </FeatureGroup>`,
    )
    .join('\n')
  const attrXml = [...attrs.values()]
    .map((a) =>
      `        <Attribute Name="${a.name}" Pretty="${a.name}"` +
      (a.ag ? ` ActivationGroup="${a.ag}"` : '') +
      ` Feature="${a.fg}.${a.feat}"` +
      (a.unit ? ` PhysicalUnit="${a.unit}"` : '') + `/>`,
    )
    .join('\n')

  const modesXml = def.modes
    .map((m) =>
      `      <DMXMode Name="${xmlEsc(m.name)}" Geometry="Base">\n` +
      `        <DMXChannels>\n${modeChannels(m.channels)}\n        </DMXChannels>\n` +
      `      </DMXMode>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<GDTF DataVersion="1.2">
  <FixtureType Name="${xmlEsc(def.model)}" ShortName="${xmlEsc(san(def.model)).slice(0, 20)}" LongName="${xmlEsc(def.manufacturer + ' ' + def.model)}" Manufacturer="${xmlEsc(def.manufacturer)}" Description="${xmlEsc(def.manufacturer + ' ' + def.model)}" FixtureTypeID="${guidFrom(def.id)}" RefFT="">
    <AttributeDefinitions>
      <ActivationGroups>
${agXml}
      </ActivationGroups>
      <FeatureGroups>
${fgXml}
      </FeatureGroups>
      <Attributes>
${attrXml}
      </Attributes>
    </AttributeDefinitions>
    <Wheels/>
    <PhysicalDescriptions>
      <Emitters/>
      <ColorSpace Name="Default" Mode="sRGB"/>
    </PhysicalDescriptions>
    <Models>
      <Model Name="Base" Length="0.3" Width="0.3" Height="0.3" PrimitiveType="Base"/>
      <Model Name="Beam" Length="0.2" Width="0.2" Height="0.2" PrimitiveType="Cylinder"/>
    </Models>
    <Geometries>
      <Geometry Name="Base" Model="Base" Position="{1,0,0,0}{0,1,0,0}{0,0,1,0}{0,0,0,1}">
        <Beam Name="Beam" Model="Beam" Position="{1,0,0,0}{0,1,0,0}{0,0,1,0}{0,0,0,1}" BeamType="Wash" BeamAngle="25.0" BeamRadius="0.1" LampType="LED" ColorRenderingIndex="80" ColorTemperature="6500" LuminousFlux="3000" PowerConsumption="150"/>
      </Geometry>
    </Geometries>
    <DMXModes>
${modesXml}
    </DMXModes>
  </FixtureType>
</GDTF>`
}
