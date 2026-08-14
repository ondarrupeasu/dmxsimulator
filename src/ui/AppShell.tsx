import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle, type ImperativePanelGroupHandle } from 'react-resizable-panels'
import { useShowStore } from '../store/showStore'
import { setLanguage } from '../i18n'
import { consoleById } from '../console/registry'
import { PatchView } from './patch/PatchView'
import { DmxMonitor } from './patch/DmxMonitor'
import { Visualizer2D } from './visualizer/Visualizer2D'
import { Visualizer3D } from './visualizer/Visualizer3D'
import { QuartzScreen } from './console/QuartzScreen'
import { QuartzPanel } from './console/QuartzPanel'
import { FixturesWindow } from './console/FixturesWindow'
import { AimPad } from './console/AimPad'
import { PwaTag } from './PwaTag'
import { fixtureAttributeKeys } from '../model/types'
import { TourOverlay } from './TourOverlay'
import { useTour } from '../store/tourStore'
import { VENUE_PRESETS } from '../model/venues'
import { audioEngine } from '../engine/audio'
import { playbacksBySlot, activeStep } from '../model/cue'
import './ui.css'

const MODES = ['patch', 'program'] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const mode = useShowStore((s) => s.mode)
  const setMode = useShowStore((s) => s.setMode)
  const viewLights = useShowStore((s) => s.viewLights)
  const setViewLights = useShowStore((s) => s.setViewLights)
  const fixtures = useShowStore((s) => s.show.fixtures)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const setFixtureAim = useShowStore((s) => s.setFixtureAim)
  // Non-moving fixtures you aim by hand on the truss (PARs, profiles…). The aim joystick lives
  // in the 3D viewer corner and shows only when such a fixture is selected.
  const selAimable = fixtures.filter(
    (pf) => selection.includes(pf.id) && definitions[pf.definitionId] &&
      !fixtureAttributeKeys(definitions[pf.definitionId], pf.modeIndex).has('P') &&
      definitions[pf.definitionId].category !== 'hazer',
  )
  const aim = selAimable[0]?.aim ?? { pan: 0, tilt: 0 }
  const startTour = useTour((t) => t.start)
  const consoleId = useShowStore((s) => s.consoleId)
  const venueName = useShowStore((s) => s.venueName)
  const venueUrl = useShowStore((s) => s.venueUrl)
  const venuePreset = useShowStore((s) => s.show.venuePreset)
  const setVenue = useShowStore((s) => s.setVenue)
  const setVenuePreset = useShowStore((s) => s.setVenuePreset)
  const venueRef = useRef<HTMLInputElement>(null)
  const onVenueFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setVenue(URL.createObjectURL(file), file.name)
  }
  const onVenueSelect = (v: string) => {
    if (v === '__file') venueRef.current?.click()
    else if (v !== '__custom') setVenuePreset(v || null)
  }
  const viewer = useShowStore((s) => s.viewer)
  const setViewer = useShowStore((s) => s.setViewer)

  // Collapsible secondary panes: folding the Fixtures window maximises the desk,
  // folding the DMX monitor maximises the visualiser. The fold state lives in the store
  // (single source of truth) so a recalled Workspace/View can fold/unfold these panes;
  // the resizable-panel handles below are mirrored to it.
  const screenRef = useRef<ImperativePanelHandle>(null)
  const rightGroupRef = useRef<ImperativePanelGroupHandle>(null)
  const fold = useShowStore((s) => s.fold)
  const setFold = useShowStore((s) => s.setFold)
  const screenCollapsed = fold.screen
  const fixturesCollapsed = fold.fixtures
  const monitorCollapsed = fold.monitor

  // Mirror the store's fold flags onto the layout (the Workspace-recall path). The screen pane
  // is the only collapsible in the left group, so imperative collapse/expand is reliable there.
  // fixtures + monitor share the right vertical group, and collapsing two panels of one group in
  // the same pass makes react-resizable-panels drop one — so drive that group with setLayout()
  // (deterministic: collapsed → 4%, else its default share). Skip a clean first mount so the
  // panel library's own persisted sizes (autoSaveId) survive a reload untouched.
  const firstRun = useRef(true)
  useEffect(() => {
    const anyFolded = fold.screen || fold.fixtures || fold.monitor
    const clean = firstRun.current && !anyFolded
    firstRun.current = false
    if (clean) return
    const sp = screenRef.current
    if (sp) {
      if (fold.screen && !sp.isCollapsed()) sp.collapse()
      else if (!fold.screen && sp.isCollapsed()) sp.expand()
    }
    const grp = rightGroupRef.current
    if (grp) {
      const f = fold.fixtures ? 4 : 22
      const m = fold.monitor ? 4 : 28
      grp.setLayout([100 - f - m, f, m])
    }
  }, [fold.screen, fold.fixtures, fold.monitor])

  // Animation clock for the 2D view + monitor (the 3D view self-clocks). Advances
  // while effects run (and not paused) OR a Go fade is in progress.
  const effectsCount = useShowStore((s) => s.effects.length)
  const playing = useShowStore((s) => s.playing)
  const setPlaying = useShowStore((s) => s.setPlaying)
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
  // The faithful Quartz desk fills the Program workspace (playback runs from the desk
  // itself, like the real console). Patch uses the compact left-panel + big visualiser.
  const quartzDocked = consoleId === 'avolites-quartz' && mode === 'program'
  const leftPanel = mode === 'patch' ? <PatchView /> : <Surface />

  const visualizerPanel = (
    <div className="panel" data-tour="visualizer">
      <header>
        <h2>{t('visualizer.title')}</h2>
        <div className="vh-tools">
          <PwaTag
            sim="ayudas del simulador: Play/Pausa de efectos, cargar decorado, luces de sala, vista 2D y orientar PARs a mano"
            real="el visor (Capture) del Quartz no trae estos controles, o los hace de otra forma"
          />
          {effectsCount > 0 && (
            <button
              className="play-toggle"
              onClick={() => setPlaying(!playing)}
              title={playing ? 'Pause effects' : 'Play effects'}
            >
              {playing ? '❚❚ Pause' : '▶ Play'}
            </button>
          )}
          {viewer === '3d' && (
            <>
              <input
                ref={venueRef}
                type="file"
                accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                style={{ display: 'none' }}
                onChange={onVenueFile}
              />
              <select
                className="venue-select"
                value={venueUrl ? '__custom' : (venuePreset ?? '')}
                onChange={(e) => onVenueSelect(e.target.value)}
                title="Venue behind the rig"
              >
                <option value="">🏛 Venue: none</option>
                {VENUE_PRESETS.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
                {venueUrl && <option value="__custom">{venueName}</option>}
                <option value="__file">Load glTF…</option>
              </select>
            </>
          )}
          {viewer === '3d' && (
            <button
              className={`ghost-btn${viewLights ? ' active' : ''}`}
              data-tour="room-lights"
              onClick={() => setViewLights(!viewLights)}
              title={t('visualizer.roomLights')}
            >
              💡 {t('visualizer.roomLights')}
            </button>
          )}
          <div className="view-toggle">
            <button className={viewer === '3d' ? 'active' : ''} onClick={() => setViewer('3d')}>
              3D
            </button>
            <button className={viewer === '2d' ? 'active' : ''} onClick={() => setViewer('2d')}>
              2D
            </button>
          </div>
        </div>
      </header>
      <div className="scroll" style={{ padding: viewer === '3d' ? 0 : 8, flex: 1, overflow: 'hidden', position: 'relative' }}>
        {viewer === '3d' ? <Visualizer3D /> : <Visualizer2D />}
        {viewer === '3d' && selAimable.length > 0 && (
          <div className="viz-aim" title="Orientar el foco a mano (montaje físico — no es DMX).">
            <span className="viz-aim-cap">Aim ↺ {selAimable.length > 1 ? `${selAimable.length} focos` : selAimable[0].name}</span>
            <AimPad pan={aim.pan} tilt={aim.tilt} onChange={(p, t) => selAimable.forEach((f) => setFixtureAim(f.id, p, t))} />
          </div>
        )}
      </div>
    </div>
  )
  const monitorPanel = <DmxMonitor universe={1} />
  const fixturesPanel = <FixturesWindow />

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

        <div className="mode-tabs">
          {MODES.map((m) => (
            <button key={m} data-tour={`mode-${m}`} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {t(`modes.${m}`)}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <button className="tour-start" onClick={startTour} title="Tutorial guiado paso a paso">
          🎓 Tutorial
        </button>

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
          <PanelGroup direction="horizontal" id="quartz-h" autoSaveId="dmxsim-quartz-v2">
            {/* LEFT: the console — screen (thin, top) + button panel (large, bottom).
               Explicit id+order on both panels so the nested PanelGroups don't
               confuse the initial sizing (else the console collapses to minSize). */}
            <Panel id="quartz-console" order={1} defaultSize={62} minSize={30}>
              <PanelGroup direction="vertical" autoSaveId="dmxsim-quartz-left-v4">
                <Panel
                  ref={screenRef} collapsible collapsedSize={4}
                  defaultSize={34} minSize={20}
                  onCollapse={() => setFold('screen', true)}
                  onExpand={() => setFold('screen', false)}
                >
                  <div className="pane">
                    <button
                      className="pane-fold"
                      title={screenCollapsed ? t('common.expand') : t('common.collapse')}
                      onClick={() => setFold('screen', !screenCollapsed)}
                    >
                      {screenCollapsed ? '⌄' : '⌃'}
                    </button>
                    {!screenCollapsed && <QuartzScreen />}
                  </div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel defaultSize={66} minSize={30}>
                  <div className="pane">
                    <QuartzPanel />
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="rz rz-v" />
            {/* RIGHT: 3D viewer (top) + DMX monitor (bottom).
               Needs an explicit defaultSize too — with only one side sized,
               react-resizable-panels collapses the console to its minSize. */}
            <Panel id="quartz-right" order={2} defaultSize={38} minSize={24}>
              <PanelGroup ref={rightGroupRef} direction="vertical" autoSaveId="dmxsim-quartz-right-v2">
                <Panel defaultSize={50} minSize={24}>
                  <div className="pane">{visualizerPanel}</div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel
                  collapsible collapsedSize={4}
                  defaultSize={22} minSize={12}
                  onCollapse={() => setFold('fixtures', true)}
                  onExpand={() => setFold('fixtures', false)}
                >
                  <div className="pane">
                    <button
                      className="pane-fold"
                      title={fixturesCollapsed ? t('common.expand') : t('common.collapse')}
                      onClick={() => setFold('fixtures', !fixturesCollapsed)}
                    >
                      {fixturesCollapsed ? '⌄' : '⌃'}
                    </button>
                    {!fixturesCollapsed && fixturesPanel}
                  </div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel
                  collapsible collapsedSize={4}
                  defaultSize={28} minSize={14}
                  onCollapse={() => setFold('monitor', true)}
                  onExpand={() => setFold('monitor', false)}
                >
                  <div className="pane">
                    <button
                      className="pane-fold"
                      title={monitorCollapsed ? t('common.expand') : t('common.collapse')}
                      onClick={() => setFold('monitor', !monitorCollapsed)}
                    >
                      {monitorCollapsed ? '⌃' : '⌄'}
                    </button>
                    {!monitorCollapsed && monitorPanel}
                  </div>
                </Panel>
              </PanelGroup>
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
                  <div className="pane">{visualizerPanel}</div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel defaultSize={28} minSize={14}>
                  <div className="pane">{monitorPanel}</div>
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
