import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { buildVenue } from '../../model/venues'
import { useShowStore } from '../../store/showStore'
import { computeFixtureOutputs, mergeProgrammer, computePlaybackBase, effectivePlaybackLevels, applyHighlight } from '../../engine/dmx'
import { applyEffects, activeEffects } from '../../engine/effects'
import { liveCues } from '../../model/cue'
import { computeVisualState } from '../../engine/render'
import { FIXTURE_GOBOS } from '../../model/gobos'
import { buildProp, isPersonKind, HEAD_Y } from './props'
import type { TrussDef, FixtureDefinition, BodyType, FixtureGeometry } from '../../model/types'
import { getTrusses, trussById, STAGE_TOP } from '../../model/venue'

/** World position for a fixture: x normalized (-1..1) along its assigned truss. */
function place(x: number, truss: number | undefined, trusses: TrussDef[]): THREE.Vector3 {
  const t = trussById(trusses, truss)
  return new THREE.Vector3(x * 6, t.y, t.z)
}

interface FxObj {
  group: THREE.Group
  panPart: THREE.Object3D // yoke — rotates around Y (pan)
  tiltPart: THREE.Object3D // head — rotates around X (tilt); the beam lives here
  body: THREE.Mesh // lamp barrel (carries the lit-colour tint)
  edges: THREE.LineSegments
  hit: THREE.Mesh
  halo: THREE.Sprite
  label?: THREE.Sprite // floating name tag, shown under work lights
  beam: THREE.Mesh
  beamMat: THREE.MeshBasicMaterial
  pool: THREE.Mesh
  poolMat: THREE.MeshBasicMaterial
  /** Extra cone-width factor from the fixture's real beam/field angle (1 = the default cone). */
  beamSpread?: number
}

// Reused temporaries for the per-frame beam-direction maths (no allocation).
const _qy = new THREE.Quaternion()
const _qx = new THREE.Quaternion()
const _q = new THREE.Quaternion()
const _X = new THREE.Vector3(1, 0, 0)
const _Y = new THREE.Vector3(0, 1, 0)

/** A floating text tag (name) that hangs under a fixture when work lights are on. */
function makeLabelSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const font = 'bold 40px system-ui, sans-serif'
  ctx.font = font
  c.width = Math.ceil(ctx.measureText(text).width) + 36
  c.height = 60
  ctx.font = font
  ctx.fillStyle = 'rgba(10,10,14,0.82)'
  ctx.beginPath()
  ctx.roundRect(2, 2, c.width - 4, c.height - 4, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, c.width / 2, c.height / 2 + 2)
  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  const h = 0.4
  sprite.scale.set(h * (c.width / c.height), h, 1)
  sprite.position.set(0, -0.8, 0)
  sprite.renderOrder = 10
  return sprite
}

/** Soft radial-gradient texture for the selection halo (created once). */
let _haloTex: THREE.CanvasTexture | null = null
function haloTexture(): THREE.CanvasTexture {
  if (_haloTex) return _haloTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  _haloTex = new THREE.CanvasTexture(c)
  return _haloTex
}

/** Cone beam of unit length (apex at origin, base at y=-1) that fades to black
 *  toward the base via vertex colours — reads as a light beam, not a solid. */
function makeBeamGeometry(): THREE.ConeGeometry {
  const geo = new THREE.ConeGeometry(0.13, 1, 24, 1, true)
  geo.translate(0, -0.5, 0)
  const pos = geo.attributes.position
  const colors: number[] = []
  for (let i = 0; i < pos.count; i++) {
    const c = 1 + pos.getY(i) // y=0 (apex) → 1, y=-1 (base) → 0
    colors.push(c, c, c)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

/** Soft round blob texture for the drifting haze puffs (created once). */
let _hazeTex: THREE.CanvasTexture | null = null
function hazeTexture(): THREE.CanvasTexture {
  if (_hazeTex) return _hazeTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  _hazeTex = new THREE.CanvasTexture(c)
  return _hazeTex
}

/** A haze/smoke machine on the stage floor (box + output nozzle + status LED). */
function buildHazer(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.44, 0.56),
    new THREE.MeshStandardMaterial({ color: 0x44454e, metalness: 0.55, roughness: 0.45, emissive: 0x0c0c10 }),
  )
  body.position.y = 0.22
  g.add(body)
  g.userData.box = body // raycast target for click-selection
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry, 20), new THREE.LineBasicMaterial({ color: 0x8a8b95 })).translateY(0.22))
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.12, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: 0x15151a, metalness: 0.6, roughness: 0.4 }),
  )
  nozzle.rotation.z = Math.PI / 2
  nozzle.position.set(0.52, 0.26, 0)
  g.add(nozzle)
  // Red selection LED (hidden until the hazer is selected) — like the other fixtures.
  const sel = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: 0xff2a2a, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }))
  sel.scale.setScalar(0.32)
  sel.position.set(0, 0.6, 0)
  sel.renderOrder = 6
  sel.visible = false
  g.add(sel)
  g.userData.selLed = sel
  return g
}

/** A cylinder between two points — the building block of the truss lattice. */
function tube(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length() || 0.001
  const geo = new THREE.CylinderGeometry(r, r, len, 6, 1)
  const q = new THREE.Quaternion().setFromUnitVectors(_Y, dir.normalize())
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)))
  return geo
}

const trussMat = new THREE.MeshStandardMaterial({ color: 0x9c9ca4, metalness: 0.75, roughness: 0.35 })

/** A box-truss (4 chords + zig-zag bracing), merged to a single mesh. */
function buildTruss(length: number): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = []
  const s = 0.2 // half cross-section
  const x0 = -length / 2
  const x1 = length / 2
  const corners: [number, number][] = [
    [s, s],
    [s, -s],
    [-s, s],
    [-s, -s],
  ]
  for (const [y, z] of corners) geos.push(tube(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z), 0.045))
  const n = Math.max(1, Math.round(length / 0.7))
  const step = length / n
  const faces: [[number, number], [number, number]][] = [
    [[s, s], [s, -s]],
    [[-s, s], [-s, -s]],
    [[s, s], [-s, s]],
    [[s, -s], [-s, -s]],
  ]
  for (const [c1, c2] of faces) {
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * step
      const xb = xa + step
      geos.push(tube(new THREE.Vector3(xa, c1[0], c1[1]), new THREE.Vector3(xa, c2[0], c2[1]), 0.026))
      const d1 = i % 2 === 0 ? c1 : c2
      const d2 = i % 2 === 0 ? c2 : c1
      geos.push(tube(new THREE.Vector3(xa, d1[0], d1[1]), new THREE.Vector3(xb, d2[0], d2[1]), 0.026))
    }
  }
  return new THREE.Mesh(mergeGeometries(geos, false), trussMat)
}

