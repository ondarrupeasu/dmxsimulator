/**
 * SVG electrical breakers drawn from the Tartanga board detail photos: standard DIN devices —
 * magnetothermics (MCB), residual-current differentials (RCD) and the main isolator. Vector so
 * they stay crisp at any scale and can be animated when the interaction phase lands (levers rise
 * when ON, drop when OFF).
 *
 * Signature detail from the photos: each lever is a small pale square with a dark round hole in
 * its centre; multi-pole devices join their levers under one common tie-bar (blue on the MCBs).
 */

const PW = 18 // pole width (viewBox units)
const PH = 76 // module height

/** One pole face: body, branding seam, label window and a holed lever. */
function Pole({ x, on, dark, blueLever }: { x: number; on: boolean; dark?: boolean; blueLever?: boolean }) {
  const bodyFill = dark ? '#33353d' : '#eceef1'
  const bodyEdge = dark ? '#15161b' : '#b7bbc2'
  const leverFill = blueLever ? '#3f5cc8' : dark ? '#c9ccd3' : '#f6f7f9'
  const leverEdge = blueLever ? '#233a94' : dark ? '#6a6d75' : '#9297a1'
  const leverY = on ? 12 : 26 // up = ON
  return (
    <g transform={`translate(${x},0)`}>
      <rect x="0.6" y="0.6" width={PW - 1.2} height={PH - 1.2} rx="2.5" fill={bodyFill} stroke={bodyEdge} strokeWidth="1" />
      {/* window recess the lever travels in */}
      <rect x={PW / 2 - 4.5} y="9" width="9" height="24" rx="2" fill={dark ? '#1b1c21' : '#3a3d44'} />
      {/* branding seam + label holder */}
      <rect x="2" y="40" width={PW - 4} height="1.4" rx="0.7" fill={dark ? '#15161b' : '#c9ccd3'} />
      <rect x="2.5" y="52" width={PW - 5} height="13" rx="1.5" fill={dark ? '#1c1d22' : '#fbfcfd'} stroke={dark ? '#0e0f12' : '#c4c8cf'} strokeWidth="0.6" />
      {/* holed lever */}
      <rect x={PW / 2 - 4} y={leverY} width="8" height="9" rx="1.4" fill={leverFill} stroke={leverEdge} strokeWidth="0.7" />
      <circle cx={PW / 2} cy={leverY + 4.5} r="1.6" fill={dark ? '#0e0f12' : '#2b2d33'} />
    </g>
  )
}

type MCBProps = { poles?: number; on?: boolean; dark?: boolean }

/** Magnetothermic breaker (MCB), 1-4 poles joined under a common blue tie-bar. */
export function MCB({ poles = 1, on = true, dark }: MCBProps) {
  const totalW = poles * PW
  const leverY = on ? 12 : 26
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      {Array.from({ length: poles }).map((_, i) => (
        <Pole key={i} x={i * PW} on={on} dark={dark} />
      ))}
      {poles > 1 && (
        <rect x="2.5" y={leverY - 3.5} width={totalW - 5} height="4.5" rx="2.2" fill="#3f5cc8" stroke="#233a94" strokeWidth="0.6" />
      )}
    </svg>
  )
}

/**
 * Residual-current device (differential): a wide two-module white box with the blue half-dome
 * TEST button on top, printed text on the left, and a blue holed handle on the right pole.
 */
export function RCD({ on = true }: { on?: boolean }) {
  const totalW = 2 * PW
  const leverY = on ? 12 : 26
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      {/* box */}
      <rect x="0.6" y="0.6" width={totalW - 1.2} height={PH - 1.2} rx="2.5" fill="#f2f3f5" stroke="#b7bbc2" strokeWidth="1" />
      <line x1="0.6" y1="41" x2={totalW - 0.6} y2="41" stroke="#c9ccd3" strokeWidth="0.8" />
      {/* blue half-dome TEST button on top */}
      <path d={`M ${PW - 5.5} 8 a 5.5 5.5 0 0 1 11 0 z`} fill="#2f52d8" stroke="#1b34a0" strokeWidth="0.7" />
      <ellipse cx={PW} cy="7.8" rx="3.4" ry="1.4" fill="#5f7ce6" opacity="0.6" />
      {/* printed text hint on the left module */}
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x="3.5" y={22 + k * 4} width={PW - 8} height="1.5" rx="0.7" fill="#c3c7cf" />
      ))}
      {/* right module: window + blue holed handle */}
      <rect x={PW + PW / 2 - 4.5} y="9" width="9" height="24" rx="2" fill="#3a3d44" />
      <rect x={PW + PW / 2 - 4} y={leverY} width="8" height="9" rx="1.4" fill="#3f5cc8" stroke="#233a94" strokeWidth="0.7" />
      <circle cx={PW + PW / 2} cy={leverY + 4.5} r="1.6" fill="#12142a" />
      {/* label holder bottom-right */}
      <rect x={PW + 2.5} y="52" width={PW - 5} height="13" rx="1.5" fill="#fbfcfd" stroke="#c4c8cf" strokeWidth="0.6" />
    </svg>
  )
}

/** Compact single-pole channel breaker for the dimmer units (a small toggle, up = ON). */
export function ChannelBreaker({ on = true }: { on?: boolean }) {
  const leverY = on ? 9 : 21
  return (
    <svg viewBox="0 0 14 40" className="pw-svg">
      <rect x="0.5" y="0.5" width="13" height="39" rx="2" fill="#eceef1" stroke="#b7bbc2" strokeWidth="0.8" />
      <rect x="3" y="6" width="8" height="19" rx="1.6" fill="#3a3d44" />
      <rect x="3.3" y={leverY} width="7.4" height="8" rx="1.2" fill="#f6f7f9" stroke="#9297a1" strokeWidth="0.6" />
      <circle cx="7" cy={leverY + 4} r="1.4" fill="#2b2d33" />
    </svg>
  )
}

/** Main isolator (GENERAL): a black-bezel 4-pole switch with a common handle. */
export function MainSwitch({ on = true }: { on?: boolean }) {
  const poles = 4
  const totalW = poles * PW
  const leverY = on ? 12 : 26
  return (
    <svg viewBox={`0 0 ${totalW} ${PH}`} width={totalW} height={PH} className="pw-svg">
      {Array.from({ length: poles }).map((_, i) => (
        <Pole key={i} x={i * PW} on={on} dark />
      ))}
      <rect x="2.5" y={leverY - 3.5} width={totalW - 5} height="4.5" rx="2.2" fill="#6a6d75" stroke="#2a2c33" strokeWidth="0.6" />
    </svg>
  )
}
