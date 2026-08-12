import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { buildVenue } from '../../model/venues'
import { useShowStore } from '../../store/showStore'
import { computeFixtureOutputs, mergeProgrammer, computePlaybackBase, effectivePlaybackLevels } from '../../engine/dmx'
import { applyEffects, activeEffects } from '../../engine/effects'
import { liveCues } from '../../model/cue'
import { computeVisualState } from '../../engine/render'
import type { TrussDef } from '../../model/types'
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

/** A fixture model. Moving heads get a base + panning yoke + tilting head; other
 *  kinds get a static can on a yoke. Either way the beam lives in the tilt part. */
function buildFixture(movingHead: boolean): FxObj {
  const group = new THREE.Group()
  const panPart = new THREE.Group()
  const tiltPart = new THREE.Group()

  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x16161c, metalness: 0.5, roughness: 0.5 })
  let body: THREE.Mesh

  if (movingHead) {
    // Clamp + base that stay on the truss; the yoke pans, the head tilts.
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), metalMat)
    clamp.position.y = 0.44
    group.add(clamp)
    const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.14, 18), metalMat)
    baseCyl.position.y = 0.3
    group.add(baseCyl)

    panPart.position.y = 0.23
    group.add(panPart)
    const armGeo = new THREE.BoxGeometry(0.06, 0.5, 0.14)
    const armL = new THREE.Mesh(armGeo, metalMat)
    armL.position.set(-0.26, -0.2, 0)
    const armR = new THREE.Mesh(armGeo, metalMat)
    armR.position.set(0.26, -0.2, 0)
    panPart.add(armL, armR)

    tiltPart.position.y = -0.34
    panPart.add(tiltPart)
    const barrelGeo = new THREE.CylinderGeometry(0.17, 0.19, 0.42, 20)
    body = new THREE.Mesh(barrelGeo, barrelMat)
    body.position.y = -0.13
    tiltPart.add(body)
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 20), metalMat)
    lens.rotation.x = Math.PI / 2
    lens.position.y = -0.34
    tiltPart.add(lens)
  } else {
    // Static can (PAR / strobe / dimmer) hanging from a simple yoke bracket.
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), metalMat)
    clamp.position.y = 0.42
    group.add(clamp)
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.03, 8, 20, Math.PI), metalMat)
    yoke.position.y = 0.05
    group.add(yoke)
    group.add(panPart)
    panPart.add(tiltPart)
    const barrelGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.4, 20)
    body = new THREE.Mesh(barrelGeo, barrelMat)
    body.position.y = -0.1
    tiltPart.add(body)
  }

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
  beam.position.y = movingHead ? -0.34 : -0.3
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

  // Selection indicator — a small, soft red glow on the body (subtle, like a status
  // light), shown only when selected.
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
  halo.position.y = movingHead ? -0.34 : -0.1 // sit on the lamp body
  halo.visible = false
  group.add(halo)

  return { group, panPart, tiltPart, body, edges, hit, halo, beam, beamMat, pool, poolMat }
}

