/**
 * TINHAO S4 DMX splitter, traced from the Tartanga photo: a black panel with a DMX IN pair and four
 * DMX OUT (5-pin XLR), status LEDs above their labels (green for DMX IN and each output, red POWER).
 * It's the DATA side of the rig — the Quartz desk's DMX feeds this, and each OUT drives one bar.
 *
 * As in the photo: of the two DMX IN sockets the left is free and the right has a cable; of the four
 * DMX OUT, #1 is free and #2/#3/#4 are patched. Physically it lives behind the patch racks.
 */

/** A 5-pin female XLR chassis connector. */
function Xlr({ x, y, r = 20 }: { x: number; y: number; r?: number }) {
  const p = r * 0.34
  const holes = [
    [0, -p], [-p, -p * 0.35], [p, -p * 0.35], [-p * 0.6, p * 0.7], [p * 0.6, p * 0.7],
  ]
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={r} fill="#0c0c0e" stroke="#3a3c42" strokeWidth="1.5" />
      <circle r={r - 3} fill="#17181b" stroke="#2a2b30" strokeWidth="1" />
      <rect x={-3} y={-r + 2.5} width="6" height="5" rx="1.5" fill="#0a0a0c" />
      <circle r={r * 0.62} fill="#25272c" stroke="#3d3f45" strokeWidth="1" />
      {holes.map(([hx, hy], i) => (
        <circle key={i} cx={hx} cy={hy} r={r * 0.11} fill="#0b0b0d" stroke="#45474d" strokeWidth="0.6" />
      ))}
    </g>
  )
}

/** A male XLR cable plug inserted into a socket, with a short cable stub going up or down. */
function XlrPlug({ x, y, dir }: { x: number; y: number; dir: 'up' | 'down' }) {
  const s = dir === 'down' ? 1 : -1
  return (
    <g transform={`translate(${x},${y})`}>
      {/* cable stub */}
      <path d={`M 0 0 C ${6 * s} ${20 * s}, ${-8 * s} ${30 * s}, ${2 * s} ${46 * s}`} fill="none" stroke="#2f4bc0" strokeWidth="6" strokeLinecap="round" />
      {/* plug barrel + boot */}
      <circle r="15" fill="#33353c" stroke="#17181b" strokeWidth="1.5" />
      <circle r="9" fill="#1c1d21" stroke="#0d0e10" strokeWidth="1" />
      <rect x="-7" y={dir === 'down' ? 12 : -20} width="14" height="9" rx="3" fill="#2a3c8f" />
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

      {/* DMX IN — two sockets (left free, right patched); green LED above the label */}
      <Xlr x={116} y={86} />
      <Xlr x={168} y={86} />
      <XlrPlug x={168} y={86} dir="up" />
      <Led x={142} y={118} color={GREEN} />
      <text x="142" y="134" fill="#dfe1e4" fontSize="13" fontWeight="700" fontFamily="system-ui" textAnchor="middle" letterSpacing="1">DMX IN</text>

      {/* POWER — red LED above the label */}
      <Led x={306} y={96} color={RED} />
      <text x="306" y="114" fill="#dfe1e4" fontSize="13" fontWeight="700" fontFamily="system-ui" textAnchor="middle" letterSpacing="0.5">POWER</text>

      {/* DMX OUT 1-4 — #1 free, #2/#3/#4 patched */}
      {outs.map((n, i) => {
        const x = 66 + i * 76
        return (
          <g key={n}>
            <text x={x} y="206" fill="#dfe1e4" fontSize="11" fontWeight="700" fontFamily="system-ui" textAnchor="middle" letterSpacing="0.5">DMX OUT</text>
            <text x={x} y="218" fill="#dfe1e4" fontSize="11" fontWeight="700" fontFamily="system-ui" textAnchor="middle">{n}</text>
            <Led x={x} y={232} color={GREEN} />
            <Xlr x={x} y={262} />
            {n !== 1 && <XlrPlug x={x} y={262} dir="down" />}
          </g>
        )
      })}
    </svg>
  )
}
