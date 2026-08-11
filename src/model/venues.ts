/**
 * Built-in venue models — simple theatrical architecture (masking, walls, a
 * proscenium) built procedurally in Three.js and drawn around the existing stage.
 * They need no external file and persist with the show as just a preset id, so a
 * saved show / template keeps its venue. Custom glTF models load separately.
 */
import * as THREE from 'three'

export const VENUE_PRESETS: { id: string; name: string }[] = [
  { id: 'blackbox', name: 'Black box' },
  { id: 'proscenium', name: 'Proscenium' },
]

const matte = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 })

/** A black-box studio: back wall + two side walls + an overhead teaser around the stage. */
function blackBox(): THREE.Group {
  const g = new THREE.Group()
  const wall = matte(0x0e0e12)
  const back = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 0.4), wall)
  back.position.set(0, 4.5, -6.7)
  g.add(back)
  const side = new THREE.BoxGeometry(0.4, 9, 13)
  const left = new THREE.Mesh(side, wall)
  left.position.set(-10.6, 4.5, -1)
  g.add(left)
  const right = left.clone()
  right.position.x = 10.6
  g.add(right)
  const teaser = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 13), wall)
  teaser.position.set(0, 9, -1)
  g.add(teaser)
  return g
}

/** A proscenium theatre: coloured cyc wall + a front arch (towers + header) + black legs. */
function proscenium(): THREE.Group {
  const g = new THREE.Group()
  const frame = matte(0x15151b)
  const cyc = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 0.4), matte(0x1a2233))
  cyc.position.set(0, 4.5, -6.5)
  g.add(cyc)
  const tower = new THREE.BoxGeometry(2.4, 8.5, 2.4)
  const lt = new THREE.Mesh(tower, frame)
  lt.position.set(-9.2, 4.25, 4.4)
  g.add(lt)
  const rt = lt.clone()
  rt.position.x = 9.2
  g.add(rt)
  const header = new THREE.Mesh(new THREE.BoxGeometry(20.8, 2, 2.4), frame)
  header.position.set(0, 8.5, 4.4)
  g.add(header)
  const leg = new THREE.BoxGeometry(0.3, 8, 3)
  const ll = new THREE.Mesh(leg, frame)
  ll.position.set(-9.6, 4, 0.5)
  g.add(ll)
  const rl = ll.clone()
  rl.position.x = 9.6
  g.add(rl)
  return g
}

/** Build a venue preset group (already at scene scale), or null for an unknown id. */
export function buildVenue(id: string | undefined | null): THREE.Group | null {
  if (id === 'blackbox') return blackBox()
  if (id === 'proscenium') return proscenium()
  return null
}