const metalMat = new THREE.MeshStandardMaterial({ color: 0x2b2b31, metalness: 0.6, roughness: 0.5 })

/** Gobo pattern textures used as the pool's alphaMap (white = light passes, black = blocked),
 *  so a spot with a gobo throws a shaped pattern on the floor instead of a plain disc. Slot 0
 *  is "open" (no texture). A handful of generic patterns — not a fixture's real gobo wheel. */
function makeGoboTextures(): THREE.CanvasTexture[] {
  const draws: ((c: CanvasRenderingContext2D) => void)[] = [
    (c) => { for (let i = 0; i < 55; i++) { c.beginPath(); c.arc(Math.random() * 128, Math.random() * 128, 5 + Math.random() * 13, 0, 7); c.fill() } }, // breakup dots
    (c) => { c.translate(64, 64); for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.fillRect(-3.5, 6, 7, 60) } }, // spokes
    (c) => { c.translate(64, 64); c.lineWidth = 6; for (let r = 12; r < 62; r += 15) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke() } }, // rings
    (c) => { for (let i = 0; i < 9; i++) { c.save(); c.translate(Math.random() * 128, Math.random() * 128); c.rotate(Math.random() * 7); c.beginPath(); c.moveTo(0, -16); c.lineTo(13, 13); c.lineTo(-13, 13); c.closePath(); c.fill(); c.restore() } }, // leaves
  ]
  return draws.map((draw) => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#fff'
    draw(ctx)
    const tex = new THREE.CanvasTexture(cv)
    tex.center.set(0.5, 0.5)
    return tex
  })
}
const GOBO_TEX = makeGoboTextures()
// Prism variant of each gobo: the same pattern tiled 2×2, so a prism + gobo reads as several
// copies of the gobo on the floor (the beam split) rather than one — cheap multi-image cue.
const GOBO_TEX_PRISM = GOBO_TEX.map((t) => {
  const c = t.clone()
  c.wrapS = c.wrapT = THREE.RepeatWrapping
  c.repeat.set(2, 2)
  c.needsUpdate = true
  return c
})

/** Prism split pattern: a bright core + 3 satellites (a 3-facet prism throws the beam into
 *  several). Dropped onto the floor pool while the prism is engaged, like a real prism split. */
const PRISM_TEX = (() => {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#fff'
  ctx.translate(64, 64)
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill() // core beam
  for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate((i * 2 * Math.PI) / 3); ctx.beginPath(); ctx.arc(0, -34, 13, 0, 7); ctx.fill(); ctx.restore() } // 3 facets
  const tex = new THREE.CanvasTexture(cv)
  tex.center.set(0.5, 0.5)
  return tex
})()

// Per-definition gobo set: a fixture's REAL gobo-wheel images (from its GDTF, see model/gobos.ts)
// when available, else the generic patterns above. Loaded lazily the first time such a fixture is
// drawn and cached; the images are tiny separate assets so nothing loads until needed. The prism
// variant tiles each gobo 2×2 (a prism + gobo reads as several copies of the pattern).
const _goboLoader = new THREE.TextureLoader()
const _goboSets = new Map<string, { tex: THREE.Texture[]; prism: THREE.Texture[] }>()
function goboSetFor(defId: string): { tex: THREE.Texture[]; prism: THREE.Texture[] } {
  const cached = _goboSets.get(defId)
  if (cached) return cached
  const urls = FIXTURE_GOBOS[defId]
  let set: { tex: THREE.Texture[]; prism: THREE.Texture[] }
  if (urls && urls.length) {
    const tex = urls.map((u) => { const t = _goboLoader.load(u); t.center.set(0.5, 0.5); return t })
    // Separate load for the tiled variant (a texture can't hold two repeat settings at once).
    const prism = urls.map((u) => {
      const t = _goboLoader.load(u)
      t.center.set(0.5, 0.5); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2)
      return t
    })
    set = { tex, prism }
  } else {
    set = { tex: GOBO_TEX, prism: GOBO_TEX_PRISM }
  }
  _goboSets.set(defId, set)
  return set
}

/** A fixture model. Moving heads get a base + panning yoke + tilting head; other
 *  kinds get a static can on a yoke. Either way the beam lives in the tilt part. */
/** Pick the 3D archetype for a fixture: explicit `body`, else inferred from category + model. */
function bodyOf(def: FixtureDefinition): BodyType {
  if (def.body) return def.body
  const m = `${def.manufacturer} ${def.model}`.toLowerCase()
  if (def.category === 'hazer') return 'hazer'
  if (def.category === 'movingHead') {
    if (/wash|flex|aura|cob/.test(m)) return 'washHead'
    if (/beam/.test(m)) return 'beamHead'
    return 'spotHead'
  }
  if (def.category === 'strobe') return 'strobe'
  if (def.category === 'dimmer') return /blinder|lite/.test(m) ? 'blinder' : 'parCan'
  if (def.category === 'par') {
    if (/batten|pixel bar|bar\b/.test(m)) return 'batten'
    if (/par ?-?64/.test(m)) return 'parCan'
    return 'parLed'
  }
  if (/fresnel/.test(m)) return 'fresnel'
  if (/profile|ellips|leko|source ?four/.test(m)) return 'profile'
  return 'parLed'
}

