import { useTranslation } from 'react-i18next'
import { useShowStore } from '../store/showStore'
import { setLanguage } from '../i18n'
import { PatchView } from './patch/PatchView'
import { DmxMonitor } from './patch/DmxMonitor'
import { ProgrammerView } from './program/ProgrammerView'
import { Visualizer2D } from './visualizer/Visualizer2D'
import './ui.css'

const MODES = ['patch', 'program', 'run'] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const mode = useShowStore((s) => s.mode)
  const setMode = useShowStore((s) => s.setMode)
  const resetShow = useShowStore((s) => s.resetShow)

  const leftPanel =
    mode === 'patch' ? <PatchView /> : mode === 'program' ? <ProgrammerView /> : <ProgrammerView />

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
            <button
              key={m}
              className={mode === m ? 'active' : ''}
              onClick={() => setMode(m)}
            >
              {t(`modes.${m}`)}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <select
          value={i18n.language}
          onChange={(e) => setLanguage(e.target.value)}
          title={t('common.language')}
        >
          <option value="en">EN</option>
          <option value="es">ES</option>
          <option value="eu">EU</option>
        </select>
        <button onClick={resetShow}>{t('common.reset')}</button>
      </div>

      <div className="body">
        {leftPanel}
        <div className="right-col">
          <div className="panel">
            <header>
              <h2>{t('visualizer.title')}</h2>
              <span className="sub">{t('visualizer.note')}</span>
            </header>
            <div className="scroll" style={{ padding: 8, flex: 1 }}>
              <Visualizer2D />
            </div>
          </div>
          <DmxMonitor universe={1} />
        </div>
      </div>
    </div>
  )
}
