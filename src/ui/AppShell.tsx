import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useShowStore } from '../store/showStore'
import { setLanguage } from '../i18n'
import { CONSOLES, consoleById } from '../console/registry'
import { PatchView } from './patch/PatchView'
import { DmxMonitor } from './patch/DmxMonitor'
import { Visualizer2D } from './visualizer/Visualizer2D'
import { Visualizer3D } from './visualizer/Visualizer3D'
import { RunView } from './run/RunView'
import { QuartzScreen } from './console/QuartzScreen'
import { QuartzPanel } from './console/QuartzPanel'
import { ShowMenu } from './ShowMenu'
import './ui.css'

const MODES = ['patch', 'program', 'run'] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const mode = useShowStore((s) => s.mode)
  const setMode = useShowStore((s) => s.setMode)
  const consoleId = useShowStore((s) => s.consoleId)
  const setConsole = useShowStore((s) => s.setConsole)
  const [viewer, setViewer] = useState<'2d' | '3d'>('3d')

  // Animation clock for the 2D view + monitor (the 3D view self-clocks). Advances
  // only while effects exist and playback isn't paused.
  const effectsCount = useShowStore((s) => s.effects.length)
  const playing = useShowStore((s) => s.playing)
  const setPlaying = useShowStore((s) => s.setPlaying)
  const tickClock = useShowStore((s) => s.tickClock)
  useEffect(() => {
    if (effectsCount === 0 || !playing) return
    const iv = setInterval(() => tickClock(0.05), 50)
    return () => clearInterval(iv)
  }, [effectsCount, playing, tickClock])

  const Surface = consoleById(consoleId).Surface
  // The faithful Quartz desk docks wide at the bottom; other surfaces sit at left.
  const quartzDocked = consoleId === 'avolites-quartz' && mode !== 'patch'
  const leftPanel =
    mode === 'patch' ? <PatchView /> : mode === 'run' ? <RunView /> : <Surface />

  const visualizerPanel = (
    <div className="panel">
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

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <h1>
            <span className="accent">DMX</span>Simulato<span className="accent">R</span>
          </h1>
          <span className="tagline">{t('app.tagline')}</span>
        </div>

        <div className="spacer" />

        <div className="mode-tabs">
          {MODES.map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {t(`modes.${m}`)}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <label className="console-picker" title="Console">
          <span>Console</span>
          <select value={consoleId} onChange={(e) => setConsole(e.target.value)}>
            {CONSOLES.map((c) => (
              <option key={c.id} value={c.id} disabled={c.status === 'planned'}>
                {c.brand} {c.model}
                {c.status === 'wip' ? ' (WIP)' : ''}
              </option>
            ))}
          </select>
        </label>

        <ShowMenu />

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
          <PanelGroup direction="horizontal" autoSaveId="dmxsim-quartz">
            {/* LEFT: the console — screen (thin, top) + button panel (large, bottom) */}
            <Panel defaultSize={56} minSize={30}>
              <PanelGroup direction="vertical" autoSaveId="dmxsim-quartz-left">
                <Panel defaultSize={20} minSize={10}>
                  <div className="pane">
                    <QuartzScreen />
                  </div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel defaultSize={80} minSize={30}>
                  <div className="pane">
                    <QuartzPanel />
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="rz rz-v" />
            {/* RIGHT: 3D viewer (top) + DMX monitor (bottom) */}
            <Panel minSize={24}>
              <PanelGroup direction="vertical" autoSaveId="dmxsim-quartz-right">
                <Panel defaultSize={64} minSize={30}>
                  <div className="pane">{visualizerPanel}</div>
                </Panel>
                <PanelResizeHandle className="rz rz-h" />
                <Panel defaultSize={36} minSize={14}>
                  <div className="pane">{monitorPanel}</div>
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
    </div>
  )
}
