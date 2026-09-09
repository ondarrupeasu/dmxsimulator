/**
 * SVG electrical breakers, traced from the Tartanga board detail photos (rcd-close / row-dimmers).
 * Standard DIN devices — magnetothermics (MCB), residual-current differentials (RCD, two models) and
 * the main isolator. Vector so they stay crisp at any scale and animate when toggled: the handle
 * rises (ON) / drops (OFF), and the exposed part of the window shows "I" (on) or "0" (off).
 *
 * Bodies are a warm off-white/cream, like the real aged DIN gear.
 */

const PW = 30 // pole width (viewBox units)
const PH = 78 // module height

const CREAM = '#e4dfd0' // breaker body
const CREAM_HI = '#efe9da' // label holder
const CREAM_EDGE = '#b3ad9b'
const CREAM_SEAM = '#c7c1af'

/** One breaker body: casing, faint branding, and the bottom label holder. */
function PoleBody({ x, dark }: { x: number; dark?: boolean }) {
  return (
    <g transform={`translate(${x},0)`}>
      <rect x="0.5" y="0.5" width={PW - 1} height={PH - 1} rx="2.5" fill={dark ? '#33353e' : CREAM} stroke={dark ? '#17181d' : CREAM_EDGE} strokeWidth="0.9" />
      <rect x="4" y="14" width={PW - 12} height="1.2" rx="0.5" fill={dark ? '#4a4c54' : CREAM_SEAM} />
      <rect x="4" y="17.5" width={PW - 17} height="1.2" rx="0.5" fill={dark ? '#4a4c54' : CREAM_SEAM} />
      <rect x="3.5" y="56" width={PW - 7} height="16" rx="1.5" fill={dark ? '#1e1f25' : CREAM_HI} stroke={dark ? '#0e0f12' : CREAM_EDGE} strokeWidth="0.6" />
    </g>
  )
}

/** The united handle: one dark slot + one pale bar spanning the poles + a per-pole window, with the
 *  exposed slot showing "I" (on) below the handle or "0" (off) above it. */
function Handle({ poles, on, dark }: { poles: number; on: boolean; dark?: boolean }) {
  const totalW = poles * PW
  const capY = on ? 25 : 36
  const capFill = dark ? '#d7dade' : '#f2efe6'
  return (
    <g>
      <rect x="3" y="23" width={totalW - 6} height="23" rx="3" fill={dark ? '#141519' : '#2b2d33'} />
      {/* I / 0 markings in the exposed part of the slot */}
      {Array.from({ length: poles }).map((_, i) => (
        <text key={`m${i}`} x={i * PW + PW / 2} y={on ? 43.5 : 31} textAnchor="middle" fontSize="6.5" fontWeight="700" fontFamily="system-ui" fill="#c9ced6">{on ? 'I' : '0'}</text>
      ))}
      <rect x="4.5" y={capY} width={totalW - 9} height="12.5" rx="2.2" fill={capFill} stroke={dark ? '#8b8e96' : '#a5a196'} strokeWidth="0.7" />
      {Array.from({ length: poles }).map((_, i) => (
        <rect key={i} x={i * PW + PW / 2 - 5} y={capY + 3.6} width="10" height="5.4" rx="1.4" fill="#191a1f" />
      ))}
    </g>
  )
}

type MCBProps = { poles?: number; on?: boolean; dark?: boolean }

/** Magnetothermic breaker (MCB), 1-4 poles under one united handle + a thin blue top bar. */
export function MCB({ poles = 1, on = true, dark }: MCBProps) {
  const totalW = poles * PW
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      {Array.from({ length: poles }).map((_, i) => (
        <PoleBody key={i} x={i * PW} dark={dark} />
      ))}
      <Handle poles={poles} on={on} dark={dark} />
      <rect x="1.5" y="2" width={totalW - 3} height="4" rx="1.6" fill="#2f52d8" stroke="#1c34a0" strokeWidth="0.4" />
    </svg>
  )
}

/** Main isolator (GENERAL): a black-bezel 4-pole switch, united handle, grey top bar. */
export function MainSwitch({ on = true }: { on?: boolean }) {
  const poles = 4
  const totalW = poles * PW
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      {Array.from({ length: poles }).map((_, i) => (
        <PoleBody key={i} x={i * PW} dark />
      ))}
      <Handle poles={poles} on={on} dark />
      <rect x="1.5" y="2" width={totalW - 3} height="4" rx="1.6" fill="#6a6d75" stroke="#2a2c33" strokeWidth="0.4" />
    </svg>
  )
}

/**
 * Residual-current device (differential), half-dome model (DIMMERS / SOINUA): blue TEST half-disc
 * (flat edge up, curve down) on the left; a big smooth navy handle on the right; red on-indicator.
 * The TEST button trips it (onTest) — it only ever switches OFF.
 */
