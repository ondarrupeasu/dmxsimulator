/**
 * SVG electrical breakers, traced from the Tartanga board detail photos (rcd-close / row-dimmers).
 * Standard DIN devices — magnetothermics (MCB), residual-current differentials (RCD) and the main
 * isolator. Vector so they stay crisp at any scale and animate when the interaction phase lands
 * (toggles rise when ON, drop when OFF).
 *
 * Details taken straight from the photos:
 *  - MCB: a thin BLUE bar along the very top edge across every pole; each pole's toggle is a pale
 *    cap with a dark rounded-SQUARE window in its centre, sitting in a dark recessed slot.
 *  - RCD: a wide two-module white box; the blue TEST button is a half-disc with its FLAT edge UP
 *    and the curve hanging DOWN, on the left module; the handle is a big smooth navy block (no
 *    hole) on the right module.
 */

const PW = 20 // pole width (viewBox units)
const PH = 78 // module height

/** A pale rocker toggle sitting in a dark slot, with a dark rounded-square window. up = ON. */
function Toggle({ cx, on, dark }: { cx: number; on: boolean; dark?: boolean }) {
  const capY = on ? 26 : 35
  const capFill = dark ? '#d7dade' : '#f4f5f7'
  return (
    <g>
      {/* recessed slot */}
      <rect x={cx - 6} y="24" width="12" height="22" rx="2" fill={dark ? '#141519' : '#2c2e34'} />
      {/* pale cap */}
      <rect x={cx - 5.5} y={capY} width="11" height="11" rx="1.6" fill={capFill} stroke={dark ? '#8b8e96' : '#a9adb6'} strokeWidth="0.6" />
      {/* dark rounded-square window in the cap */}
      <rect x={cx - 3.4} y={capY + 3} width="6.8" height="5" rx="1.4" fill="#1a1b20" />
    </g>
  )
}

/** One pole face: body, faint branding, and the label holder at the bottom. */
function PoleBody({ x, dark }: { x: number; dark?: boolean }) {
  return (
    <g transform={`translate(${x},0)`}>
      <rect x="0.5" y="0.5" width={PW - 1} height={PH - 1} rx="2" fill={dark ? '#34363e' : '#eceef1'} stroke={dark ? '#17181d' : '#b7bbc2'} strokeWidth="0.9" />
      {/* faint branding lines */}
      <rect x="3" y="14" width={PW - 8} height="1.1" rx="0.5" fill={dark ? '#4a4c54' : '#c8cbd2'} />
      <rect x="3" y="17.5" width={PW - 11} height="1.1" rx="0.5" fill={dark ? '#4a4c54' : '#c8cbd2'} />
      {/* label holder */}
      <rect x="2.5" y="56" width={PW - 5} height="16" rx="1.5" fill={dark ? '#1e1f25' : '#fbfcfd'} stroke={dark ? '#0e0f12' : '#c4c8cf'} strokeWidth="0.6" />
    </g>
  )
}

type MCBProps = { poles?: number; on?: boolean; dark?: boolean }

/** Magnetothermic breaker (MCB), 1-4 poles under a common thin blue top bar. */
export function MCB({ poles = 1, on = true, dark }: MCBProps) {
  const totalW = poles * PW
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      {Array.from({ length: poles }).map((_, i) => (
        <PoleBody key={i} x={i * PW} dark={dark} />
      ))}
      {Array.from({ length: poles }).map((_, i) => (
        <Toggle key={i} cx={i * PW + PW / 2} on={on} dark={dark} />
      ))}
      {/* thin blue bar along the very top edge, across every pole */}
      <rect x="1.5" y="2" width={totalW - 3} height="3.6" rx="1.4" fill="#2f52d8" stroke="#1c34a0" strokeWidth="0.4" />
    </svg>
  )
}

/**
 * Residual-current device (differential): a wide two-module white box. Blue TEST half-disc (flat
 * edge up, curve down) on the left module; a big smooth navy handle on the right module.
 */
