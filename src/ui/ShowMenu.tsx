import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../store/showStore'
import { TEMPLATES } from '../model/templates'
import { openPatchReport } from '../model/report'

/** Topbar show controls: load a template, save to file, load from file. */
export function ShowMenu() {
  const { t } = useTranslation()
  const loadTemplate = useShowStore((s) => s.loadTemplate)
  const templateId = useShowStore((s) => s.templateId)
  const exportShow = useShowStore((s) => s.exportShow)
  const importShow = useShowStore((s) => s.importShow)
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
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!importShow(data)) alert(t('show.invalid'))
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
        onClick={() => openPatchReport(useShowStore.getState().show, useShowStore.getState().definitions)}
        title="Informe de patch (formato tipo Titan) — imprimir o guardar como PDF"
      >
        Informe
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={onImportFile}
      />
    </div>
  )
}