function buildFixture(bodyType: BodyType): FxObj {
  const group = new THREE.Group()
  const panPart = new THREE.Group()
  const tiltPart = new THREE.Group()

  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x16161c, metalness: 0.5, roughness: 0.5 })
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0b0b10, metalness: 0.35, roughness: 0.25 })
  let body: THREE.Mesh
  let beamY: number
  let haloY: number
  const moving = bodyType === 'spotHead' || bodyType === 'washHead' || bodyType === 'beamHead'

  if (moving) {
    // Clamp + base on the truss; the yoke pans, the head tilts.
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), metalMat); clamp.position.y = 0.44; group.add(clamp)
    const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.14, 18), metalMat); baseCyl.position.y = 0.3; group.add(baseCyl)
    panPart.position.y = 0.23; group.add(panPart)
    const armGeo = new THREE.BoxGeometry(0.06, 0.5, 0.14)
    const armL = new THREE.Mesh(armGeo, metalMat); armL.position.set(-0.26, -0.2, 0)
    const armR = new THREE.Mesh(armGeo, metalMat); armR.position.set(0.26, -0.2, 0)
    panPart.add(armL, armR)
    tiltPart.position.y = -0.34; panPart.add(tiltPart)

    if (bodyType === 'washHead') {
      // Wash: short, wide head with a big flat round front (COB / lens array).
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.24, 24), barrelMat); body.position.y = -0.06; tiltPart.add(body)
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.03, 24), lensMat); lens.position.y = -0.19; tiltPart.add(lens)
      beamY = -0.2; haloY = -0.06
    } else if (bodyType === 'beamHead') {
      // Beam: narrow, long barrel.
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 20), barrelMat); body.position.y = -0.17; tiltPart.add(body)
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 20), metalMat); lens.rotation.x = Math.PI / 2; lens.position.y = -0.42; tiltPart.add(lens)
      beamY = -0.42; haloY = -0.17
    } else {
      // Spot: medium barrel head (gobo / prism spot).
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.42, 20), barrelMat); body.position.y = -0.13; tiltPart.add(body)
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 20), metalMat); lens.rotation.x = Math.PI / 2; lens.position.y = -0.34; tiltPart.add(lens)
      beamY = -0.34; haloY = -0.13
    }
  } else {
    // Static lantern on a simple yoke bracket.
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), metalMat); clamp.position.y = 0.42; group.add(clamp)
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.03, 8, 20, Math.PI), metalMat); yoke.position.y = 0.05; group.add(yoke)
    group.add(panPart); panPart.add(tiltPart)

    if (bodyType === 'parCan') {
      // Classic PAR 64 can: long cylinder + front rim.
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.5, 22), barrelMat); body.position.y = -0.18; tiltPart.add(body)
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 22), metalMat); rim.rotation.x = Math.PI / 2; rim.position.y = -0.43; tiltPart.add(rim)
      beamY = -0.43; haloY = -0.18
    } else if (bodyType === 'fresnel') {
      // Fresnel: square body + round stepped lens.
      body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.3), barrelMat); body.position.y = -0.19; tiltPart.add(body)
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24), lensMat); lens.position.y = -0.37; tiltPart.add(lens)
      beamY = -0.38; haloY = -0.19
    } else if (bodyType === 'profile') {
      // Profile / ellipsoidal: body + lens tube out the front.
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.44, 18), barrelMat); body.position.y = -0.2; tiltPart.add(body)
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.2, 18), metalMat); tube.position.y = -0.5; tiltPart.add(tube)
      beamY = -0.58; haloY = -0.2
    } else if (bodyType === 'batten') {
      // LED batten: a long horizontal bar of cells.
      body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.12), barrelMat); body.position.y = -0.06; tiltPart.add(body)
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.02), lensMat); face.position.set(0, -0.11, 0); tiltPart.add(face)
      beamY = -0.12; haloY = -0.06
    } else if (bodyType === 'blinder') {
      // Blinder: a bar carrying two round lamps facing down.
      body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.18), barrelMat); body.position.y = -0.06; tiltPart.add(body)
      for (const lx of [-0.16, 0.16]) {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.1, 20), lensMat); lamp.position.set(lx, -0.15, 0); tiltPart.add(lamp)
      }
      beamY = -0.2; haloY = -0.06
    } else if (bodyType === 'strobe') {
      // Strobe: a flat wide panel facing down.
      body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.3), barrelMat); body.position.y = -0.1; tiltPart.add(body)
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.26), lensMat); panel.position.y = -0.18; tiltPart.add(panel)
      beamY = -0.19; haloY = -0.1
    } else {
      // parLed (and default): compact LED PAR — short round body + LED face.
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 20), barrelMat); body.position.y = -0.08; tiltPart.add(body)
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 20), lensMat); face.position.y = -0.17; tiltPart.add(face)
      beamY = -0.17; haloY = -0.08
    }
  }

  return finishFx(group, panPart, tiltPart, body, beamY, haloY)
}

/** Adds the shared bits every fixture needs (body edges, beam cone, floor pool, pick proxy,
 *  selection halo) and returns the assembled FxObj. Shared by the archetype builder and the
 *  GDTF-geometry builder. */
function finishFx(
  group: THREE.Group, panPart: THREE.Object3D, tiltPart: THREE.Object3D,
  body: THREE.Mesh, beamY: number, haloY: number, beamSpread?: number,
): FxObj {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry, 25),
    new THREE.LineBasicMaterial({ color: 0x7f7f8c }),
  )
  body.add(edges)

  // Beam — apex at the lens, pointing down the tilt part's local −Y.
  const beamMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const beam = new THREE.Mesh(makeBeamGeometry(), beamMat)
  beam.position.y = beamY
  tiltPart.add(beam)

  // Floor pool (in the scene, not the head, so it stays flat on the floor).
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), poolMat)
  pool.rotation.x = -Math.PI / 2

  // Invisible, generous pick proxy so clicks select the fixture, not the big beam.
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10), new THREE.MeshBasicMaterial({ visible: false }))
  group.add(hit)

  // Selection indicator — a small, bright LED-like dot on the fixture (like a status
  // light lit up), not a big halo. Additive blending makes it glow.
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture(),
      color: 0xff2a2a,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  )
  halo.renderOrder = 6
  halo.scale.setScalar(0.3)
  halo.position.y = haloY // sit on the lamp body
  halo.visible = false
  group.add(halo)

  return { group, panPart, tiltPart, body, edges, hit, halo, beam, beamMat, pool, poolMat, beamSpread }
}

/** The default beam cone's tangent (radius 0.13 at unit length) — real field angles scale off it. */
const BEAM_BASE_TAN = 0.13

/** Builds a fixture to its REAL proportions from GDTF-extracted geometry (part sizes in metres +
 *  beam field angle). Moving heads get an accurate base/yoke/head with pan+tilt articulation; the
 *  beam cone opens to the real field angle. Falls back inside the caller to buildFixture() when a
 *  definition has no geometry. */
