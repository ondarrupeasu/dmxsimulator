import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useShowStore } from '../../store/showStore'
import { computeFixtureOutputs, mergeProgrammer } from '../../engine/dmx'
import { applyEffects } from '../../engine/effects'
import { computeVisualState } from '../../engine/render'

const TRUSS_Y = 5

/** World position for a fixture on the truss (x normalized -1..1). */
function place(x: number): THREE.Vector3 {
  return new THREE.Vector3(x * 6, TRUSS_Y, 0)
}

interface FxObj {
  group: THREE.Group
  head: THREE.Group
  body: THREE.Mesh
  beam: THREE.Mesh
  beamMat: THREE.MeshBasicMaterial
  pool: THREE.Mesh
  poolMat: THREE.MeshBasicMaterial
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

function buildFixture(): FxObj {
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1c1c22, metalness: 0.5, roughness: 0.6 }),
  )
  group.add(body)

  const head = new THREE.Group()
  group.add(head)

  const beamMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const beam = new THREE.Mesh(makeBeamGeometry(), beamMat)
  head.add(beam)

  // Floor pool (added to the scene, not the head, so it stays flat on the floor).
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), poolMat)
  pool.rotation.x = -Math.PI / 2

  return { group, head, body, beam, beamMat, pool, poolMat }
}

export function Visualizer3D() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0b0f)
    scene.fog = new THREE.FogExp2(0x0b0b0f, 0.025)

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
    camera.position.set(0, 6, 14)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 2, 0)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.52

    scene.add(new THREE.AmbientLight(0x404050, 1.2))
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.9, metalness: 0.1 }),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    scene.add(new THREE.GridHelper(40, 40, 0x2c2c38, 0x1c1c24))
    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.15, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x33333c, metalness: 0.6, roughness: 0.5 }),
    )
    truss.position.set(0, TRUSS_Y + 0.3, 0)
    scene.add(truss)

    const fxMap = new Map<string, FxObj>()
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

    let raf = 0
    let lastMs = performance.now()
    let clock = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const state = useShowStore.getState()
      const { show, definitions, programmer, cues, activeCueId, effects } = state
      const nowMs = performance.now()
      if (state.playing) clock += (nowMs - lastMs) / 1000 // freeze on Pause
      lastMs = nowMs
      const base = cues.find((c) => c.id === activeCueId)?.values ?? {}
      const merged = mergeProgrammer(base, programmer)
      const effective = applyEffects(merged, effects, show, definitions, clock)

      const live = new Set(show.fixtures.map((f) => f.id))
      for (const [id, fx] of fxMap) {
        if (!live.has(id)) {
          scene.remove(fx.group)
          scene.remove(fx.pool)
          fxMap.delete(id)
        }
      }

      const outputs = computeFixtureOutputs(show, definitions, effective)
      const outById = new Map(outputs.map((o) => [o.instanceId, o.values]))

      for (const pf of show.fixtures) {
        const def = definitions[pf.definitionId]
        if (!def) continue
        let fx = fxMap.get(pf.id)
        if (!fx) {
          fx = buildFixture()
          scene.add(fx.group)
          scene.add(fx.pool)
          fxMap.set(pf.id, fx)
        }
        fx.group.position.copy(place(pf.position.x))

        const vs = computeVisualState(def, pf.modeIndex, outById.get(pf.id) ?? [])
        const col = new THREE.Color(vs.color.r / 255, vs.color.g / 255, vs.color.b / 255)

        fx.head.rotation.y = THREE.MathUtils.degToRad(vs.pan ?? 0)
        fx.head.rotation.x = THREE.MathUtils.degToRad(vs.tilt ?? 0)

        // Beam direction in world space; length = distance to the floor (y=0).
        down.set(0, -1, 0).applyEuler(fx.head.rotation)
        let length = 16
        let hitsFloor = false
        if (down.y < -0.02) {
          length = Math.min(24, TRUSS_Y / -down.y)
          hitsFloor = true
        }
        fx.beam.scale.setScalar(length)

        const on = vs.intensity > 0.01
        fx.beam.visible = on
        if (on) {
          fx.beamMat.color.copy(col)
          fx.beamMat.opacity = vs.intensity * (vs.strobing ? 0.25 : 0.55)
        }

        // Pool where the beam meets the floor.
        if (on && hitsFloor) {
          fx.pool.visible = true
          fx.pool.position.set(pf.position.x * 6 + down.x * length, 0.02, down.z * length)
          fx.pool.scale.setScalar(length)
          fx.poolMat.color.copy(col)
          fx.poolMat.opacity = vs.intensity * 0.6
        } else {
          fx.pool.visible = false
        }

        ;(fx.body.material as THREE.MeshStandardMaterial).emissive.copy(
          on ? col : new THREE.Color(0x000000),
        )
      }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
