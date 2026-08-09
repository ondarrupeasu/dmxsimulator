import { useMemo } from 'react'
import { useShowStore, useEffectiveProgrammer } from '../../store/showStore'
import { computeFixtureOutputs } from '../../engine/dmx'
import { computeVisualState } from '../../engine/render'

const W = 1000
const H = 600

/** Map a fixture's normalized position (-1..1) to SVG coordinates. */
function place(x: number, y: number): { cx: number; cy: number } {
  return { cx: (x * 0.45 + 0.5) * W, cy: (0.5 - y * 0.42) * H }
}

export function Visualizer2D() {
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const effective = useEffectiveProgrammer()
  const selection = useShowStore((s) => s.selection)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const select = useShowStore((s) => s.select)

  const outputs = useMemo(
    () => computeFixtureOutputs(show, definitions, effective),
    [show, definitions, effective],
  )
  const byId = useMemo(
    () => Object.fromEntries(outputs.map((o) => [o.instanceId, o.values])),
    [outputs],
  )

  return (
    <div className="stage">
      <svg viewBox={`0 0 ${W} ${H}`} onClick={() => select([])}>
        <defs>
          <radialGradient id="beam" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {show.fixtures.map((pf) => {
          const def = definitions[pf.definitionId]
          if (!def) return null
          const values = byId[pf.id] ?? []
          const vs = computeVisualState(def, pf.modeIndex, values)
          const { cx, cy } = place(pf.position.x, pf.position.y)
          const { r, g, b } = vs.color
          const rgb = `rgb(${r},${g},${b})`
          const selected = selection.includes(pf.id)
          const glowR = 40 + vs.intensity * 90

          // Pan indicator for moving heads (short line from the fixture body).
          let beamLine = null
          if (vs.pan !== undefined) {
            const ang = ((vs.pan - 90) * Math.PI) / 180
            const len = 26
            beamLine = (
              <line
                x1={cx}
                y1={cy}
                x2={cx + Math.cos(ang) * len}
                y2={cy + Math.sin(ang) * len}
                stroke={rgb}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.6 + vs.intensity * 0.4}
              />
            )
          }

          return (
            <g
              key={pf.id}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                toggleSelect(pf.id)
              }}
            >
              {vs.intensity > 0.01 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={glowR}
                  fill={rgb}
                  opacity={vs.intensity * (vs.strobing ? 0.28 : 0.5)}
                  style={{ mixBlendMode: 'screen' }}
                />
              )}
              {vs.intensity > 0.01 && (
                <circle cx={cx} cy={cy} r={glowR * 0.4} fill="url(#beam)" opacity={vs.intensity} />
              )}
              {/* Fixture body */}
              <circle
                cx={cx}
                cy={cy}
                r={13}
                fill={vs.intensity > 0.01 ? rgb : '#2a2a34'}
                stroke={selected ? 'var(--coral)' : '#4a4a58'}
                strokeWidth={selected ? 3 : 1.5}
              />
              {beamLine}
              <text
                x={cx}
                y={cy + 30}
                textAnchor="middle"
                fontSize={13}
                fill={selected ? 'var(--coral)' : 'var(--text-faint)'}
              >
                {pf.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
