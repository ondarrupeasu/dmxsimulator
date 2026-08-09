import { useState } from 'react'
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
import './ui.css'

const MODES = ['patch', 'program', 'run'] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const mode = useShowStore((s) => s.mode)
  const setMode = useShowStore((s) => s.setMode)
  const consoleId = useShowStore((s) => s.consoleId)
  const setConsole = useShowStore((s) => s.setConsole)
  const [viewer, setViewer] = useState<'2d' | '3d'>('3d')

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
        <div className="body body-desk">
          <div className="desk-top">
            {visualizerPanel}
            <DmxMonitor universe={1} />
          </div>
          <div className="desk-dock">
            <Surface />
          </div>
        </div>
      ) : (
        <div className="body">
          {leftPanel}
          <div className="right-col">
            {visualizerPanel}
            <DmxMonitor universe={1} />
          </div>
        </div>
      )}
    </div>
  )
}
