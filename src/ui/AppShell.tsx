import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import { useShowStore } from '../store/showStore'
import { setLanguage } from '../i18n'
import { consoleById } from '../console/registry'
import { PatchView } from './patch/PatchView'
import { DmxMonitor } from './patch/DmxMonitor'
import { QuartzScreen } from './console/QuartzScreen'
import { QuartzPanel } from './console/QuartzPanel'
import { VisualiserWindow } from './console/VisualiserWindow'
import { TourOverlay } from './TourOverlay'
import { audioEngine } from '../engine/audio'
import { playbacksBySlot, activeStep } from '../model/cue'
import './ui.css'

const MODES = ['patch', 'program'] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const mode = useShowStore((s) => s.mode)
  const setMode = useShowStore((s) => s.setMode)
  const consoleId = useShowStore((s) => s.consoleId)

  // The only foldable secondary pane now is the PWA DMX monitor (the Titan screen + desk stay
  // put — they're the console, always visible). fold state lives in the store so a recalled
  // Workspace can restore it; the monitor is the only collapsible in its group, so a plain
  // imperative collapse/expand is reliable (no setLayout gymnastics needed).
  const monitorRef = useRef<ImperativePanelHandle>(null)
  const fold = useShowStore((s) => s.fold)
  const setFold = useShowStore((s) => s.setFold)
  const monitorCollapsed = fold.monitor
  const viewerVisible = useShowStore((s) => s.viewerVisible)
  useEffect(() => {
    const p = monitorRef.current
    if (!p) return
    if (fold.monitor && !p.isCollapsed()) p.collapse()
    else if (!fold.monitor && p.isCollapsed()) p.expand()
  }, [fold.monitor])

  // Animation clock for the 2D view + monitor (the 3D view self-clocks). Advances
  // while effects run (and not paused) OR a Go fade is in progress.
  const effectsCount = useShowStore((s) => s.effects.length)
  const playing = useShowStore((s) => s.playing)
  const tickClock = useShowStore((s) => s.tickClock)
  const fadeCount = useShowStore((s) => Object.keys(s.fades).length)
  const settleFades = useShowStore((s) => s.settleFades)
  const advanceChases = useShowStore((s) => s.advanceChases)
  // A playback whose live step has shapes, or a running chase, also needs the clock running.
  const cueEffectsUp = useShowStore((s) =>
    s.playbacks.some((p) => {
      const up = Math.max(s.playbackLevels[p.id] ?? 0, s.firedLevels[p.id] ?? 0)
      if (up <= 0) return false
      if (p.mode === 'chase' && p.steps.length > 1) return true
      return (activeStep(p)?.effects?.length ?? 0) > 0
    }),
  )
  // A Go cross-fade in progress also needs the clock (it may have no level fade to drive it).
  const transitionUp = useShowStore((s) => s.playbacks.some((p) => p.transition && s.now < p.transition.start + p.transition.dur))
  useEffect(() => {
    const effectsRun = (effectsCount > 0 || cueEffectsUp) && playing
    if (!effectsRun && fadeCount === 0 && !transitionUp) return
    const iv = setInterval(() => {
      tickClock(0.05)
      settleFades()
      advanceChases()
    }, 50)
    return () => clearInterval(iv)
  }, [effectsCount, cueEffectsUp, playing, fadeCount, transitionUp, tickClock, settleFades, advanceChases])

  // Sound to Light: while enabled, watch the 7 bands and fire each band's mapped playback
  // on the rising edge over its threshold (like Titan's audio triggers); track the beat.
  const audioEnabled = useShowStore((s) => s.audioEnabled)
  useEffect(() => {
    if (!audioEnabled) return
    let raf = 0
    let frame = 0
    const over = new Array(7).fill(false)
    const baseline = new Array(7).fill(0)
    const loop = () => {
      const levels = audioEngine.bands()
      const peak = levels.reduce((m, v) => Math.max(m, v), 0)
      const st = useShowStore.getState()
      if (st.audioAutoGain) audioEngine.autoGain(peak) // Titan Auto Gain
      audioEngine.detectBeat(performance.now(), levels[1] ?? 0)
      const bySlot = playbacksBySlot(st.playbacks)
      frame++
      st.audioBands.forEach((b, i) => {
        const lvl = levels[i] ?? 0
        baseline[i] = baseline[i] * 0.98 + lvl * 0.02 // slow quiet-floor estimate
        const on = b.enabled && lvl >= b.threshold
        if (on && !over[i] && b.cueSlot != null) {
          const pb = bySlot[b.cueSlot]
          if (pb) st.goCue(pb.id)
        }
        over[i] = on
        // Per-band Auto trigger level: when idle, sit a margin above the floor (throttled).
        if (b.auto && !on && frame % 15 === 0) {
          const target = Math.min(0.95, baseline[i] + 0.18)
          if (Math.abs(target - b.threshold) > 0.02)
            useShowStore.setState((s) => ({ audioBands: s.audioBands.map((bb, j) => (j === i ? { ...bb, threshold: target } : bb)) }))
        }
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [audioEnabled])

  const Surface = consoleById(consoleId).Surface
  // Unified view: the Quartz desk fills the whole workspace, patch + program together (like the
  // real console — but patching is a MENU flow on the desk, not a workspace window, so our
  // visual patch tool is a PWA panel (below-right, blue), not a faked Titan window). The Titan
  // touchscreen spans the top; the physical panel + PWA panel sit below. Only the legacy
  // Universal console keeps the old Patch/Program split.
  const quartzDocked = consoleId === 'avolites-quartz'
  const leftPanel = mode === 'patch' ? <PatchView /> : <Surface />
  const rightPanel = useShowStore((s) => s.rightPanel)
  const setRightPanel = useShowStore((s) => s.setRightPanel)
  // The blue PWA side panel: DMX monitor or the patch tool, switchable by its own tabs.
  const pwaPanel = (
    <div className="pwa-panel">
      <div className="pwa-tabs">
        <button className={rightPanel === 'monitor' ? 'on' : ''} onClick={() => setRightPanel('monitor')}>DMX Monitor</button>
        <button className={rightPanel === 'patch' ? 'on' : ''} onClick={() => setRightPanel('patch')}>Patch</button>
        <span className="pwa-tabs-tag" title="Herramientas del simulador (PWA) — no forman parte de la mesa Quartz">PWA</span>
      </div>
      <div className="pwa-panel-body">
        {rightPanel === 'monitor' ? <DmxMonitor universe={1} /> : <PatchView />}
      </div>
    </div>
  )
  const monitorPanel = <DmxMonitor universe={1} />

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <h1>
            <span className="accent">DMX</span>Simulato<span className="accent">R</span>
          </h1>
          <span className="appver" title="Versión en ejecución">v{__APP_VERSION__} · {__BUILD_COMMIT__}</span>
        </div>

        <div className="spacer" />

        {/* The Quartz is unified (patch is a Titan window) — no Patch/Program switch. Only the
           legacy Universal console keeps the two modes. */}
        {!quartzDocked && (
          <div className="mode-tabs">
            {MODES.map((m) => (
              <button key={m} data-tour={`mode-${m}`} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
                {t(`modes.${m}`)}
              </button>
            ))}
          </div>
        )}

        <div className="spacer" />

        {/* Tutorial hidden until it's reworked for the unified desk layout (targets stale nodes). */}

        <select
          value={i18n.language}
          onChange={(e) => setLanguage(e.target.value)}
          title={t('common.language')}
        >
          <option value="en">EN</option>
          <option value="es">ES</option>
          <option value="eu">EU</option>
        </select>
      </div>

      <div className="workspace">
        {quartzDocked ? (
          <PanelGroup direction="horizontal" id="quartz-cols" autoSaveId="dmxsim-quartz-cols-v1">
            {/* LEFT column: the Titan touchscreen (top, with the A–G softkeys on its right edge)
               over the physical desk (bottom). Resizing between them touches only these two —
               the visualiser (right column) is unaffected. */}
            <Panel id="quartz-left" order={1} defaultSize={56} minSize={30}>
              <PanelGroup direction="vertical" autoSaveId="dmxsim-quartz-left-v5">
                <Panel defaultSize={46} minSize={22}>
                  <div className="pane"><QuartzScreen /></div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel defaultSize={54} minSize={26}>
                  <div className="pane"><QuartzPanel /></div>
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="rz rz-v" />
            {/* RIGHT column: the Visualiser (top) over the foldable PWA panel (DMX monitor /
               Patch, bottom). Folding the panel gives the whole right side to the visualiser.
               When the Visualiser is switched off (from the Titan), the PWA panel fills the
               whole right column (grows up). */}
            <Panel id="quartz-right" order={2} defaultSize={44} minSize={24}>
              {viewerVisible ? (
                <PanelGroup direction="vertical" autoSaveId="dmxsim-quartz-right-v3">
                  <Panel defaultSize={62} minSize={22}>
                    <div className="pane"><VisualiserWindow /></div>
                  </Panel>
                  <PanelResizeHandle className="rz rz-h" />
                  <Panel
                    ref={monitorRef} collapsible collapsedSize={5}
                    defaultSize={38} minSize={16}
                    onCollapse={() => setFold('monitor', true)}
                    onExpand={() => setFold('monitor', false)}
                  >
                    <div className="pane pwa-pane">
                      <button
                        className="pane-fold"
                        title={monitorCollapsed ? t('common.expand') : t('common.collapse')}
                        onClick={() => setFold('monitor', !monitorCollapsed)}
                      >
                        {monitorCollapsed ? '⌃' : '⌄'}
                      </button>
                      {!monitorCollapsed && pwaPanel}
                    </div>
                  </Panel>
                </PanelGroup>
              ) : (
                <div className="pane pwa-pane">{pwaPanel}</div>
              )}
            </Panel>
          </PanelGroup>
        ) : (
          <PanelGroup direction="horizontal" autoSaveId="dmxsim-main">
            <Panel defaultSize={26} minSize={16}>
              <div className="pane">{leftPanel}</div>
            </Panel>
            <PanelResizeHandle className="rz rz-v" />
            <Panel minSize={40}>
              <PanelGroup direction="vertical" autoSaveId="dmxsim-right">
                <Panel minSize={30}>
                  <div className="pane"><VisualiserWindow /></div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel defaultSize={28} minSize={14}>
                  <div className="pane pwa-pane">{monitorPanel}</div>
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        )}
      </div>
      <TourOverlay />
    </div>
  )
}
