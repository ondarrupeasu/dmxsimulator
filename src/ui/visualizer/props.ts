import * as THREE from 'three'
import type { PropKind } from '../../model/types'

// Shared materials for the scenery props (cheap, reused across every instance).
const skin = new THREE.MeshStandardMaterial({ color: 0xc98d63, roughness: 0.7, metalness: 0.05 })
const cloth = new THREE.MeshStandardMaterial({ color: 0x3d4b74, roughness: 0.85, metalness: 0.05 })
const cloth2 = new THREE.MeshStandardMaterial({ color: 0x6c3b3b, roughness: 0.85, metalness: 0.05 })
const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.7, metalness: 0.1 })
const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.6, metalness: 0.3 })
const metal = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.5, metalness: 0.6 })
const grille = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.9, metalness: 0.2 })
const fabric = new THREE.MeshStandardMaterial({ color: 0x55506a, roughness: 0.9, metalness: 0.04 })

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  return m
}
function cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 14): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
  m.position.set(x, y, z)
  return m
}
/** A rounded capsule (radius + straight length) — the building block of the person figure. */
function cap(r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat)
  m.position.set(x, y, z)
  return m
}
function sphere(r: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat)
  m.position.set(x, y, z)
  return m
}

/** A standing person (~1.8 m), feet at the group origin. Rounded (capsule) body with shoes,
 *  legs, hips, a flattened torso, shoulders, angled arms with hands, a neck and a head-shaped
 *  head. Faces +Z. */
function person(shirt: THREE.Material = cloth): THREE.Group {
  const g = new THREE.Group()
  for (const x of [-0.1, 0.1]) {
    g.add(box(0.13, 0.07, 0.27, dark, x, 0.035, 0.05)) // shoe
    g.add(cap(0.08, 0.5, dark, x, 0.42, 0)) // leg
  }
  const hips = cap(0.17, 0.07, shirt, 0, 0.82, 0); hips.scale.set(1, 1, 0.75); g.add(hips)
  const torso = cap(0.19, 0.34, shirt, 0, 1.13, 0); torso.scale.set(1, 1, 0.7); g.add(torso) // flattened front-back
  const shoulders = cap(0.085, 0.26, shirt, 0, 1.35, 0); shoulders.rotation.z = Math.PI / 2; shoulders.scale.set(1, 1, 0.8); g.add(shoulders)
  for (const s of [-1, 1]) {
    const arm = cap(0.052, 0.4, shirt, s * 0.27, 1.13, 0); arm.rotation.z = s * 0.14; g.add(arm)
    g.add(sphere(0.052, skin, s * 0.31, 0.87, 0)) // hand
  }
  g.add(cyl(0.05, 0.062, 0.12, skin, 0, 1.5, 0, 12)) // neck
  // Head shaped like a real head, not a ball: narrower at the sides, a touch taller and deeper,
  // so a face photo sits on the front and barely distorts at the sides.
  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD.r, 28, 22), skin)
  head.position.y = HEAD.y
  head.scale.set(HEAD.sx, HEAD.sy, HEAD.sz)
  head.userData.isHead = true // a face photo, when set, is placed on the front of this head
  g.add(head)
  return g
}

/** Prop kinds that are people — the ones a face photo can be applied to. */
export const PERSON_KINDS: PropKind[] = ['person', 'singer', 'guitarist']
export const isPersonKind = (k: PropKind): boolean => PERSON_KINDS.includes(k)
/** Head geometry, shared by all person kinds: centre height, base radius and the ellipsoid scale
 *  that makes it head-shaped (narrower sides). frontZ = how far forward the face surface sits. */
export const HEAD = { y: 1.63, r: 0.125, sx: 0.84, sy: 1.14, sz: 1.02, get frontZ() { return this.r * this.sz } }
/** Back-compat: local Y of a person's head. */
export const HEAD_Y = HEAD.y

/** A boom mic stand (~1.5 m): weighted base, pole, boom arm, mic capsule. */
function micStand(): THREE.Group {
  const g = new THREE.Group()
  g.add(cyl(0.16, 0.18, 0.03, dark, 0, 0.015, 0)) // base
  g.add(cyl(0.02, 0.02, 1.45, metal, 0, 0.72, 0)) // pole
  const boom = cyl(0.015, 0.015, 0.5, metal, 0, 1.4, 0.18); boom.rotation.x = Math.PI / 2.6; g.add(boom)
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), dark).translateZ(0.34).translateY(1.5)) // mic
  return g
}

