/**
 * MVR import — reads a `.mvr` (My Virtual Rig) back into a DMXSimulatoR show:
 * each fixture's bundled GDTF becomes a definition (via gdtf-import), and its
 * address, mode and position matrix become a patched fixture. Positions come back
 * from the MVR millimetre Z-up matrices; distinct hang points become trusses.
 */
import type { Show, FixtureDefinition, PatchedFixture, TrussDef } from './types'
import { parseGdtfDescription } from './gdtf-import'

/** Pull the translation (4th vector) from an MVR matrix "{...}{...}{...}{x,y,z}". */
function translation(matrix: string | null | undefined): [number, number, number] {
  if (!matrix) return [0, 0, 0]
  const groups = [...matrix.matchAll(/\{([^}]*)\}/g)].map((m) => m[1])
  const last = groups[groups.length - 1]
  if (!last) return [0, 0, 0]
  const [x, y, z] = last.split(',').map((n) => parseFloat(n) || 0)
  return [x ?? 0, y ?? 0, z ?? 0]
}

export interface MvrImportResult {
  show: Show
  definitions: FixtureDefinition[]
}

export async function importMvrFile(data: ArrayBuffer): Promise<MvrImportResult> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data)
  const sceneFile = zip.file('GeneralSceneDescription.xml') || zip.file(/GeneralSceneDescription\.xml$/i)[0]
  if (!sceneFile) throw new Error('No GeneralSceneDescription.xml in MVR')
  const doc = new DOMParser().parseFromString(await sceneFile.async('string'), 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid MVR scene XML')

  // Parse each referenced GDTF once, keyed by its filename (GDTFSpec).
  const defBySpec = new Map<string, FixtureDefinition>()
  const defs: FixtureDefinition[] = []
  const getDef = async (spec: string): Promise<FixtureDefinition | null> => {
    if (defBySpec.has(spec)) return defBySpec.get(spec)!
    const gf = zip.file(spec) || zip.file(new RegExp(`${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))[0]
    if (!gf) return null
    try {
      const inner = await JSZip.loadAsync(await gf.async('uint8array'))
      const desc = inner.file('description.xml') || inner.file(/description\.xml$/i)[0]
      if (!desc) return null
      const def = parseGdtfDescription(await desc.async('string'))
      defBySpec.set(spec, def)
      defs.push(def)
      return def
    } catch {
      return null
    }
  }

  // Distinct hang points (depth, height) → trusses.
  const trussByKey = new Map<string, TrussDef>()
  const trussFor = (depth: number, height: number): number => {
    const z = Math.round(depth * 2) / 2
    const y = Math.round(height * 2) / 2
    const key = `${z}|${y}`
    let t = trussByKey.get(key)
    if (!t) {
      t = { id: trussByKey.size, name: `Truss ${trussByKey.size + 1}`, z, y }
      trussByKey.set(key, t)
    }
    return t.id
  }

  const fixtures: PatchedFixture[] = []
  let n = 0
  for (const fx of doc.querySelectorAll('Fixture')) {
    const spec = fx.querySelector('GDTFSpec')?.textContent?.trim() || ''
    const def = await getDef(spec)
    if (!def) continue
    const modeName = fx.querySelector('GDTFMode')?.textContent?.trim() || ''
    const modeIndex = Math.max(0, def.modes.findIndex((m) => m.name === modeName))
    const addrRaw = fx.querySelector('Addresses > Address')?.textContent?.trim() || '1'
    const [uni, chan] = addrRaw.includes('.') ? addrRaw.split('.') : ['1', addrRaw]
    const [mx, my, mz] = translation(fx.querySelector('Matrix')?.textContent)
    const truss = trussFor(my / 1000, mz / 1000)
    fixtures.push({
      id: `mvr-${n++}`,
      definitionId: def.id,
      modeIndex,
      name: fx.getAttribute('name') || `Fixture ${n}`,
      universe: Math.max(1, parseInt(uni, 10) || 1),
      address: Math.max(1, parseInt(chan, 10) || 1),
      position: { x: Math.max(-1, Math.min(1, mx / 5000)), y: 0.6, z: 0 },
      truss,
    })
  }

  if (!fixtures.length) throw new Error('MVR has no importable fixtures')
  const layerName = doc.querySelector('Layer')?.getAttribute('name') || 'Imported rig'
  const trusses = [...trussByKey.values()].sort((a, b) => b.z - a.z)
  const maxUni = fixtures.reduce((m, f) => Math.max(m, f.universe), 1)
  return {
    show: { name: layerName, universeCount: maxUni, fixtures, trusses },
    definitions: defs,
  }
}
