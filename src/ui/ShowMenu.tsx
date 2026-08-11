import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../store/showStore'
import { TEMPLATES } from '../model/templates'
import { openPatchReport } from '../model/report'
import { openPlot } from '../model/plot'
import { exportMvr } from '../model/mvr'

/** Topbar show controls: load a template, save to file, load from file. */
export function ShowMenu() {
  const { t } = useTranslation()
  const loadTemplate = useShowStore((s) => s.loadTemplate)
  const templateId = useShowStore((s) => s.templateId)
  const exportShow = useShowStore((s) => s.exportShow)
  const importShow = useShowStore((s) => s.importShow)
  const setShow = useShowStore((s) => s.setShow)
  const addDefinitions = useShowStore((s) => s.addDefinitions)
  const fileRef = useRef<HTMLInputElement>(null)

  const onExport = () => {
    const blob = new Blob([exportShow()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dmxsimulator-show.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    const ext = file.name.toLowerCase().split('.').pop()
    try {
      if (ext === 'mvr') {
        const { importMvrFile } = await import('../model/mvr-import')
        const { show, definitions } = await importMvrFile(await file.arrayBuffer())
        addDefinitions(definitions)
        setShow(show)
      } else if (ext === 'gdtf') {
        const { importGdtfFile } = await import('../model/gdtf-import')
        const def = await importGdtfFile(await file.arrayBuffer())
        addDefinitions([def])
        alert(`Fixture added to the library: ${def.manufacturer} ${def.model}`)
      } else {
        const data: unknown = JSON.parse(await file.text())
        if (!importShow(data)) alert(t('show.invalid'))
      }
    } catch {
      alert(t('show.invalid'))
    }
  }

  return (
    <div className="show-menu">
      <select
        value={templateId}
        title={t('show.templates')}
        onChange={(e) => {
          if (e.target.value) loadTemplate(e.target.value)
        }}
      >
        <option value="">{t('show.templates')}…</option>
        {TEMPLATES.map((tpl) => (
          <option key={tpl.id} value={tpl.id}>
            {tpl.name}
          </option>
        ))}
      </select>
      <button onClick={onExport}>{t('show.save')}</button>
      <button onClick={() => fileRef.current?.click()}>{t('show.load')}</button>
      <button
        onClick={() => {
          const s = useShowStore.getState()
          openPatchReport(s.show, s.definitions).catch(() => alert(t('show.invalid')))
        }}
        title="Patch report (Titan-style) — downloads a PDF"
      >
        Report
      </button>
      <button
        onClick={() => {
          const s = useShowStore.getState()
          openPlot(s.show, s.definitions).catch(() => alert(t('show.invalid')))
        }}
        title="Lighting plot (plan with symbols, key and title block) — downloads a PDF"
      >
        Plot
      </button>
      <button
        onClick={() => {
          const s = useShowStore.getState()
          exportMvr(s.show, s.definitions).catch(() => alert(t('show.invalid')))
        }}
        title="Export the rig as MVR (GDTF fixtures + patch + positions) for Capture / Vectorworks"
      >
        MVR
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.mvr,.gdtf,application/json"
        style={{ display: 'none' }}
        onChange={onImportFile}
      />
    </div>
  )
}
