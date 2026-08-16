import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** A tiny POLAR pad to AIM a non-moving fixture (a PAR, profile…) — drag to point it, like
 *  angling it by hand on the truss. The CENTRE is straight down; drag toward where you want it
 *  to point. Distance from centre = tilt 0..90° (the EDGE is horizontal — it can't point above
 *  the horizon, like a real hung fixture); the drag direction is the pan (360°, free). Not a
 *  DMX attribute (the desk can't move these); watch the beam swing in the 3D viewer. */
export function AimPad({ pan, tilt, onChange }: { pan: number; tilt: number; onChange: (pan: number, tilt: number) => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const apply = (clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let cx = ((clientX - r.left) / r.width - 0.5) * 2 // −1..1
    let cy = ((clientY - r.top) / r.height - 0.5) * 2
    let rad = Math.hypot(cx, cy)
    if (rad > 1) { cx /= rad; cy /= rad; rad = 1 } // clamp inside the circle → tilt caps at horizontal
    const nextTilt = Math.round(rad * 90)
    const nextPan = rad < 0.03 ? pan : Math.round((Math.atan2(cx, -cy) * 180) / Math.PI)
    onChange(nextPan, nextTilt)
  }
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation() // don't toggle-select the fixture while aiming
    apply(e.clientX, e.clientY)
    const move = (ev: PointerEvent) => apply(ev.clientX, ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const rad = tilt / 90 // 0 (centre = down) .. 1 (edge = horizontal)
  const a = (pan * Math.PI) / 180
  const dotX = 50 + Math.sin(a) * rad * 50
  const dotY = 50 - Math.cos(a) * rad * 50
  return (
    <div className="aim-wrap" onPointerDown={(e) => e.stopPropagation()}>
      <div className="aim-pad" ref={ref} onPointerDown={onDown} title={t('visualizer.aimPad')}>
        <span className="aim-dot" style={{ left: `${dotX}%`, top: `${dotY}%` }} />
      </div>
      <span className="aim-read">
        <span className="aim-field">Pan<b>{pan}°</b></span>
        <span className="aim-field">Tilt<b>{tilt}°</b></span>
      </span>
      <button className="aim-reset" title={t('visualizer.aimReset')} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onChange(0, 0) }}>⌖</button>
    </div>
  )
}
