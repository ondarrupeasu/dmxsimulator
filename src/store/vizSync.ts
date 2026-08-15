import type { StoreApi } from 'zustand'

/** Live sync of the render-relevant show state to a popped-out Visualiser window (a separate
 *  browser window on a 2nd monitor). The main window BROADCASTS state; the popout MIRRORS it.
 *  Same-origin BroadcastChannel — no server. Heavy, rarely-changing data (the rig itself) is
 *  sent only when its reference changes; the light per-frame data (programmer, levels, clock)
 *  goes out on every change. */
const CHANNEL = 'dmxsim-viz'
export const VIZ_PARAM = 'viz' // ?viz=1 → this window is the popout

// Rig / library / stored looks — big, change rarely.
const STATIC_KEYS = ['show', 'definitions', 'playbacks', 'palettes', 'groups', 'effects', 'executorCues'] as const
// Live output + view state — small, change often (incl. the animation clock `now`).
const DYN_KEYS = [
  'programmer', 'playbackLevels', 'firedLevels', 'fades', 'flashIds', 'swopId', 'selection',
  'now', 'highlight', 'viewLights', 'viewer', 'venueUrl', 'venueName', 'blind', 'playing',
] as const

type AnyState = Record<string, unknown>
const pick = (s: AnyState, keys: readonly string[]) => {
  const o: AnyState = {}
  for (const k of keys) o[k] = s[k]
  return o
}

/** Call in the MAIN window: start broadcasting state to any popout. Returns a stop fn. */
export function startVizBroadcast(store: StoreApi<AnyState>): () => void {
  let ch: BroadcastChannel
  try { ch = new BroadcastChannel(CHANNEL) } catch { return () => {} }
  const sendStatic = (s: AnyState) => ch.postMessage({ t: 'static', d: pick(s, STATIC_KEYS) })
  const sendDyn = (s: AnyState) => ch.postMessage({ t: 'dyn', d: pick(s, DYN_KEYS) })
  // A freshly-opened popout says hello → send it everything at once.
  ch.onmessage = (e) => { if (e.data?.t === 'hello') { const s = store.getState(); sendStatic(s); sendDyn(s) } }
  let prev = STATIC_KEYS.map((k) => store.getState()[k])
  const unsub = store.subscribe((s) => {
    const now = STATIC_KEYS.map((k) => (s as AnyState)[k])
    if (now.some((v, i) => v !== prev[i])) { prev = now; sendStatic(s as AnyState) }
    sendDyn(s as AnyState)
  })
  const s0 = store.getState(); sendStatic(s0); sendDyn(s0)
  return () => { unsub(); ch.close() }
}

/** Call in the POPOUT window: mirror the broadcast state into the local store. */
export function startVizReceive(store: StoreApi<AnyState>): () => void {
  let ch: BroadcastChannel
  try { ch = new BroadcastChannel(CHANNEL) } catch { return () => {} }
  ch.onmessage = (e) => { if (e.data?.t === 'static' || e.data?.t === 'dyn') store.setState(e.data.d) }
  ch.postMessage({ t: 'hello' })
  return () => ch.close()
}

/** A storage that never writes — used in the popout so its mirrored setState()s don't clobber
 *  the main window's persisted show in the shared localStorage. */
export const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const isVizPopout = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(VIZ_PARAM) === '1'
