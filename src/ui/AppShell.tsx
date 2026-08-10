import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../store/showStore'
import { setLanguage } from '../i18n'
import { CONSOLES, consoleById } from '../console/registry'
import { PatchView } from './patch/PatchView'
import { DmxMonitor } from './patch/DmxMonitor'
import { Visualizer2D } from './visualizer/Visualizer2D'
import { Visualizer3D } from './visualizer/Visualizer3D'
import { RunView } from './run/RunView'
import { ShowMenu } from './ShowMenu'
import { Splitter } from './Splitter'
import { usePersistentSize } from './usePersistentSize'
import './ui.css'

const MODES = ['patch', 'program', 'run'] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const mode = useShowStore((s) => s.mode)
  const setMode = useShowStore((s) => s.setMode)
  const consoleId = useShowStore((s) => s.consoleId)
  const setConsole = useShowStore((s) => s.setConsole)
  const [viewer, setViewer] = useState<'2d' | '3d'>('3d')

  // Drive the animation clock (for the 2D view + monitor) while effects run.
  // The 3D view self-clocks for smoothness; here we tick ~20fps to keep React
  // re-renders reasonable.
  const effectsCount = useShowStore((s) => s.effects.length)
  const setNow = useShowStore((s) => s.setNow)
  useEffect(() => {
    if (effectsCount === 0) return
    const iv = setInterval(() => setNow(performance.now() / 1000), 50)
    return () => clearInterval(iv)
  }, [effectsCount, setNow])

  // Resizable pane sizes (persisted, drag the dividers to change them).
  const [leftW, setLeftW] = usePersistentSize('left', 340, 260, 680)
  const [monitorH, setMonitorH] = usePersistentSize('monitorH', 210, 110, 560)
  const [monitorW, setMonitorW] = usePersistentSize('monitorW', 300, 180, 760)
  const [deskH, setDeskH] = usePersistentSize('deskH', 340, 220, 680)

  const Surface = consoleById(consoleId).Surface
  // The faithful Quartz desk docks wide at the bottom (like a real console under
  // the stage); other surfaces sit in the side panel.
  const quartzDocked = consoleId === 'avolites-quartz' && mode !== 'patch'
  const leftPanel =
    mode === 'patch' ? <PatchView /> : mode === 'run' ? <RunView /> : <Surface />

  const visualizerPanel = (
    <div className="panel">
      <header>
        <h2>{t('visualizer.title')}</h2>
        <div className="view-toggle">
          <button className={viewer === '3d' ? 'active' : ''} onClick={() => setViewer('3d')}>
            3D
          </button>
          <button className={viewer === '2d' ? 'active' : ''} onClick={() => setViewer('2d')}>
            2D
          </button>
        </div>
      </header>
      <div className="scroll" style={{ padding: viewer === '3d' ? 0 : 8, flex: 1, overflow: 'hidden' }}>
        {viewer === '3d' ? <Visualizer3D /> : <Visualizer2D />}
      </div>
    </div>
  )

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

      {quartzDocked ? (
        <div className="workspace" style={{ flexDirection: 'column' }}>
          <div className="row-flex" style={{ flex: 1, minHeight: 0 }}>
            <div className="pane" style={{ flex: 1, minWidth: 0 }}>
              {visualizerPanel}
            </div>
            <Splitter dir="col" onDrag={(d) => setMonitorW((w) => w - d)} />
            <div className="pane" style={{ width: monitorW, flex: '0 0 auto' }}>
              <DmxMonitor universe={1} />
            </div>
          </div>
          <Splitter dir="row" onDrag={(d) => setDeskH((h) => h - d)} />
          <div className="pane" style={{ height: deskH, flex: '0 0 auto' }}>
            <Surface />
          </div>
        </div>
      ) : (
        <div className="workspace">
          <div className="pane" style={{ width: leftW, flex: '0 0 auto' }}>
            {leftPanel}
          </div>
          <Splitter dir="col" onDrag={(d) => setLeftW((w) => w + d)} />
          <div className="col-flex" style={{ flex: 1, minWidth: 0 }}>
            <div className="pane" style={{ flex: 1, minHeight: 0 }}>
              {visualizerPanel}
            </div>
            <Splitter dir="row" onDrag={(d) => setMonitorH((h) => h - d)} />
            <div className="pane" style={{ height: monitorH, flex: '0 0 auto' }}>
              <DmxMonitor universe={1} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
