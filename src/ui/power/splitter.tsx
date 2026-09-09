/**
 * TINHAO S4 DMX splitter, traced from the Tartanga photo: a black panel with one DMX IN and four
 * DMX OUT (5-pin XLR), status LEDs (DMX IN + per-output green, POWER red). It's the DATA side of the
 * rig — the Quartz desk's DMX feeds this, and each OUT drives one lighting bar.
 *
 * Physically it lives BEHIND the patch racks (noted in the scene caption).
 */

/** A 5-pin female XLR chassis connector (as on the S4 in/out). */
function Xlr({ x, y, r = 24 }: { x: number; y: number; r?: number }) {
  // 5-pin layout: two upper, two lower, one centre
  const p = r * 0.34
  const holes = [
    [0, -p], [-p, -p * 0.35], [p, -p * 0.35], [-p * 0.6, p * 0.7], [p * 0.6, p * 0.7],
  ]
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={r} fill="#0c0c0e" stroke="#3a3c42" strokeWidth="1.5" />
      <circle r={r - 3} fill="#17181b" stroke="#2a2b30" strokeWidth="1" />
      {/* keyway notch at top */}
      <rect x={-3} y={-r + 2.5} width="6" height="5" rx="1.5" fill="#0a0a0c" />
      {/* female insert */}
      <circle r={r * 0.62} fill="#25272c" stroke="#3d3f45" strokeWidth="1" />
      {holes.map(([hx, hy], i) => (
        <circle key={i} cx={hx} cy={hy} r={r * 0.11} fill="#0b0b0d" stroke="#45474d" strokeWidth="0.6" />
      ))}
    </g>
  )
}

/** A status LED (lit when powered). */
function Led({ x, y, color, on = true }: { x: number; y: number; color: string; on?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {on && <circle r="7.5" fill={color} opacity="0.28" />}
      <circle r="3.6" fill={on ? color : '#2a2c30'} stroke="#0a0a0c" strokeWidth="0.8" />
      {on && <circle cx="-1" cy="-1" r="1.2" fill="#ffffff" opacity="0.7" />}
    </g>
  )
}

const GREEN = '#37d46a'
const RED = '#ff3b3b'

/** The full S4 splitter panel. */
export function S4Splitter() {
  const outs = [1, 2, 3, 4]
  return (
    <svg viewBox="0 0 360 300" width="360" height="300" className="pw-s4">
      {/* panel */}
      <rect x="2" y="2" width="356" height="296" rx="8" fill="#101114" stroke="#2b2d33" strokeWidth="2" />
      <rect x="2" y="2" width="356" height="30" rx="8" fill="#16171b" />
      {/* brand */}
      <text x="24" y="40" fill="#f2f3f5" fontSize="26" fontWeight="800" fontFamily="system-ui" letterSpacing="1.5">TINHAO</text>
      <text x="300" y="42" fill="#e6e7ea" fontSize="24" fontStyle="italic" fontWeight="800" fontFamily="system-ui" textAnchor="middle">S4</text>
      <text x="300" y="55" fill="#9aa0aa" fontSize="8" fontWeight="700" fontFamily="system-ui" textAnchor="middle" letterSpacing="1">LIGHTING</text>

      {/* DMX IN */}
      <Xlr x={150} y={96} r={26} />
      <line x1="120" y1="140" x2="180" y2="140" stroke="#4a4c52" strokeWidth="1" />
      <line x1="150" y1="128" x2="150" y2="140" stroke="#4a4c52" strokeWidth="1" />
      <Led x={120} y={150} color={GREEN} />
      <text x="150" y="166" fill="#dfe1e4" fontSize="13" fontWeight="700" fontFamily="system-ui" textAnchor="middle" letterSpacing="1">DMX IN</text>

      {/* POWER (label to the left of the LED so it stays inside the panel) */}
      <text x="294" y="154" fill="#dfe1e4" fontSize="13" fontWeight="700" fontFamily="system-ui" textAnchor="end" letterSpacing="0.5">POWER</text>
      <Led x={306} y={150} color={RED} />

      {/* DMX OUT 1-4 */}
      {outs.map((n, i) => {
        const x = 64 + i * 80
        return (
          <g key={n}>
            <text x={x} y="212" fill="#dfe1e4" fontSize="11.5" fontWeight="700" fontFamily="system-ui" textAnchor="middle" letterSpacing="0.5">DMX OUT</text>
            <text x={x} y="224" fill="#dfe1e4" fontSize="11.5" fontWeight="700" fontFamily="system-ui" textAnchor="middle">{n}</text>
            <Led x={x + 22} y={232} color={GREEN} />
            <Xlr x={x} y={258} r={22} />
          </g>
        )
      })}
    </svg>
  )
}