export function RCD({ on = true, onTest }: { on?: boolean; onTest?: () => void }) {
  const totalW = 2 * PW
  const handleY = on ? 24 : 35
  const lx = PW / 2, rx = PW + PW / 2, r = 7
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      <rect x="0.5" y="0.5" width={totalW - 1} height={PH - 1} rx="2.5" fill={CREAM} stroke={CREAM_EDGE} strokeWidth="0.9" />
      <line x1="0.5" y1="13" x2={totalW - 0.5} y2="13" stroke={CREAM_SEAM} strokeWidth="0.8" />
      <circle cx={PW + 5} cy="10" r="1.5" fill="#8a8477" />
      {/* blue TEST half-disc — trips the RCD */}
      <g className="pw-testbtn" onClick={onTest ? (e) => { e.stopPropagation(); onTest() } : undefined}>
        <path d={`M ${lx - r} 8 A ${r} ${r} 0 0 0 ${lx + r} 8 Z`} fill="#2f52d8" stroke="#1b34a0" strokeWidth="0.7" />
        <path d={`M ${lx - r + 1.2} 8 A ${r - 1.2} ${r - 1.2} 0 0 0 ${lx + r - 1.2} 8`} fill="none" stroke="#7a92ef" strokeWidth="0.9" opacity="0.7" />
      </g>
      {[0, 1, 2, 3].map((kk) => (
        <rect key={kk} x="4.5" y={24 + kk * 4} width={PW - 11} height="1.5" rx="0.6" fill={CREAM_SEAM} />
      ))}
      <rect x={lx - 3.5} y="63" width="7" height="8" rx="1" fill="none" stroke="#3a3d44" strokeWidth="1.1" />
      {/* right module: dark slot + big smooth navy handle (no hole) */}
      <rect x={rx - 10} y="22" width="20" height="26" rx="3" fill="#2b2d33" />
      <rect x={rx - 9} y={handleY} width="18" height="15" rx="2.4" fill="#26326f" stroke="#12142a" strokeWidth="0.8" />
      <rect x={rx - 7} y={handleY + 1.6} width="4" height="12" rx="1.4" fill="#3d4d97" opacity="0.8" />
      {/* on-indicator (red when energised) */}
      <rect x={rx - 4} y="50" width="8" height="2.8" rx="0.9" fill={on ? '#e5372a' : '#191a1f'} />
      <rect x={PW + 3.5} y="56" width={PW - 7} height="16" rx="1.5" fill={CREAM_HI} stroke={CREAM_EDGE} strokeWidth="0.6" />
    </svg>
  )
}

/**
 * Residual-current device (differential), Hager model (FUERZA / EMERGENCIA): lever on the LEFT, a
 * thin blue rectangular TEST button, and a red on-indicator above the lever. TEST trips it (OFF).
 */
export function RCDHager({ on = true, onTest }: { on?: boolean; onTest?: () => void }) {
  const totalW = 2 * PW
  const leverY = on ? 24 : 35
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      <rect x="0.5" y="0.5" width={totalW - 1} height={PH - 1} rx="2.5" fill="#e7e2d4" stroke={CREAM_EDGE} strokeWidth="0.9" />
      <rect x="1.5" y="2" width={totalW - 3} height="4.5" rx="1.6" fill="#3b73c4" stroke="#255196" strokeWidth="0.4" />
      {/* red on-indicator above the lever */}
      <rect x="5" y="12.5" width="10" height="4.2" rx="1" fill={on ? '#e5372a' : '#3a2422'} stroke="#1c1512" strokeWidth="0.4" />
      {on && <rect x="6" y="13.2" width="4" height="1.4" rx="0.7" fill="#ffb0a6" opacity="0.8" />}
      {/* dark slot + grey lever on the LEFT */}
      <rect x="4" y="22" width="11" height="24" rx="2.5" fill="#2b2d33" />
      <rect x="4.8" y={leverY} width="9.4" height="12" rx="1.8" fill="#e7e4da" stroke="#9b968b" strokeWidth="0.7" />
      <rect x="6.4" y={leverY + 3} width="6" height="6" rx="1.2" fill="#20222a" />
      {/* thin blue rectangular TEST button — trips it */}
      <g className="pw-testbtn" onClick={onTest ? (e) => { e.stopPropagation(); onTest() } : undefined}>
        <rect x="25" y="16.5" width="14" height="7.5" rx="1.8" fill="#2f52d8" stroke="#1b34a0" strokeWidth="0.6" />
        <rect x="26.5" y="18" width="7" height="1.6" rx="0.7" fill="#7f97e8" opacity="0.7" />
      </g>
      {[0, 1, 2].map((kk) => (
        <rect key={kk} x={PW + 5} y={22 + kk * 4} width={PW - 12} height="1.5" rx="0.6" fill={CREAM_SEAM} />
      ))}
      <rect x="3.5" y="56" width={PW - 7} height="16" rx="1.5" fill={CREAM_HI} stroke={CREAM_EDGE} strokeWidth="0.6" />
      <rect x={PW + 3.5} y="56" width={PW - 7} height="16" rx="1.5" fill={CREAM_HI} stroke={CREAM_EDGE} strokeWidth="0.6" />
    </svg>
  )
}

/** Compact single-pole channel breaker for the dimmer units (a small toggle, up = ON). */
export function ChannelBreaker({ on = true }: { on?: boolean }) {
  const capY = on ? 8 : 18
  return (
    <svg viewBox="0 0 14 40" className="pw-svg">
      <rect x="0.5" y="0.5" width="13" height="39" rx="2" fill={CREAM} stroke={CREAM_EDGE} strokeWidth="0.8" />
      <rect x="2" y="2" width="10" height="2.4" rx="1" fill="#d23a2a" />
      <rect x="3" y="7" width="8" height="20" rx="1.6" fill="#2b2d33" />
      <rect x="3.4" y={capY} width="7.2" height="8" rx="1.2" fill="#f2efe6" stroke="#a5a196" strokeWidth="0.5" />
      <rect x="5" y={capY + 2.4} width="4" height="3.4" rx="0.9" fill="#191a1f" />
    </svg>
  )
}