export function Visualizer3D() {
  const mountRef = useRef<HTMLDivElement>(null)

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
    controls.maxPolarAngle = Math.PI * 0.52

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
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downX = 0
    let downY = 0
    const onDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) return
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const proxies = [
        ...[...fxMap.values()].map((fx) => fx.hit),
        ...[...hazerMap.values()].map((hz) => hz.userData.box as THREE.Object3D),
      ].filter(Boolean)
      const picked = raycaster.intersectObjects(proxies, false)[0]
      const st = useShowStore.getState()
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
    renderer.domElement.addEventListener('pointerup', onUp)

    let raf = 0
    let lastMs = performance.now()
    let clock = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const state = useShowStore.getState()
      const { show, definitions, programmer, playbacks, playbackLevels, firedLevels, fades, effects, selection } = state
      const cues = liveCues(playbacks, state.now)
      const selSet = new Set(selection)
      // Reconcile the optional venue (preset or loaded glTF) when it changes.
      reconcileVenue(state.venueUrl, show.venuePreset)
      // House/work lights toggle: lit room + lighter background, or dark beams-only.
      const lit = state.viewLights
      workHemi.intensity = lit ? 1.6 : 0
      workDir.intensity = lit ? 0.55 : 0
      scene.background = lit ? BG_LIT : BG_DARK
      ;(scene.fog as THREE.FogExp2).color.copy(lit ? BG_LIT : BG_DARK)
      ;(scene.fog as THREE.FogExp2).density = lit ? 0.006 : 0.022
      const nowMs = performance.now()
      if (state.playing) clock += (nowMs - lastMs) / 1000 // freeze on Pause
      lastMs = nowMs
      const levels = effectivePlaybackLevels(playbackLevels, firedLevels, fades, state.now)
      const base = computePlaybackBase(cues, levels, show, definitions)
      const merged = mergeProgrammer(base, programmer)
      const active = activeEffects(cues, levels, {}, state.now, effects)
      const effective = applyEffects(merged, active, show, definitions, clock)

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
          if (selLed) selLed.visible = selSet.has(pf.id)
          continue
        }
        let fx = fxMap.get(pf.id)
        if (!fx) {
          fx = buildFixture(def.category === 'movingHead')
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

        // Selection — just a soft coral halo around the fixture (not the whole body).
        fx.halo.visible = selSet.has(pf.id)

        const vs = computeVisualState(def, pf.modeIndex, outById.get(pf.id) ?? [])
        const col = new THREE.Color(vs.color.r / 255, vs.color.g / 255, vs.color.b / 255)

        // Pan turns the yoke, tilt turns the head — the beam (in the head) follows.
        fx.panPart.rotation.y = THREE.MathUtils.degToRad(vs.pan ?? 0)
        fx.tiltPart.rotation.x = THREE.MathUtils.degToRad(vs.tilt ?? 0)

        // Beam world direction = pan ∘ tilt applied to local −Y (down).
        _qy.setFromAxisAngle(_Y, fx.panPart.rotation.y)
        _qx.setFromAxisAngle(_X, fx.tiltPart.rotation.x)
        down.set(0, -1, 0).applyQuaternion(_q.copy(_qy).multiply(_qx))
        let length = 16
        let hitsFloor = false
        if (down.y < -0.02) {
          // Reach the stage deck (1 m above the floor) from this truss's height.
          length = Math.min(24, (home.y - STAGE_TOP) / -down.y)
          hitsFloor = true
        }
        fx.beam.scale.setScalar(length)

        const on = vs.intensity > 0.01
        fx.beam.visible = on
        if (on) {
          fx.beamMat.color.copy(col)
          // Haze makes the shaft of light visible in the air — beams get more opaque.
          fx.beamMat.opacity = Math.min(0.95, vs.intensity * (vs.strobing ? 0.25 : 0.55) * (1 + 1.4 * hazeLevel))
        }

        // Pool where the beam meets the floor — an ellipse (a tilted beam cuts the
        // floor obliquely), oriented and stretched along the beam's ground track.
        if (on && hitsFloor) {
          fx.pool.visible = true
          fx.pool.position.set(home.x + down.x * length, STAGE_TOP + 0.02, home.z + down.z * length)
          const vert = Math.max(0.2, -down.y) // cos of angle from vertical
          const floorAngle = Math.atan2(down.z, down.x)
          fx.pool.rotation.set(-Math.PI / 2, 0, -floorAngle)
          fx.pool.scale.set(length / vert, length, 1)
          fx.poolMat.color.copy(col)
          fx.poolMat.opacity = vs.intensity * 0.35
        } else {
          fx.pool.visible = false
        }

        // Body stays dark so only the beam carries colour — but lift it a touch under
        // work lights so you can clearly see each fixture on the truss.
        ;(fx.body.material as THREE.MeshStandardMaterial).emissive.setHex(lit ? 0x15151b : 0x000000)
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

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
