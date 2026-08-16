import { useMemo, useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore, useEffectiveProgrammer } from '../../store/showStore'
import { computeFixtureOutputs } from '../../engine/dmx'
import { computeVisualState } from '../../engine/render'
import { getTrusses, trussById, STAGE_TOP } from '../../model/venue'

const W = 1000
const H = 740

// World reference ranges (metres-ish): depth Z and hang height Y.
const Z_MIN = -8 // upstage / back wall
const Z_MAX = 12 // behind the audience
const Y_MAX = 8 // top of the highest sensible truss
const STAGE_BACK = -7
const STAGE_FRONT = 4 // downstage lip
const AUD_FRONT = 5.4

// Two stacked panels: PLAN (top-down) on top, ELEVATION (side) below.
const PLAN = { top: 34, h: 300, left: 70, w: W - 140 }
const ELEV = { top: 420, h: 280, left: 70, w: W - 140 }

const planX = (x: number) => PLAN.left + (x * 0.5 + 0.5) * PLAN.w
const planY = (z: number) => PLAN.top + ((z - Z_MIN) / (Z_MAX - Z_MIN)) * PLAN.h
const elevY = (y: number) => ELEV.top + ELEV.h - (y / Y_MAX) * ELEV.h

export function Visualizer2D() {
  const { t } = useTranslation()
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const effective = useEffectiveProgrammer()
  const selection = useShowStore((s) => s.selection)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const select = useShowStore((s) => s.select)
  const trusses = getTrusses(show)
  // Which wing the elevation is viewed from (flips the depth axis).
  const [fromRight, setFromRight] = useState(false)
  const ex = (z: number) => ELEV.left + ((fromRight ? Z_MAX - z : z - Z_MIN) / (Z_MAX - Z_MIN)) * ELEV.w

  // Pan + zoom via the SVG viewBox.
  const svgRef = useRef<SVGSVGElement>(null)
  const [vb, setVb] = useState({ x: 0, y: 0, w: W, h: H })
  const zoomed = vb.w !== W || vb.x !== 0 || vb.y !== 0
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const moved = useRef(false)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      setVb((v) => {
        const k = e.deltaY > 0 ? 1.05 : 1 / 1.05
        const nw = Math.max(W * 0.15, Math.min(W * 2.5, v.w * k))
        const r = nw / v.w
        // Zoom toward the cursor; fall back to the viewBox centre if it's unavailable.
        const px = rect.width ? v.x + ((e.clientX - rect.left) / rect.width) * v.w : NaN
        const py = rect.height ? v.y + ((e.clientY - rect.top) / rect.height) * v.h : NaN
        const cx = Number.isFinite(px) ? px : v.x + v.w / 2
        const cy = Number.isFinite(py) ? py : v.y + v.h / 2
        return { x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r, w: nw, h: v.h * r }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  const onPanDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }
    moved.current = false
  }
  const onPanMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    if (Math.abs(e.clientX - d.x) > 3 || Math.abs(e.clientY - d.y) > 3) moved.current = true
    setVb((v) => ({
      ...v,
      x: d.vx - ((e.clientX - d.x) / rect.width) * v.w,
      y: d.vy - ((e.clientY - d.y) / rect.height) * v.h,
    }))
  }
  const onPanUp = () => { drag.current = null }
  const resetView = () => setVb({ x: 0, y: 0, w: W, h: H })

  const outputs = useMemo(
    () => computeFixtureOutputs(show, definitions, effective),
    [show, definitions, effective],
  )
  const byId = useMemo(
    () => Object.fromEntries(outputs.map((o) => [o.instanceId, o.values])),
    [outputs],
  )

  const fixtures = show.fixtures.map((pf) => {
    const def = definitions[pf.definitionId]
    const vs = def ? computeVisualState(def, pf.modeIndex, byId[pf.id] ?? []) : null
    const t = trussById(trusses, pf.truss)
    return { pf, def, vs, t, hazer: def?.category === 'hazer' }
  })

  return (
    <div className="stage">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerLeave={onPanUp}
        onClick={() => { if (!moved.current) select([]) }}
      >
        <defs>
          <radialGradient id="v2glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.85" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ===================== PLAN (top-down) ===================== */}
        <text x={PLAN.left} y={PLAN.top - 12} className="v2-title">PLANTA · vista superior</text>
        {/* Stage floor + audience */}
        <rect x={planX(-1)} y={planY(STAGE_BACK)} width={planX(1) - planX(-1)} height={planY(STAGE_FRONT) - planY(STAGE_BACK)} className="v2-stage" />
        <text x={planX(0)} y={planY((STAGE_BACK + STAGE_FRONT) / 2)} className="v2-zone" textAnchor="middle">ESCENARIO</text>
        <line x1={planX(-1)} y1={planY(STAGE_FRONT)} x2={planX(1)} y2={planY(STAGE_FRONT)} className="v2-lip" />
        <text x={planX(0)} y={planY(AUD_FRONT + 2.5)} className="v2-zone" textAnchor="middle">PÚBLICO</text>

        {/* Trusses as depth lines across the stage width */}
        {trusses.map((t) => (
          <g key={`pt${t.id}`}>
            <line x1={planX(-1.02)} y1={planY(t.z)} x2={planX(1.02)} y2={planY(t.z)} className={`v2-truss${t.foh ? ' foh' : ''}`} />
            <text x={planX(-1.04)} y={planY(t.z) + 4} className="v2-trusslbl" textAnchor="end">{t.name}</text>
          </g>
        ))}

        {/* Fixtures — top view: X = stage width, Y = depth (which truss) */}
        {fixtures.map(({ pf, vs, t, hazer }) => {
          const onFloor = pf.floor !== false
          const cx = planX(pf.position.x)
          const cy = hazer && onFloor ? planY(-1) : planY(t.z)
          const selected = selection.includes(pf.id)
          if (hazer || !vs) {
            return (
              <g key={`pf${pf.id}`} className="v2-fx" onClick={(e) => { e.stopPropagation(); toggleSelect(pf.id) }}>
                <rect x={cx - 8} y={cy - 6} width={16} height={12} rx={2} fill="#2b2c33" stroke={selected ? 'var(--coral)' : '#4a4a58'} strokeWidth={selected ? 2.5 : 1.4} />
              </g>
            )
          }
          const { r, g, b } = vs.color
          const rgb = `rgb(${r},${g},${b})`
          const lit = vs.intensity > 0.01
          return (
            <g key={`pf${pf.id}`} className="v2-fx" onClick={(e) => { e.stopPropagation(); toggleSelect(pf.id) }}>
              {lit && <circle cx={cx} cy={cy} r={16 + vs.intensity * 26} fill={rgb} opacity={vs.intensity * (vs.strobing ? 0.3 : 0.5)} style={{ mixBlendMode: 'screen' }} />}
              {vs.pan !== undefined && lit && (
                <line x1={cx} y1={cy} x2={cx + Math.cos(((vs.pan - 90) * Math.PI) / 180) * 22} y2={cy + Math.sin(((vs.pan - 90) * Math.PI) / 180) * 22} stroke={rgb} strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
              )}
              <circle cx={cx} cy={cy} r={7} fill={lit ? rgb : '#2a2a34'} stroke={selected ? 'var(--coral)' : '#4a4a58'} strokeWidth={selected ? 2.5 : 1.4} />
              {selected && <text x={cx} y={cy - 12} className="v2-fxlbl sel" textAnchor="middle">{pf.name}</text>}
            </g>
          )
        })}

        {/* ===================== ELEVATION (side) ===================== */}
        <text x={ELEV.left} y={ELEV.top - 12} className="v2-title">ALZADO · vista lateral</text>
        {/* Floor + stage deck */}
        <line x1={ELEV.left} y1={elevY(0)} x2={ELEV.left + ELEV.w} y2={elevY(0)} className="v2-floor" />
        <rect x={ex(STAGE_BACK)} y={elevY(STAGE_TOP)} width={ex(STAGE_FRONT) - ex(STAGE_BACK)} height={elevY(0) - elevY(STAGE_TOP)} className="v2-stage" />
        <text x={ex((STAGE_BACK + STAGE_FRONT) / 2)} y={elevY(STAGE_TOP) + 18} className="v2-zone" textAnchor="middle">ESCENARIO</text>
        <text x={ex(AUD_FRONT + 3)} y={elevY(0) - 6} className="v2-zone" textAnchor="middle">PÚBLICO</text>

        {/* Trusses at their hang height; a beam drops to the deck */}
        {trusses.map((t) => (
          <g key={`et${t.id}`}>
            <rect x={ex(t.z) - 16} y={elevY(t.y) - 5} width={32} height={10} rx={2} className={`v2-truss-bar${t.foh ? ' foh' : ''}`} />
            <text x={ex(t.z)} y={elevY(t.y) - 10} className="v2-trusslbl" textAnchor="middle">{t.name}</text>
          </g>
        ))}

        {/* Fixtures — side view: X = depth, Y = hang height; beam drops down */}
        {fixtures.map(({ pf, vs, t, hazer }) => {
          const onFloor = pf.floor !== false
          const cx = hazer && onFloor ? ex(-1) : ex(t.z)
          const cy = hazer && onFloor ? elevY(0) : elevY(t.y)
          const selected = selection.includes(pf.id)
          if (hazer || !vs) {
            return (
              <g key={`ef${pf.id}`} className="v2-fx" onClick={(e) => { e.stopPropagation(); toggleSelect(pf.id) }}>
                <rect x={cx - 9} y={cy - 12} width={18} height={12} rx={2} fill="#2b2c33" stroke={selected ? 'var(--coral)' : '#4a4a58'} strokeWidth={selected ? 2.5 : 1.4} />
              </g>
            )
          }
          const { r, g, b } = vs.color
          const rgb = `rgb(${r},${g},${b})`
          const lit = vs.intensity > 0.01
          // Beam drops from the truss to the stage deck, tilted a touch by tilt value.
          const tiltShift = vs.tilt !== undefined ? ((vs.tilt - 0) / 90) * (ex(STAGE_FRONT) - ex(STAGE_BACK)) * 0.18 : 0
          const bx = cx + tiltShift
          const by = elevY(t.foh ? 0 : STAGE_TOP)
          return (
            <g key={`ef${pf.id}`} className="v2-fx" onClick={(e) => { e.stopPropagation(); toggleSelect(pf.id) }}>
              {lit && (
                <polygon
                  points={`${cx - 3},${cy} ${cx + 3},${cy} ${bx + 16},${by} ${bx - 16},${by}`}
                  fill={rgb}
                  opacity={vs.intensity * (vs.strobing ? 0.18 : 0.3)}
                  style={{ mixBlendMode: 'screen' }}
                />
              )}
              <circle cx={cx} cy={cy} r={6} fill={lit ? rgb : '#2a2a34'} stroke={selected ? 'var(--coral)' : '#4a4a58'} strokeWidth={selected ? 2.5 : 1.4} />
              {selected && <text x={cx} y={cy - 10} className="v2-fxlbl sel" textAnchor="middle">{pf.name}</text>}
            </g>
          )
        })}
      </svg>
      <button
        className="v2-sidetoggle"
        onClick={() => setFromRight((v) => !v)}
        title={t('visualizer.elevTip')}
      >
        {fromRight ? 'Alzado: desde la dcha ▶' : '◀ Alzado: desde la izq'}
      </button>
      {zoomed && (
        <button className="v2-reset" onClick={resetView} title={t('visualizer.resetView')}>
          ⤢ Reset view
        </button>
      )}
    </div>
  )
}
