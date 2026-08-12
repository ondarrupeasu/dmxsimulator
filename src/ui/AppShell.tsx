import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
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
import { ShowMenu } from './ShowMenu'
import { TourOverlay } from './TourOverlay'
import { useTour } from '../store/tourStore'
import { VENUE_PRESETS } from '../model/venues'
import './ui.css'

const MODES = ['patch', 'program'] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const mode = useShowStore((s) => s.mode)
  const setMode = useShowStore((s) => s.setMode)
  const viewLights = useShowStore((s) => s.viewLights)
  const setViewLights = useShowStore((s) => s.setViewLights)
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
  const [viewer, setViewer] = useState<'2d' | '3d'>('3d')

  // Collapsible secondary panes: folding the Fixtures window maximises the desk,
  // folding the DMX monitor maximises the visualiser.
  const screenRef = useRef<ImperativePanelHandle>(null)
  const fixturesRef = useRef<ImperativePanelHandle>(null)
  const monitorRef = useRef<ImperativePanelHandle>(null)
  const [screenCollapsed, setScreenCollapsed] = useState(false)
  const [fixturesCollapsed, setFixturesCollapsed] = useState(false)
  const [monitorCollapsed, setMonitorCollapsed] = useState(false)

  // Animation clock for the 2D view + monitor (the 3D view self-clocks). Advances
  // while effects run (and not paused) OR a Go fade is in progress.
  const effectsCount = useShowStore((s) => s.effects.length)
  const playing = useShowStore((s) => s.playing)
  const setPlaying = useShowStore((s) => s.setPlaying)
  const tickClock = useShowStore((s) => s.tickClock)
  const fadeCount = useShowStore((s) => Object.keys(s.fades).length)
  const settleFades = useShowStore((s) => s.settleFades)
  // A cue with recorded shapes that's currently up also needs the clock running.
  const cueEffectsUp = useShowStore((s) =>
    s.cues.some((c) => (c.effects?.length ?? 0) > 0 && (s.playbackLevels[c.id] ?? 0) > 0),
  )
  useEffect(() => {
    const effectsRun = (effectsCount > 0 || cueEffectsUp) && playing
    if (!effectsRun && fadeCount === 0) return
    const iv = setInterval(() => {
      tickClock(0.05)
      settleFades()
    }, 50)
    return () => clearInterval(iv)
  }, [effectsCount, cueEffectsUp, playing, fadeCount, tickClock, settleFades])

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
      <div className="scroll" style={{ padding: viewer === '3d' ? 0 : 8, flex: 1, overflow: 'hidden' }}>
        {viewer === '3d' ? <Visualizer3D /> : <Visualizer2D />}
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

        <ShowMenu />

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
                  onCollapse={() => setScreenCollapsed(true)}
                  onExpand={() => setScreenCollapsed(false)}
                >
                  <div className="pane">
                    <button
                      className="pane-fold"
                      title={screenCollapsed ? t('common.expand') : t('common.collapse')}
                      onClick={() => (screenCollapsed ? screenRef.current?.expand() : screenRef.current?.collapse())}
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
              <PanelGroup direction="vertical" autoSaveId="dmxsim-quartz-right-v2">
                <Panel defaultSize={50} minSize={24}>
                  <div className="pane">{visualizerPanel}</div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel
                  ref={fixturesRef} collapsible collapsedSize={4}
                  defaultSize={22} minSize={12}
                  onCollapse={() => setFixturesCollapsed(true)}
                  onExpand={() => setFixturesCollapsed(false)}
                >
                  <div className="pane">
                    <button
                      className="pane-fold"
                      title={fixturesCollapsed ? t('common.expand') : t('common.collapse')}
                      onClick={() => (fixturesCollapsed ? fixturesRef.current?.expand() : fixturesRef.current?.collapse())}
                    >
                      {fixturesCollapsed ? '⌄' : '⌃'}
                    </button>
                    {!fixturesCollapsed && fixturesPanel}
                  </div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel
                  ref={monitorRef} collapsible collapsedSize={4}
                  defaultSize={28} minSize={14}
                  onCollapse={() => setMonitorCollapsed(true)}
                  onExpand={() => setMonitorCollapsed(false)}
                >
                  <div className="pane">
                    <button
                      className="pane-fold"
                      title={monitorCollapsed ? t('common.expand') : t('common.collapse')}
                      onClick={() => (monitorCollapsed ? monitorRef.current?.expand() : monitorRef.current?.collapse())}
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
