/**
 * SVG Neutrik powerCON chassis receptacles, drawn from the Tartanga rack detail photos:
 * a square flange with two diagonal screws (top-left + bottom-right), a raised black round
 * boss with a keyway, in white (CANALES / DIRECTOS) and blue (CIRCUITOS) variants, plus a
 * capped/blanked variant for the unused positions.
 */

type PconProps = { color?: 'white' | 'blue'; capped?: boolean }

export function PowerCon({ color = 'white', capped = false }: PconProps) {
  if (capped) {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" className="pw-svg pw-pcon-svg">
        <rect x="1.5" y="1.5" width="21" height="21" rx="2.5" fill="#26282d" stroke="#141519" strokeWidth="1" />
        <circle cx="12" cy="12" r="7" fill="#1a1b1f" stroke="#0e0f12" strokeWidth="1" />
        <circle cx="12" cy="12" r="3.2" fill="#242529" />
      </svg>
    )
  }
  const flange = color === 'blue' ? '#3f5bcb' : '#e2e4e7'
  const flangeEdge = color === 'blue' ? '#2740a3' : '#b7bbc2'
  const flangeHi = color === 'blue' ? '#5f78d8' : '#f4f5f7'
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" className="pw-svg pw-pcon-svg">
      <defs>
        <radialGradient id={`boss-${color}`} cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#3a3c42" />
          <stop offset="0.6" stopColor="#1e1f24" />
          <stop offset="1" stopColor="#111216" />
        </radialGradient>
      </defs>
      {/* square flange */}
      <rect x="1.5" y="1.5" width="21" height="21" rx="2.5" fill={flange} stroke={flangeEdge} strokeWidth="1" />
      <rect x="2.4" y="2.4" width="19.2" height="6" rx="2" fill={flangeHi} opacity="0.5" />
      {/* diagonal screws */}
      <circle cx="5.4" cy="5.4" r="1.7" fill="#8a8d94" stroke="#5a5c62" strokeWidth="0.5" />
      <line x1="4.5" y1="5.4" x2="6.3" y2="5.4" stroke="#3d3f45" strokeWidth="0.5" />
      <circle cx="18.6" cy="18.6" r="1.7" fill="#8a8d94" stroke="#5a5c62" strokeWidth="0.5" />
      <line x1="17.7" y1="18.6" x2="19.5" y2="18.6" stroke="#3d3f45" strokeWidth="0.5" />
      {/* raised black boss */}
      <circle cx="12" cy="12" r="7.2" fill={`url(#boss-${color})`} stroke="#0e0f12" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="#4c4e55" strokeWidth="0.8" />
      {/* keyway notch (lower-right of the ring) */}
      <rect x="14.4" y="13.4" width="2.6" height="1.8" rx="0.4" transform="rotate(45 15.7 14.3)" fill="#0c0d10" />
      {/* centre hub */}
      <circle cx="12" cy="12" r="2.3" fill="#2b2d33" stroke="#4c4e55" strokeWidth="0.5" />
      <circle cx="11.4" cy="11.4" r="0.7" fill="#54565d" />
    </svg>
  )
}
