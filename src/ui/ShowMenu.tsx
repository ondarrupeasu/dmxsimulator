import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../store/showStore'
import { TEMPLATES } from '../model/templates'
import { openPatchReport } from '../model/report'
import { openPlot } from '../model/plot'
import { exportMvr } from '../model/mvr'
import { exportGltf } from '../model/gltf-export'

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
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!exportOpen) return
    const onDoc = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [exportOpen])

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
      <button
        onClick={() => fileRef.current?.click()}
        title="Import a show (.json), an MVR rig, or a GDTF fixture"
      >
        ⭳ Import
      </button>
      <div className="menu-wrap" ref={exportRef}>
        <button className={exportOpen ? 'active' : ''} onClick={() => setExportOpen((o) => !o)}>
          ⭱ Export ▾
        </button>
        {exportOpen && (
          <div className="menu-pop">
            {(() => {
              const s = useShowStore.getState()
              const guard = (p: Promise<void>) => p.catch(() => alert(t('show.invalid')))
              const items: [string, string, () => void][] = [
                ['Show file (.json)', 'The whole show, to reload here later', onExport],
                ['Patch report (PDF)', 'Titan-style patch list', () => guard(openPatchReport(s.show, s.definitions))],
                ['Lighting plot (PDF)', 'Plan with symbols + key', () => guard(openPlot(s.show, s.definitions))],
                ['MVR — rig', 'Capture / Vectorworks / grandMA', () => guard(exportMvr(s.show, s.definitions))],
                ['glTF/GLB — 3D model', 'Blender / SketchUp / Capture', () => guard(exportGltf(s.show, s.definitions))],
              ]
              return items.map(([label, sub, run]) => (
                <button key={label} onClick={() => { run(); setExportOpen(false) }}>
                  <span className="mi-label">{label}</span>
                  <span className="mi-sub">{sub}</span>
                </button>
              ))
            })()}
          </div>
        )}
      </div>
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
