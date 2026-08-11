/**
 * glTF/GLB export — writes the rig + venue as a 3D model (GLB) that Capture,
 * Vectorworks, Blender, SketchUp, etc. can import. It's geometry only (no DMX
 * patch — the MVR export carries that); fixtures are simple coloured blocks on
 * their trusses, plus any built-in venue and the stage deck.
 */
import * as THREE from 'three'
import type { Show, FixtureDefinition, FixtureCategory } from './types'
import { getTrusses, trussById } from './venue'
import { buildVenue } from './venues'

const CAT_COLOR: Record<FixtureCategory, number> = {
  movingHead: 0xd0842a, par: 0x2a7fd0, dimmer: 0x888888,
  strobe: 0xb040c0, hazer: 0x2ba79a, other: 0x666666,
}

function boxFor(cat: FixtureCategory): THREE.BufferGeometry {
  if (cat === 'movingHead') return new THREE.BoxGeometry(0.4, 0.5, 0.4)
  if (cat === 'hazer') return new THREE.BoxGeometry(0.9, 0.44, 0.56)
  if (cat === 'dimmer') return new THREE.BoxGeometry(0.3, 0.3, 0.3)
  return new THREE.BoxGeometry(0.42, 0.42, 0.32)
}

function buildExportScene(show: Show, definitions: Record<string, FixtureDefinition>): THREE.Group {
  const g = new THREE.Group()
  const trusses = getTrusses(show)

  const trussMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.7 })
  for (const t of trusses) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(16, 0.15, 0.15), trussMat)
    bar.position.set(0, t.y + 0.55, t.z)
    bar.name = `Truss ${t.name}`
    g.add(bar)
  }

  for (const pf of show.fixtures) {
    const def = definitions[pf.definitionId]
    const cat = (def?.category ?? 'other') as FixtureCategory
    const mesh = new THREE.Mesh(boxFor(cat), new THREE.MeshStandardMaterial({ color: CAT_COLOR[cat] }))
    if (cat === 'hazer') {
      mesh.position.set(pf.position.x * 8, 1, -1)
    } else {
      const t = trussById(trusses, pf.truss)
      mesh.position.set(pf.position.x * 6, t.y, t.z)
    }
    mesh.name = pf.name
    g.add(mesh)
  }

  const venue = buildVenue(show.venuePreset)
  if (venue) g.add(venue)

  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(20, 1, 11),
    new THREE.MeshStandardMaterial({ color: 0x20202a, roughness: 0.9 }),
  )
  stage.position.set(0, 0.5, -1.5)
  stage.name = 'Stage'
  g.add(stage)
  return g
}

/** Build and download the rig + venue as a binary glTF (.glb). */
export async function exportGltf(
  show: Show,
  definitions: Record<string, FixtureDefinition>,
): Promise<void> {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
  const scene = buildExportScene(show, definitions)
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(scene, { binary: true })
  const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${show.name || 'rig'}.glb`
  a.click()
  URL.revokeObjectURL(url)
}