/** Build a scenery prop group (feet/base at the origin, +Z faces downstage). */
export function buildProp(kind: PropKind): THREE.Group {
  const g = new THREE.Group()
  switch (kind) {
    case 'person':
      g.add(person(cloth))
      break
    case 'singer': {
      g.add(person(cloth2))
      // Stand in front of the singer with the mic facing back toward them (not the audience).
      const s = micStand(); s.position.set(0, 0, 0.34); s.rotation.y = Math.PI; g.add(s)
      break
    }
    case 'micStand':
      g.add(micStand())
      break
    case 'guitarist': {
      g.add(person(cloth))
      // Guitar body + neck slung across the front.
      const guitar = new THREE.Group()
      guitar.add(box(0.28, 0.34, 0.06, wood, 0, 0, 0)) // body
      guitar.add(box(0.05, 0.7, 0.04, dark, 0.28, 0.28, 0)) // neck
      guitar.position.set(0.08, 1.0, 0.2); guitar.rotation.z = -0.5; g.add(guitar)
      break
    }
    case 'drumKit': {
      g.add(cyl(0.33, 0.33, 0.4, dark, 0, 0.2, 0.15, 20)) // bass drum (upright-ish)
      g.add(cyl(0.16, 0.16, 0.16, cloth, -0.18, 0.62, 0.1)) // tom L
      g.add(cyl(0.16, 0.16, 0.16, cloth, 0.18, 0.62, 0.1)) // tom R
      g.add(cyl(0.19, 0.19, 0.16, dark, -0.42, 0.52, 0.28)) // snare
      // Cymbals on stands.
      for (const [x, z, hy] of [[-0.6, 0.1, 1.1], [0.55, 0.1, 1.2]] as const) {
        g.add(cyl(0.01, 0.01, hy, metal, x, hy / 2, z))
        const cym = cyl(0.24, 0.24, 0.012, metal, x, hy, z, 20); g.add(cym)
      }
      g.add(cyl(0.18, 0.2, 0.06, dark, 0.15, 0.5, 0.7)) // stool
      g.add(cyl(0.03, 0.03, 0.5, metal, 0.15, 0.25, 0.7))
      break
    }
    case 'keyboard': {
      // X-stand + 88-key slab at playing height.
      const l1 = box(0.05, 0.95, 0.05, metal, 0, 0.48, 0); l1.rotation.z = 0.5; g.add(l1)
      const l2 = box(0.05, 0.95, 0.05, metal, 0, 0.48, 0); l2.rotation.z = -0.5; g.add(l2)
      g.add(box(1.25, 0.1, 0.32, dark, 0, 0.92, 0)) // keybed
      g.add(box(1.18, 0.03, 0.14, fabric, 0, 0.99, 0.06)) // keys strip
      break
    }
    case 'amp': {
      g.add(box(0.62, 0.5, 0.32, dark, 0, 0.25, 0)) // cabinet
      g.add(box(0.5, 0.38, 0.02, grille, 0, 0.25, 0.17)) // grille front
      break
    }
    case 'speaker': {
      g.add(box(0.5, 1.05, 0.42, dark, 0, 0.525, 0)) // PA cabinet
      g.add(box(0.4, 0.9, 0.02, grille, 0, 0.55, 0.22)) // grille
      break
    }
    case 'sofa': {
      g.add(box(1.8, 0.4, 0.85, fabric, 0, 0.2, 0)) // seat base
      g.add(box(1.8, 0.5, 0.18, fabric, 0, 0.55, -0.34)) // backrest
      g.add(box(0.18, 0.45, 0.85, fabric, -0.81, 0.42, 0)) // arm L
      g.add(box(0.18, 0.45, 0.85, fabric, 0.81, 0.42, 0)) // arm R
      break
    }
    case 'chair': {
      g.add(box(0.44, 0.08, 0.44, wood, 0, 0.46, 0)) // seat
      g.add(box(0.44, 0.5, 0.06, wood, 0, 0.72, -0.19)) // back
      for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const)
        g.add(box(0.05, 0.46, 0.05, wood, x, 0.23, z)) // legs
      break
    }
    case 'table': {
      g.add(box(1.2, 0.06, 0.7, wood, 0, 0.74, 0)) // top
      for (const [x, z] of [[-0.54, -0.29], [0.54, -0.29], [-0.54, 0.29], [0.54, 0.29]] as const)
        g.add(box(0.06, 0.74, 0.06, wood, x, 0.37, z)) // legs
      break
    }
    case 'riser': {
      g.add(box(2.0, 0.3, 2.0, dark, 0, 0.15, 0)) // drum riser platform
      g.add(box(2.0, 0.04, 2.0, grille, 0, 0.31, 0)) // top surface
      break
    }
  }
  // Give every mesh its OWN material clone so the visualiser can tint each prop independently
  // when a beam lights it (shared materials would light every copy at once).
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); m.userData.propMesh = true }
  })
  return g
}

/** Ordered list of prop kinds for the library palette, with an emoji cue. */
export const PROP_LIBRARY: { kind: PropKind; emoji: string }[] = [
  { kind: 'person', emoji: '🧍' },
  { kind: 'singer', emoji: '🎤' },
  { kind: 'guitarist', emoji: '🎸' },
  { kind: 'drumKit', emoji: '🥁' },
  { kind: 'keyboard', emoji: '🎹' },
  { kind: 'micStand', emoji: '🎙' },
  { kind: 'amp', emoji: '🔊' },
  { kind: 'speaker', emoji: '📢' },
  { kind: 'sofa', emoji: '🛋' },
  { kind: 'chair', emoji: '🪑' },
  { kind: 'table', emoji: '🪵' },
  { kind: 'riser', emoji: '🟫' },
]
