import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useShowStore } from '../../store/showStore'
import { computeFixtureOutputs, mergeProgrammer } from '../../engine/dmx'
import { computeVisualState } from '../../engine/render'

const BEAM_H = 6

/** World position for a fixture on the truss (x normalized -1..1). */
function place(x: number): THREE.Vector3 {
  return new THREE.Vector3(x * 6, 5, 0)
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

function buildFixture(): FxObj {
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1c1c22, metalness: 0.5, roughness: 0.6 }),
  )
  group.add(body)

  const head = new THREE.Group()
  group.add(head)

  // Volumetric beam: additive, transparent cone with the tip at the head.
  const beamGeo = new THREE.ConeGeometry(0.9, BEAM_H, 24, 1, true)
  beamGeo.translate(0, -BEAM_H / 2, 0)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const beam = new THREE.Mesh(beamGeo, beamMat)
  head.add(beam)

  // Light pool where the beam meets the floor.
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), poolMat)
  pool.rotation.x = -Math.PI / 2
  pool.position.y = -BEAM_H + 0.02
  head.add(pool)

  return { group, head, body, beam, beamMat, pool, poolMat }
}

export function Visualizer3D() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0b0f)
    scene.fog = new THREE.FogExp2(0x0b0b0f, 0.028)

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
    truss.position.set(0, 5.3, 0)
    scene.add(truss)

    const fxMap = new Map<string, FxObj>()

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
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const { show, definitions, programmer, cues, activeCueId } = useShowStore.getState()
      const base = cues.find((c) => c.id === activeCueId)?.values ?? {}
      const effective = mergeProgrammer(base, programmer)

      // Reconcile fixture objects with the current patch (create / remove).
      const live = new Set(show.fixtures.map((f) => f.id))
      for (const [id, fx] of fxMap) {
        if (!live.has(id)) {
          scene.remove(fx.group)
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
          fxMap.set(pf.id, fx)
        }
        fx.group.position.copy(place(pf.position.x))

        const vs = computeVisualState(def, pf.modeIndex, outById.get(pf.id) ?? [])
        const col = new THREE.Color(vs.color.r / 255, vs.color.g / 255, vs.color.b / 255)

        fx.head.rotation.y = THREE.MathUtils.degToRad(vs.pan ?? 0)
        fx.head.rotation.x = THREE.MathUtils.degToRad(vs.tilt ?? 0)

        const on = vs.intensity > 0.01
        fx.beam.visible = on
        fx.pool.visible = on
        if (on) {
          fx.beamMat.color.copy(col)
          fx.beamMat.opacity = vs.intensity * (vs.strobing ? 0.12 : 0.28)
          fx.poolMat.color.copy(col)
          fx.poolMat.opacity = vs.intensity * 0.5
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
