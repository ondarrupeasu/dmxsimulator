import type { StoreApi } from 'zustand'

/** Live link between the main window and the "external monitor" window (a 2nd display). The
 *  MAIN window is the single source of truth: it broadcasts state; the external window mirrors
 *  it for rendering and FORWARDS every user action back to the main store (so there's no
 *  divergence — like Titan, where the external monitor is another view of the one show). */
const CHANNEL = 'dmxsim-viz'
export const EXT_PARAM = 'ext' // ?ext=1 → this window is the external monitor

// Rig / library / stored looks — big, change rarely.
const STATIC_KEYS = ['show', 'definitions', 'playbacks', 'palettes', 'groups', 'effects', 'executorCues'] as const
// Live output + view state — small, changes often (incl. the animation clock `now`). Includes
// deskWindows so the external monitor knows which windows are on it and where.
const DYN_KEYS = [
  'programmer', 'playbackLevels', 'firedLevels', 'fades', 'flashIds', 'swopId', 'selection',
  'now', 'highlight', 'viewLights', 'viewer', 'viewLightsExt', 'viewerExt', 'venueUrl', 'venueName', 'blind', 'playing',
  'deskWindows', 'deskFocus', 'viewerVisible', 'viewerLocation', 'deskScreen', 'deskMenu', 'deskAttr', 'deskWheelPage', 'legendArm', 'fixtureLabel', 'alignArm', 'convertArm', 'orderArm', 'orderSeq',
] as const

type AnyState = Record<string, unknown>
const pick = (s: AnyState, keys: readonly string[]) => {
  const o: AnyState = {}
  for (const k of keys) o[k] = s[k]
  return o
}

/** MAIN window: broadcast state to the external monitor + apply the actions it forwards back. */
export function startExtBroadcast(store: StoreApi<AnyState>): () => void {
  let ch: BroadcastChannel
  try { ch = new BroadcastChannel(CHANNEL) } catch { return () => {} }
  const sendStatic = (s: AnyState) => ch.postMessage({ t: 'static', d: pick(s, STATIC_KEYS) })
  const sendDyn = (s: AnyState) => ch.postMessage({ t: 'dyn', d: pick(s, DYN_KEYS) })
  ch.onmessage = (e) => {
    const m = e.data
    if (m?.t === 'hello') { const s = store.getState(); sendStatic(s); sendDyn(s) }
    else if (m?.t === 'action') {
      const fn = store.getState()[m.fn]
      if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...(m.args ?? []))
    }
  }
  let prev = STATIC_KEYS.map((k) => store.getState()[k])
  const unsub = store.subscribe((s) => {
    const now = STATIC_KEYS.map((k) => (s as AnyState)[k])
    if (now.some((v, i) => v !== prev[i])) { prev = now; sendStatic(s as AnyState) }
    sendDyn(s as AnyState)
  })
  const s0 = store.getState(); sendStatic(s0); sendDyn(s0)
  return () => { unsub(); ch.close() }
}

/** EXTERNAL-MONITOR window: mirror the main window's state, and forward every store action
 *  (button press, drag, toggle…) back to the main so it stays the single source of truth. */
export function startExtReceive(store: StoreApi<AnyState>): () => void {
  let ch: BroadcastChannel
  try { ch = new BroadcastChannel(CHANNEL) } catch { return () => {} }
  ch.onmessage = (e) => { if (e.data?.t === 'static' || e.data?.t === 'dyn') store.setState(e.data.d) }
  // Override every action (function-valued state field) to forward to the main window instead
  // of mutating this mirror. Getters that return a value used elsewhere are left local.
  const READ_ONLY = new Set(['exportShow', 'importShow', 'findFreeAddress'])
  const s = store.getState()
  const overrides: AnyState = {}
  for (const k of Object.keys(s)) {
    if (typeof s[k] === 'function' && !READ_ONLY.has(k)) {
      overrides[k] = (...args: unknown[]) => ch.postMessage({ t: 'action', fn: k, args })
    }
  }
  store.setState(overrides)
  ch.postMessage({ t: 'hello' })
  return () => ch.close()
}

/** A storage that never writes — the external window is a mirror; it must not clobber the
 *  main window's persisted show in the shared localStorage. */
export const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }

export const isExtMonitor = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(EXT_PARAM) === '1'

/** Open (or focus) the external-monitor window. If the browser exposes the Window Management
 *  API and there's a 2nd screen, place the window on it filling the whole screen (asks for the
 *  "window management" permission once); otherwise it opens as a normal window you drag over.
 *  True borderless fullscreen still needs F11 inside that window — the browser won't force it. */
let extWin: Window | null = null
export const openExtMonitor = () => {
  const url = `${window.location.pathname}?${EXT_PARAM}=1`
  const w = window.open(url, 'dmxsim-ext', 'width=1280,height=720')
  extWin = w
  const api = window as unknown as { getScreenDetails?: () => Promise<{ screens: Array<{ isPrimary: boolean; availLeft: number; availTop: number; availWidth: number; availHeight: number }> }> }
  if (w && api.getScreenDetails) {
    api.getScreenDetails().then((d) => {
      const ext = d.screens.find((s) => !s.isPrimary)
      if (ext) { try { w.moveTo(ext.availLeft, ext.availTop); w.resizeTo(ext.availWidth, ext.availHeight) } catch { /* blocked */ } }
    }).catch(() => { /* permission denied — leave it as a normal window */ })
  }
  return w
}

/** Disconnect the external monitor — close its window (Titan's Display Setup → Disconnected). */
export const closeExtMonitor = () => { try { extWin?.close() } catch { /* ignore */ } extWin = null }
