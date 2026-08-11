import { useMemo, useState } from 'react'
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
      <svg viewBox={`0 0 ${W} ${H}`} onClick={() => select([])}>
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
        title="Alzado: lado desde el que se mira"
      >
        {fromRight ? 'Alzado: desde la dcha ▶' : '◀ Alzado: desde la izq'}
      </button>
    </div>
  )
}