function buildFromGeometry(g: FixtureGeometry): FxObj {
  const group = new THREE.Group()
  const panPart = new THREE.Group()
  const tiltPart = new THREE.Group()
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x16161c, metalness: 0.5, roughness: 0.5 })
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x0b0b10, metalness: 0.35, roughness: 0.25 })

  // Field angle → extra cone spread (relative to the default ~15° cone). Clamped so a very tight
  // beam is still visible and a very wide wash doesn't blow up.
  const beamSpread = g.fieldAngle
    ? Math.max(0.2, Math.min(4, Math.tan(THREE.MathUtils.degToRad(g.fieldAngle / 2)) / BEAM_BASE_TAN))
    : undefined

  let body: THREE.Mesh
  let beamY: number
  let haloY: number

  if (g.kind === 'head') {
    const base = g.base ?? { w: 0.18, h: 0.1, l: 0.28 }
    const yoke = g.yoke ?? { w: 0.08, h: 0.24, l: 0.26 }
    const head = g.head ?? { w: 0.18, h: 0.36, l: 0.2 }
    const headR = Math.max(head.w, head.l) / 2

    // Clamp + base plate on the truss (the base doesn't move).
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(base.w * 0.7, 0.1, base.l * 0.7), metalMat)
    clamp.position.y = 0.44; group.add(clamp)
    const baseBox = new THREE.Mesh(new THREE.BoxGeometry(base.w, base.h, base.l), metalMat)
    baseBox.position.y = 0.3; group.add(baseBox)

    // Yoke pans below the base; two arms hang down to the head pivot.
    panPart.position.y = 0.3 - base.h / 2; group.add(panPart)
    const armSep = headR + yoke.w * 0.5 + 0.01 // inner face of each arm just clears the head
    const armGeo = new THREE.BoxGeometry(yoke.w, yoke.h, Math.max(head.l * 0.8, 0.06))
    const armL = new THREE.Mesh(armGeo, metalMat); armL.position.set(-armSep, -yoke.h / 2, 0)
    const armR = new THREE.Mesh(armGeo, metalMat); armR.position.set(armSep, -yoke.h / 2, 0)
    panPart.add(armL, armR)

    // Head tilts about the arm ends; barrel centred on the pivot, points down −Y.
    tiltPart.position.y = -yoke.h; panPart.add(tiltPart)
    body = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.92, headR, head.h, 26), barrelMat)
    tiltPart.add(body)
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.95, headR * 0.95, 0.02, 26), lensMat)
    lens.position.y = -head.h / 2 + 0.01; tiltPart.add(lens)
    beamY = -head.h / 2; haloY = 0
  } else {
    // Static lantern: a body box on a simple U-yoke bracket, sized from head dims.
    const b = g.head ?? { w: 0.2, h: 0.24, l: 0.24 }
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), metalMat); clamp.position.y = 0.42; group.add(clamp)
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(Math.max(b.w, b.l) * 0.75, 0.03, 8, 20, Math.PI), metalMat)
    yoke.position.y = 0.05; group.add(yoke)
    group.add(panPart); panPart.add(tiltPart)
    body = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(b.w, b.l) / 2 * 0.9, Math.max(b.w, b.l) / 2, b.h, 24), barrelMat)
    body.position.y = -b.h / 2 + 0.02; tiltPart.add(body)
    const face = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(b.w, b.l) / 2 * 0.85, Math.max(b.w, b.l) / 2 * 0.85, 0.02, 24), lensMat)
    face.position.y = -b.h + 0.03; tiltPart.add(face)
    beamY = -b.h + 0.02; haloY = -b.h / 2 + 0.02
  }

  return finishFx(group, panPart, tiltPart, body, beamY, haloY, beamSpread)
}

