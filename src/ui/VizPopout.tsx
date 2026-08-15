import { useEffect } from 'react'
import { useShowStore } from '../store/showStore'
import { startVizReceive, noopStorage } from '../store/vizSync'
import { VisualiserWindow } from './console/VisualiserWindow'
import { QuartzScreen } from './console/QuartzScreen'
import './ui.css'

/** A Titan workspace opened in its own window (?win=<screen>), for a 2nd monitor — the
 *  external-display equivalent. It mirrors the main window's live state over a BroadcastChannel
 *  and renders just that one workspace, full-window. It never writes to localStorage (noop
 *  storage) so it can't clobber the main show. */
export function VizPopout({ screen }: { screen: string }) {
  useEffect(() => {
    // Stop this window persisting — it's a read-only mirror sharing the same origin storage.
    try { useShowStore.persist.setOptions({ storage: noopStorage as never }) } catch { /* ignore */ }
    const stop = startVizReceive(useShowStore as never)
    return stop
  }, [])
  return (
    <div className="viz-popout">
      {screen === 'visualiser' ? <VisualiserWindow popped /> : <QuartzScreen solo={screen} />}
    </div>
  )
}