export function RCD({ on = true }: { on?: boolean }) {
  const totalW = 2 * PW
  const handleY = on ? 25 : 34
  const domeCx = PW / 2
  const r = 5.6
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      {/* box */}
      <rect x="0.5" y="0.5" width={totalW - 1} height={PH - 1} rx="2" fill="#f2f3f5" stroke="#b7bbc2" strokeWidth="0.9" />
      {/* brand seam */}
      <line x1="0.5" y1="13" x2={totalW - 0.5} y2="13" stroke="#c9ccd3" strokeWidth="0.8" />
      <circle cx={PW + 4} cy="10" r="1.4" fill="#6f7783" />
      {/* blue TEST half-disc — FLAT edge up, curve hanging down */}
      <path d={`M ${domeCx - r} 8 A ${r} ${r} 0 0 0 ${domeCx + r} 8 Z`} fill="#2f52d8" stroke="#1b34a0" strokeWidth="0.7" />
      <path d={`M ${domeCx - r + 1} 8 A ${r - 1} ${r - 1} 0 0 0 ${domeCx + r - 1} 8`} fill="none" stroke="#7a92ef" strokeWidth="0.8" opacity="0.7" />
      {/* faint printed text on the left module */}
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x="3.5" y={24 + k * 4} width={PW - 8} height="1.4" rx="0.6" fill="#c6cad1" />
      ))}
      {/* N logo hint bottom-left */}
      <rect x={domeCx - 3} y="64" width="6" height="7" rx="1" fill="none" stroke="#3a3d44" strokeWidth="1" />
      {/* right module: dark slot + big smooth navy handle (no hole) */}
      <rect x={PW + PW / 2 - 7} y="22" width="14" height="26" rx="2.5" fill="#2c2e34" />
      <rect x={PW + PW / 2 - 6} y={handleY} width="12" height="15" rx="2" fill="#26326f" stroke="#12142a" strokeWidth="0.7" />
      <rect x={PW + PW / 2 - 4.5} y={handleY + 1.5} width="3" height="12" rx="1.2" fill="#3d4d97" opacity="0.8" />
      {/* small indicator window below the handle */}
      <rect x={PW + PW / 2 - 3} y="50" width="6" height="2.4" rx="0.8" fill="#1a1b20" />
      {/* label holder */}
      <rect x={PW + 2.5} y="56" width={PW - 5} height="16" rx="1.5" fill="#fbfcfd" stroke="#c4c8cf" strokeWidth="0.6" />
    </svg>
  )
}

/** Compact single-pole channel breaker for the dimmer units (a small toggle, up = ON). */
export function ChannelBreaker({ on = true }: { on?: boolean }) {
  const capY = on ? 8 : 18
  return (
    <svg viewBox="0 0 14 40" className="pw-svg">
      <rect x="0.5" y="0.5" width="13" height="39" rx="2" fill="#eceef1" stroke="#b7bbc2" strokeWidth="0.8" />
      <rect x="2" y="2" width="10" height="2.4" rx="1" fill="#2f52d8" />
      <rect x="3" y="7" width="8" height="20" rx="1.6" fill="#2c2e34" />
      <rect x="3.4" y={capY} width="7.2" height="8" rx="1.2" fill="#f4f5f7" stroke="#a9adb6" strokeWidth="0.5" />
      <rect x="5" y={capY + 2.4} width="4" height="3.4" rx="0.9" fill="#1a1b20" />
    </svg>
  )
}

/** Main isolator (GENERAL): a black-bezel 4-pole switch with a common grey top bar. */
export function MainSwitch({ on = true }: { on?: boolean }) {
  const poles = 4
  const totalW = poles * PW
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      {Array.from({ length: poles }).map((_, i) => (
        <PoleBody key={i} x={i * PW} dark />
      ))}
      {Array.from({ length: poles }).map((_, i) => (
        <Toggle key={i} cx={i * PW + PW / 2} on={on} dark />
      ))}
      <rect x="1.5" y="2" width={totalW - 3} height="3.6" rx="1.4" fill="#6a6d75" stroke="#2a2c33" strokeWidth="0.4" />
    </svg>
  )
}
