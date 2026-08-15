import { useEffect } from 'react'
import { useShowStore } from '../store/showStore'
import { startExtReceive, noopStorage } from '../store/vizSync'
import { QuartzScreen } from './console/QuartzScreen'
import './ui.css'

/** The external monitor (?ext=1) — a 2nd display you drag windows onto (visualiser, fixtures…)
 *  and arrange like Titan's external monitor. It mirrors the main window's state and forwards
 *  every action back to it (single source of truth), and never persists (noop storage). */
export function ExtMonitor() {
  useEffect(() => {
    try { useShowStore.persist.setOptions({ storage: noopStorage as never }) } catch { /* ignore */ }
    const stop = startExtReceive(useShowStore as never)
    return stop
  }, [])
  return (
    <div className="viz-popout">
      <QuartzScreen extMonitor />
    </div>
  )
}