export function Visualizer3D({ ext = false }: { ext?: boolean } = {}) {
  const mountRef = useRef<HTMLDivElement>(null)
  // Which visualiser instance's room-lights to follow (dock vs external monitor). Kept in a ref
  // so the long-lived render loop always reads the current instance without re-mounting.
  const extRef = useRef(ext)
  extRef.current = ext

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x16161c)
    scene.fog = new THREE.FogExp2(0x16161c, 0.022)
    const BG_DARK = new THREE.Color(0x16161c)
    const BG_LIT = new THREE.Color(0x2c2d36)

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
    camera.position.set(0, 7.5, 17)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.5, 1.5)
    controls.enableDamping = true
    // Allow the camera to dip well below the horizon so you can get down near the floor and look
    // up at the rig; a per-frame floor clamp (below) keeps it from sliding under the stage.
    controls.maxPolarAngle = Math.PI * 0.85
    controls.minDistance = 2

    // "Focus selected" / "Home": when a nonce bumps, glide the camera + orbit target so the
    // selection fills the view (fit to its bounding box) or back to the full-stage overview.
    const HOME_TARGET = new THREE.Vector3(0, 1.5, 1.5)
    const HOME_CAM = new THREE.Vector3(0, 7.5, 17)
    // Preset views for the toolbar dropdown (camera position + orbit target). Heights are low so
    // you see the stage from a realistic eye level; 'stage' also hides the audience seats.
    const VIEWS: Record<string, { cam: THREE.Vector3; target: THREE.Vector3 }> = {
      home: { cam: HOME_CAM.clone(), target: HOME_TARGET.clone() },
      techPov: { cam: new THREE.Vector3(0, 2.4, 21), target: new THREE.Vector3(0, 3, -3) }, // FOH desk
      stage: { cam: new THREE.Vector3(0, 3, 10), target: new THREE.Vector3(0, 2.6, -3) }, // front, no seats
      sideLeft: { cam: new THREE.Vector3(-17, 3.5, -1), target: new THREE.Vector3(0, 3, -2) },
      sideRight: { cam: new THREE.Vector3(17, 3.5, -1), target: new THREE.Vector3(0, 3, -2) },
    }
    let seenFocusNonce = useShowStore.getState().focusNonce
    let seenHomeNonce = useShowStore.getState().homeNonce
    let seenViewNonce = useShowStore.getState().viewNonce
    let focusAnim: { fromT: THREE.Vector3; toT: THREE.Vector3; fromC: THREE.Vector3; toC: THREE.Vector3; t: number } | null = null

    scene.add(new THREE.AmbientLight(0x404050, 1.2))
    // Work/house lights — off by default (dark, beams-only look); toggled on to see
    // where every fixture sits, then off again to design the look.
    const workHemi = new THREE.HemisphereLight(0xcfe0f2, 0x2a2a33, 0)
    scene.add(workHemi)
    const workDir = new THREE.DirectionalLight(0xffffff, 0)
    workDir.position.set(6, 16, 10)
    scene.add(workDir)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.9, metalness: 0.1 }),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    // Lift the grid a hair above the floor so the two coplanar surfaces don't
    // z-fight (which shows as a shimmer even when the camera is still).
    const grid = new THREE.GridHelper(40, 40, 0x3c3c4a, 0x272730)
    grid.position.y = 0.02
    scene.add(grid)

    // Optional venue behind the rig: a built-in preset (buildVenue, already at scene
    // scale) or a loaded glTF/GLB (auto-fitted). Reconciled in the loop by a key; the
    // default stage/floor stay underneath.
    const venueGroup = new THREE.Group()
    scene.add(venueGroup)
    const gltfLoader = new GLTFLoader()
    let venueKey: string | null = null
    const reconcileVenue = (url: string | null, preset: string | undefined) => {
      const key = url ? `u:${url}` : preset ? `p:${preset}` : null
      if (key === venueKey) return
      venueKey = key
      venueGroup.clear()
      if (url) {
        gltfLoader.load(url, (gltf) => {
          if (venueKey !== `u:${url}`) return // superseded while loading
          const model = gltf.scene
          // Auto-fit: centre on X/Z, sit the base on the floor, scale to ~16 u wide.
          const box = new THREE.Box3().setFromObject(model)
          const size = new THREE.Vector3(); box.getSize(size)
          const centre = new THREE.Vector3(); box.getCenter(centre)
          const span = Math.max(size.x, size.z) || 1
          const scale = 16 / span
          model.scale.setScalar(scale)
          model.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale)
          venueGroup.add(model)
        }, undefined, () => {}) // load error → leave the default stage
      } else if (preset) {
        const v = buildVenue(preset)
        if (v) venueGroup.add(v)
      }
    }

    // ---- Venue: a 1 m-high stage (tarima) with the audience flat in front ----
    // Stage deck — top surface sits STAGE_TOP metres above the floor.
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(20, STAGE_TOP, 11),
      new THREE.MeshStandardMaterial({ color: 0x17171d, roughness: 0.95, metalness: 0.05 }),
    )
    stage.position.set(0, STAGE_TOP / 2, -1.5)
    scene.add(stage)
    // Back wall (upstage) — marks the back of the stage.
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 12),
      new THREE.MeshStandardMaterial({ color: 0x141319, roughness: 1, metalness: 0 }),
    )
    backWall.position.set(0, 6, -7)
    scene.add(backWall)
    // Bright nosing along the downstage edge, so the front of the stage is obvious.
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.06, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x6a6a74, metalness: 0.4, roughness: 0.6 }),
    )
    lip.position.set(0, STAGE_TOP + 0.02, 4)
    scene.add(lip)
    // Audience — flat rows of seats on the floor in front of the stage (no rake).
    const seatGeo = mergeGeometries([
      new THREE.BoxGeometry(0.5, 0.12, 0.5).translate(0, 0.22, 0),
      new THREE.BoxGeometry(0.5, 0.5, 0.09).translate(0, 0.46, 0.22),
    ])
    const seats = new THREE.InstancedMesh(
      seatGeo,
      new THREE.MeshStandardMaterial({ color: 0x453d55, roughness: 0.8, metalness: 0.05, emissive: 0x15111d }),
      5 * 16,
    )
    const seatM = new THREE.Matrix4()
    let si = 0
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 16; c++) {
        seatM.makeTranslation((c - 7.5) * 0.82, 0, 5.6 + r * 1.05)
        seats.setMatrixAt(si++, seatM)
      }
    }
    seats.instanceMatrix.needsUpdate = true
    scene.add(seats)

    // Drifting haze puffs — invisible until a hazer is up, then they billow across
    // the stage and make the beams read as volumetric shafts of light.
    const hazeSprites: THREE.Sprite[] = []
    const hazeSeed: { x0: number; y0: number; z0: number; spd: number; phase: number }[] = []
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.SpriteMaterial({ map: hazeTexture(), color: 0xb4bcc8, transparent: true, opacity: 0, depthWrite: false })
      const s = new THREE.Sprite(mat)
      const sc = 3.2 + (i % 3) * 1.4
      s.scale.set(sc, sc, 1)
      const seed = { x0: (i / 18) * 16 - 8, y0: 0.6 + (i % 4) * 0.7, z0: ((i * 3.7) % 11) - 5, spd: 0.12 + (i % 5) * 0.03, phase: i * 0.9 }
      s.position.set(seed.x0, seed.y0, seed.z0)
      s.visible = false
      scene.add(s)
      hazeSprites.push(s)
      hazeSeed.push(seed)
    }

    const fxMap = new Map<string, FxObj>()
    const hazerMap = new Map<string, THREE.Group>()
    // Scenery props (people, band gear, set pieces). Each entry: the built group, its visible
    // floor ring, and a fat invisible ring that's easy to grab for rotating.
    const propMap = new Map<string, { group: THREE.Group; kind: string; ring: THREE.Mesh; ringPick: THREE.Mesh; faceMesh?: THREE.Mesh; faceUrl?: string }>()
    const trussMap = new Map<number, THREE.Mesh>()
    const down = new THREE.Vector3()

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    // Click a fixture to select it (a drag rotates the view, so only a click that
    // barely moved counts as a pick). Shift-click adds/removes from the selection.
    // Pressing on a scenery prop instead grabs it and drags it across the deck.
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downX = 0
    let downY = 0
    let draggingProp: string | null = null
    let draggingRotate: string | null = null // grabbing the selection ring rotates instead of moves
    const deckPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -STAGE_TOP) // horizontal at deck height
    const hitPt = new THREE.Vector3()
    const setNdc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    const pickProp = (): string | null => {
      raycaster.setFromCamera(ndc, camera)
      const groups = [...propMap.values()].map((e) => e.group)
      const hit = raycaster.intersectObjects(groups, true)[0]
      if (!hit) return null
      let o: THREE.Object3D | null = hit.object
      while (o && o.userData.propId === undefined) o = o.parent
      return (o?.userData.propId as string | undefined) ?? null
    }
    // Angle (rad) on the deck from a prop's centre to the current pointer, for the rotate ring.
    const deckAngleToProp = (px: number, pz: number): number | null => {
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(deckPlane, hitPt)) return null
      return Math.atan2(hitPt.z - pz, hitPt.x - px)
    }
    // Raycast the visible selection ring; grabbing it rotates the prop instead of moving it.
    const pickRing = (): string | null => {
      raycaster.setFromCamera(ndc, camera)
      const rings = [...propMap.values()].map((e) => e.ringPick)
      const hit = raycaster.intersectObjects(rings, false).find((h) => h.object.visible)
      return (hit?.object.userData.propRingId as string | undefined) ?? null
    }
    const propPos = (id: string) => (useShowStore.getState().show.props ?? []).find((p) => p.id === id)
    let lastAngle = 0
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
      setNdc(e)
      // Ring first (rotate the already-selected prop), then the prop body (move it).
      const rid = pickRing()
      if (rid) {
        const p = propPos(rid)
        const a = p ? deckAngleToProp(p.x, p.z) : null
        if (a !== null) { draggingRotate = rid; lastAngle = a; controls.enabled = false; return }
      }
      const pid = pickProp()
      if (pid) {
        draggingProp = pid
        useShowStore.getState().selectProp(pid)
        controls.enabled = false // grab the prop instead of orbiting
      }
    }
    const onMoveDrag = (e: PointerEvent) => {
      if (draggingRotate) {
        setNdc(e)
        const p = propPos(draggingRotate)
        const a = p ? deckAngleToProp(p.x, p.z) : null
        if (a !== null) {
          let d = a - lastAngle
          while (d > Math.PI) d -= 2 * Math.PI
          while (d < -Math.PI) d += 2 * Math.PI
          useShowStore.getState().rotateProp(draggingRotate, -THREE.MathUtils.radToDeg(d))
          lastAngle = a
        }
        return
      }
      if (!draggingProp) return
      setNdc(e)
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(deckPlane, hitPt)) {
        const x = THREE.MathUtils.clamp(hitPt.x, -9.5, 9.5)
        const z = THREE.MathUtils.clamp(hitPt.z, -6.5, 3.5)
        useShowStore.getState().moveProp(draggingProp, x, z)
      }
    }
    const onUp = (e: PointerEvent) => {
      if (draggingRotate) { draggingRotate = null; controls.enabled = true; return }
      if (draggingProp) { draggingProp = null; controls.enabled = true; return }
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) return
      setNdc(e)
      raycaster.setFromCamera(ndc, camera)
      const proxies = [
        ...[...fxMap.values()].map((fx) => fx.hit),
        ...[...hazerMap.values()].map((hz) => hz.userData.box as THREE.Object3D),
      ].filter(Boolean)
      const picked = raycaster.intersectObjects(proxies, false)[0]
      const st = useShowStore.getState()
      st.selectProp(null) // clicking the rig deselects any prop
      if (!picked) {
        st.select([])
        return
      }
      let o: THREE.Object3D | null = picked.object
      while (o && !o.userData.fixtureId) o = o.parent
      const id = o?.userData.fixtureId as string | undefined
      // Click toggles, accumulating a multi-selection like the patch list does.
      if (id) st.toggleSelect(id)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMoveDrag)
    renderer.domElement.addEventListener('pointerup', onUp)

    let raf = 0
    let lastMs = performance.now()
    let clock = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const state = useShowStore.getState()
      const { show, definitions, programmer, playbacks, playbackLevels, firedLevels, fades, flashIds, swopId, effects, selection } = state
      const cues = liveCues(playbacks, state.now)
      const selSet = new Set(selection)
      // Reconcile the optional venue (preset or loaded glTF) when it changes.
      reconcileVenue(state.venueUrl, show.venuePreset)
      // House/work lights toggle: lit room + lighter background, or dark beams-only.
      const lit = extRef.current ? state.viewLightsExt : state.viewLights
      workHemi.intensity = lit ? 1.6 : 0
      workDir.intensity = lit ? 0.55 : 0
      scene.background = lit ? BG_LIT : BG_DARK
      ;(scene.fog as THREE.FogExp2).color.copy(lit ? BG_LIT : BG_DARK)
      ;(scene.fog as THREE.FogExp2).density = lit ? 0.006 : 0.022
      const nowMs = performance.now()
      if (state.playing) clock += (nowMs - lastMs) / 1000 // freeze on Pause
      lastMs = nowMs
      const levels = effectivePlaybackLevels(playbackLevels, firedLevels, fades, state.now, flashIds, swopId)
      const base = computePlaybackBase(cues, levels, show, definitions)
      const merged = mergeProgrammer(base, programmer)
      const active = activeEffects(cues, levels, {}, state.now, effects)
      let effective = applyEffects(merged, active, show, definitions, clock)
      if (state.highlight) effective = applyHighlight(effective, selection, show, definitions)

      const live = new Set(show.fixtures.map((f) => f.id))
      for (const [id, fx] of fxMap) {
        if (!live.has(id)) {
          scene.remove(fx.group)
          scene.remove(fx.pool)
          fxMap.delete(id)
        }
      }

      // Reconcile the truss bars against the show's (editable) truss list.
      const trusses = getTrusses(show)
      const trussLive = new Set(trusses.map((t) => t.id))
      for (const [id, m] of trussMap) {
        if (!trussLive.has(id)) { scene.remove(m); trussMap.delete(id) }
      }
      for (const t of trusses) {
        let m = trussMap.get(t.id)
        if (!m) { m = buildTruss(18); scene.add(m); trussMap.set(t.id, m) }
        m.position.set(0, t.y + 0.55, t.z)
      }

      const outputs = computeFixtureOutputs(show, definitions, effective)
      const outById = new Map(outputs.map((o) => [o.instanceId, o.values]))

      // Haze level (0..1) = the strongest hazer output; it thickens the air + beams.
      let hazeLevel = 0
      for (const pf of show.fixtures) {
        const def = definitions[pf.definitionId]
        if (def?.category !== 'hazer') continue
        const vals = outById.get(pf.id)
        const chans = def.modes[pf.modeIndex]?.channels ?? []
        const hi = chans.findIndex((c) => c.function === 'haze')
        if (vals && hi >= 0) hazeLevel = Math.max(hazeLevel, (vals[hi] ?? 0) / 255)
      }
      ;(scene.fog as THREE.FogExp2).density = (lit ? 0.006 : 0.022) + hazeLevel * 0.012
      // Remove hazer machines whose fixture is gone.
      for (const [id, g] of hazerMap) {
        if (!live.has(id)) { scene.remove(g); hazerMap.delete(id) }
      }

      // Where each live beam lands on the deck this frame, so scenery props standing there get lit
      // by it (colour + intensity). Collected in the fixture loop, applied in the props loop below.
      const lightHits: { x: number; z: number; r: number; col: THREE.Color; inten: number }[] = []
      for (const pf of show.fixtures) {
        const def = definitions[pf.definitionId]
        if (!def) continue
        // Hazers are floor machines, not truss fixtures — no beam, just the box.
        if (def.category === 'hazer') {
          let hz = hazerMap.get(pf.id)
          if (!hz) { hz = buildHazer(); scene.add(hz); hazerMap.set(pf.id, hz) }
          hz.userData.fixtureId = pf.id // so a click can select it
          // Default (floor) → on the stage deck at a side; else hung on its truss.
          if (pf.floor === false) hz.position.copy(place(pf.position.x, pf.truss, trusses))
          else hz.position.set(pf.position.x * 8, STAGE_TOP, -1)
          // Aim the output nozzle toward stage centre (flip when placed on the right).
          hz.rotation.y = pf.position.x > 0.1 ? Math.PI : 0
          const selLed = hz.userData.selLed as THREE.Sprite | undefined
          if (selLed) selLed.visible = false
          const hzBox = hz.userData.box as THREE.Mesh | undefined
          if (hzBox) (hzBox.material as THREE.MeshStandardMaterial).emissive.setHex(selSet.has(pf.id) ? 0x123b4a : 0x0c0c10)
          continue
        }
        let fx = fxMap.get(pf.id)
        if (!fx) {
          fx = def.geometry ? buildFromGeometry(def.geometry) : buildFixture(bodyOf(def))
          scene.add(fx.group)
          scene.add(fx.pool)
          fxMap.set(pf.id, fx)
        }
        fx.group.userData.fixtureId = pf.id
        // Name tag — only on SELECTED fixtures AND only under work lights (so a big
        // rig doesn't drown in labels, and the dark design view stays clean).
        const showLabel = lit && selSet.has(pf.id)
        if (showLabel) {
          const labelText = `${pf.name}  ·  ${pf.universe}.${pf.address}`
          if (!fx.label || fx.label.userData.text !== labelText) {
            if (fx.label) {
              fx.group.remove(fx.label)
              fx.label.material.map?.dispose()
              fx.label.material.dispose()
            }
            fx.label = makeLabelSprite(labelText)
            fx.label.userData.text = labelText
            fx.group.add(fx.label)
          }
          fx.label.visible = true
        } else if (fx.label) {
          fx.label.visible = false
        }
        const home = place(pf.position.x, pf.truss, trusses)
        fx.group.position.copy(home)

        // Selection — Capture/Titan style: highlight the FIXTURE itself (cyan outline + a lift
        // on the body) rather than a floating dot, so you see which lamp is selected on the rig.
        const selected = selSet.has(pf.id)
        fx.halo.visible = false
        ;(fx.edges.material as THREE.LineBasicMaterial).color.setHex(selected ? 0x3fd0f2 : 0x8a8b95)

        const vs = computeVisualState(def, pf.modeIndex, outById.get(pf.id) ?? [])
        const col = new THREE.Color(vs.color.r / 255, vs.color.g / 255, vs.color.b / 255)

        // Pan turns the yoke, tilt turns the head — the beam (in the head) follows. The
        // fixture's physical rig aim is the BASE orientation (how a static PAR was pointed by
        // hand); a moving head's DMX pan/tilt adds on top.
        fx.panPart.rotation.y = THREE.MathUtils.degToRad((pf.aim?.pan ?? 0) + (vs.pan ?? 0))
        fx.tiltPart.rotation.x = THREE.MathUtils.degToRad((pf.aim?.tilt ?? 0) + (vs.tilt ?? 0))

        // Beam world direction = pan ∘ tilt applied to local −Y (down).
        _qy.setFromAxisAngle(_Y, fx.panPart.rotation.y)
        _qx.setFromAxisAngle(_X, fx.tiltPart.rotation.x)
        down.set(0, -1, 0).applyQuaternion(_q.copy(_qy).multiply(_qx))
        let length = 16
        let onStage = false // the beam lands on the (flat) stage deck → OK to draw a floor pool
        let landX = home.x
        let landZ = home.z
        if (down.y < -0.02) {
          // Where the beam meets the stage-deck height. We only draw the floor pool when it
          // lands cleanly on the deck (inset from the edges/upstage wall so it never clips the
          // lip or the corner). Off the stage — over the audience seats, a wall — the flat disc
          // looks wrong on the 3D objects, so we drop it and just let the beam shaft carry on.
          let t = (home.y - STAGE_TOP) / -down.y
          let hx = home.x + down.x * t
          let hz = home.z + down.z * t
          onStage = hx >= -9.5 && hx <= 9.5 && hz >= -6.5 && hz <= 3.5
          if (!onStage) {
            // Carry the shaft on down to the floor so it doesn't stop short in mid-air.
            t = home.y / -down.y
            hx = home.x + down.x * t
            hz = home.z + down.z * t
          }
          length = Math.min(24, t)
          landX = hx
          landZ = hz
        }
        // Beam width from zoom + iris only: zoom opens/closes the cone, iris pinches it toward a
        // pinspot. Prism does NOT widen the beam (that read as a zoom) — it drops a multi-facet
        // pattern on the floor instead (see the pool below).
        const prismOn = vs.prism !== undefined && vs.prism > 0.15
        const zoomF = vs.zoom !== undefined ? 0.45 + vs.zoom * 1.45 : 1
        const irisF = vs.iris !== undefined ? 0.18 + vs.iris * 0.82 : 1
        const widthF = zoomF * irisF * (fx.beamSpread ?? 1)
        fx.beam.scale.set(length * widthF, length, length * widthF)

        // Strobe: actually blink the output on/off (~9 Hz) instead of just dimming it, so you see
        // the flashing. Uses real time so it keeps blinking even with the effect clock paused.
        const strobeVisible = !vs.strobing || Math.floor(nowMs / 55) % 2 === 0
        const on = vs.intensity > 0.01 && strobeVisible
        fx.beam.visible = on
        if (on) {
          fx.beamMat.color.copy(col)
          // Haze makes the shaft of light visible in the air — beams get more opaque; a prism
          // splits it into facets, so the column reads a little brighter.
          fx.beamMat.opacity = Math.min(0.95, vs.intensity * 0.6 * (1 + 1.4 * hazeLevel) * (prismOn ? 1.15 : 1))
        }

        // Pool where the beam lands — an ellipse (a tilted beam cuts the surface obliquely).
        // A plain white disc over the audience/off-stage looks wrong, so normally we only draw
        // it on the stage deck. BUT when a gobo is in the beam we DO draw it off-stage too —
        // otherwise the shaped pattern (incl. on the back wall) would vanish the moment the
        // beam leaves the deck, and you couldn't see your selected gobo. A patterned pool reads
        // as intentional, unlike a blank disc.
        // The fixture's own gobo set — its real GDTF gobos when we have them, else the generic set.
        const goboSet = goboSetFor(def.id)
        const goboIdx = vs.gobo !== undefined && vs.gobo >= 8
          ? Math.min(goboSet.tex.length - 1, Math.floor((vs.gobo / 256) * goboSet.tex.length))
          : -1
        // Prism multiplies the pool: with a gobo it tiles the gobo (several copies = the split);
        // with no gobo it drops the 3-facet pattern. No prism → the plain gobo (or nothing).
        const patternTex = prismOn
          ? (goboIdx >= 0 ? goboSet.prism[goboIdx] : PRISM_TEX)
          : (goboIdx >= 0 ? goboSet.tex[goboIdx] : null)
        if (on && (onStage || patternTex)) {
          fx.pool.visible = true
          fx.pool.position.set(landX, (onStage ? STAGE_TOP : 0) + 0.02, landZ)
          const vert = Math.max(0.2, -down.y) // cos of angle from vertical
          const floorAngle = Math.atan2(down.z, down.x)
          fx.pool.rotation.set(-Math.PI / 2, 0, -floorAngle)
          // Focus: a defocused beam spreads its pool wider and washes it out; sharp = tight+bright.
          const focusF = vs.focus ?? 1
          const spread = 1 + (1 - focusF) * 0.35
          fx.pool.scale.set((length / vert) * widthF * spread, length * widthF * spread, 1)
          // A prop standing where this beam lands on the deck gets lit by it (see props loop).
          if (onStage) lightHits.push({ x: landX, z: landZ, r: 0.13 * length * widthF * spread + 0.35, col: col.clone(), inten: vs.intensity })
          fx.poolMat.color.copy(col)
          if (fx.poolMat.alphaMap !== patternTex) {
            fx.poolMat.alphaMap = patternTex
            fx.poolMat.needsUpdate = true
          }
          fx.poolMat.opacity = vs.intensity * (patternTex ? 0.55 : 0.35) * (0.8 + 0.2 * focusF)
        } else {
          fx.pool.visible = false
        }

        // Body stays dark so only the beam carries colour — but lift it a touch under
        // work lights so you can clearly see each fixture on the truss.
        ;(fx.body.material as THREE.MeshStandardMaterial).emissive.setHex(selected ? 0x123b4a : lit ? 0x15151b : 0x000000)
      }

      // --- Scenery props (people, band gear, set pieces) — reconcile against show.props ---
      const propList = show.props ?? []
      const propIds = new Set(propList.map((p) => p.id))
      for (const [id, entry] of propMap) {
        if (!propIds.has(id)) { scene.remove(entry.group, entry.ring, entry.ringPick); propMap.delete(id) }
      }
      for (const p of propList) {
        let entry = propMap.get(p.id)
        if (!entry || entry.kind !== p.kind) {
          if (entry) scene.remove(entry.group, entry.ring, entry.ringPick)
          const group = buildProp(p.kind)
          group.userData.propId = p.id
          // Slim visible torus reading as a selection ring...
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.62, 0.055, 8, 40),
            new THREE.MeshBasicMaterial({ color: 0x3fd0f2, transparent: true, opacity: 0.9, depthWrite: false }),
          )
          ring.rotation.x = -Math.PI / 2
          // ...plus a fat invisible torus over it that's easy to grab to rotate the prop.
          const ringPick = new THREE.Mesh(
            new THREE.TorusGeometry(0.62, 0.3, 6, 32),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), // invisible but raycastable
          )
          ringPick.rotation.x = -Math.PI / 2
          ringPick.userData.propRingId = p.id
          scene.add(group, ring, ringPick)
          entry = { group, kind: p.kind, ring, ringPick }
          propMap.set(p.id, entry)
        }
        entry.group.position.set(p.x, STAGE_TOP, p.z)
        entry.group.rotation.y = THREE.MathUtils.degToRad(p.rot ?? 0)

        // Face photo on a person's head — apply/replace when it changes (recognisable students).
        const face = isPersonKind(p.kind) ? p.face : undefined
        if (face !== entry.faceUrl) {
          if (entry.faceMesh) {
            entry.group.remove(entry.faceMesh)
            const fm = entry.faceMesh.material as THREE.MeshBasicMaterial
            fm.map?.dispose(); fm.dispose()
            entry.faceMesh = undefined
          }
          if (face) {
            const tex = new THREE.TextureLoader().load(face)
            tex.colorSpace = THREE.SRGBColorSpace
            const mesh = new THREE.Mesh(
              new THREE.PlaneGeometry(0.26, 0.26),
              new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
            )
            mesh.position.set(0, HEAD_Y, 0.12) // just in front of the head sphere, facing forward
            entry.group.add(mesh)
            entry.faceMesh = mesh
          }
          entry.faceUrl = face
        }

        entry.ring.position.set(p.x, STAGE_TOP + 0.02, p.z)
        entry.ringPick.position.set(p.x, STAGE_TOP + 0.02, p.z)
        entry.ring.visible = state.selectedProp === p.id
        // The grab torus is only "active" (raycastable via our visible filter) when selected.
        entry.ringPick.visible = state.selectedProp === p.id

        // Light the prop: sum every beam landing on it (brightest at the pool centre) and paint
        // that colour as emissive on the prop, so a spot aimed at the singer lights the singer.
        let lr = 0, lg = 0, lb = 0
        for (const h of lightHits) {
          const d = Math.hypot(p.x - h.x, p.z - h.z)
          if (d < h.r) { const w = (1 - d / h.r) * h.inten; lr += h.col.r * w; lg += h.col.g * w; lb += h.col.b * w }
        }
        const er = Math.min(1, lr), eg = Math.min(1, lg), eb = Math.min(1, lb)
        entry.group.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.userData.propMesh) (m.material as THREE.MeshStandardMaterial).emissive.setRGB(er, eg, eb)
        })
      }

      // Drift the haze puffs (they slowly billow + rise) while a hazer is up. Uses
      // real time so the haze keeps moving even with the effect clock paused.
      const hazeVisible = hazeLevel > 0.01
      const th = nowMs / 1000
      for (let i = 0; i < hazeSprites.length; i++) {
        const s = hazeSprites[i]
        s.visible = hazeVisible
        if (!hazeVisible) continue
        const u = hazeSeed[i]
        const t = th * u.spd + u.phase
        s.position.x = u.x0 + Math.sin(t) * 2.6
        s.position.z = u.z0 + Math.cos(t * 0.7) * 1.8
        s.position.y = u.y0 + ((th * 0.1 + u.phase) % 2.4)
        ;(s.material as THREE.SpriteMaterial).opacity = hazeLevel * 0.34
      }

      // Focus-selected: fit the selection's bounding box in the view, keeping the current viewing
      // direction so orbiting then revolves around it.
      if (state.focusNonce !== seenFocusNonce) {
        seenFocusNonce = state.focusNonce
        const pts = state.selection.map((id) => fxMap.get(id)?.group.position).filter(Boolean) as THREE.Vector3[]
        if (pts.length) {
          const box = new THREE.Box3()
          pts.forEach((p) => box.expandByPoint(p))
          box.expandByScalar(0.55) // the fixture body around each hang point
          const center = box.getCenter(new THREE.Vector3())
          const radius = box.getSize(new THREE.Vector3()).length() * 0.5
          const fov = (camera.fov * Math.PI) / 180
          const dist = Math.max(2.2, Math.min(24, (radius / Math.tan(fov / 2)) * 1.35))
          const dir = camera.position.clone().sub(controls.target).normalize()
          focusAnim = { fromT: controls.target.clone(), toT: center, fromC: camera.position.clone(), toC: center.clone().add(dir.multiplyScalar(dist)), t: 0 }
        }
      }
      // Home: glide back to the full-stage overview.
      if (state.homeNonce !== seenHomeNonce) {
        seenHomeNonce = state.homeNonce
        focusAnim = { fromT: controls.target.clone(), toT: HOME_TARGET.clone(), fromC: camera.position.clone(), toC: HOME_CAM.clone(), t: 0 }
      }
      // Preset view chosen from the toolbar dropdown.
      if (state.viewNonce !== seenViewNonce) {
        seenViewNonce = state.viewNonce
        const v = VIEWS[state.viewMode] ?? VIEWS.home
        focusAnim = { fromT: controls.target.clone(), toT: v.target.clone(), fromC: camera.position.clone(), toC: v.cam.clone(), t: 0 }
      }
      // 'Stage' view hides the audience so you see the stage alone.
      seats.visible = state.viewMode !== 'stage'
      if (focusAnim) {
        focusAnim.t = Math.min(1, focusAnim.t + 0.05)
        const e = focusAnim.t * focusAnim.t * (3 - 2 * focusAnim.t) // smoothstep
        controls.target.lerpVectors(focusAnim.fromT, focusAnim.toT, e)
        camera.position.lerpVectors(focusAnim.fromC, focusAnim.toC, e)
        if (focusAnim.t >= 1) focusAnim = null
      }

      controls.update()
      // Keep the camera just above the floor — you can get down low to look up at the rig, but
      // never slip under the stage deck.
      if (camera.position.y < 0.25) camera.position.y = 0.25
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMoveDrag)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
