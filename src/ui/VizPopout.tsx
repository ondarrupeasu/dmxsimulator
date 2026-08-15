import { useEffect } from 'react'
import { useShowStore } from '../store/showStore'
import { startVizReceive, noopStorage } from '../store/vizSync'
import { VisualiserWindow } from './console/VisualiserWindow'
import './ui.css'

/** The Visualiser opened in its own window (?viz=1), for a 2nd monitor. It mirrors the main
 *  window's live state over a BroadcastChannel and renders only the visualiser, full-window.
 *  It never writes to localStorage (noop storage) so it can't clobber the main show. */
export function VizPopout() {
  useEffect(() => {
    // Stop this window persisting — it's a read-only mirror sharing the same origin storage.
    try { useShowStore.persist.setOptions({ storage: noopStorage as never }) } catch { /* ignore */ }
    const stop = startVizReceive(useShowStore as never)
    return stop
  }, [])
  return (
    <div className="viz-popout">
      <VisualiserWindow popped />
    </div>
  )
}
