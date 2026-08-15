import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { useShowStore } from '../../store/showStore'
import type { PaletteKind } from '../../model/palette'
import type { WinPos, DeskWindow } from '../../store/showStore'
import { PALETTE_LABELS } from '../../model/palette'
import { EffectsPanel } from '../run/EffectsPanel'
import { AudioPanel } from './AudioPanel'
import { PlaybacksWindow } from './PlaybacksWindow'
import { userNumberOf } from '../../model/types'
import { TEMPLATES } from '../../model/templates'
import { openPatchReport } from '../../model/report'
import { openPlot } from '../../model/plot'
import { exportMvr } from '../../model/mvr'
import { exportGltf } from '../../model/gltf-export'
import { openExtMonitor, closeExtMonitor } from '../../store/vizSync'
import { VisualiserWindow } from './VisualiserWindow'

const PALETTE_KINDS: PaletteKind[] = ['colour', 'position', 'gobo', 'beam', 'intensity']
// Attribute-bank letter for a palette kind (Titan's IPCGB tags on palettes).
const KIND_LETTER: Record<PaletteKind, string> = { intensity: 'I', position: 'P', colour: 'C', gobo: 'G', beam: 'B' }

// Touchscreen workspace tabs. Fixtures is also its own docked window on the right,
// but it lives here too so selection works from the screen like the physical desk.
// Attribute workspaces follow Titan's bank order IPCGBES (Intensity, Position, Colour, Gobo,
// Beam, …); selection/tools sit before, playback/shapes/audio after.
const TABS: { key: string; label: string }[] = [
  { key: 'fixtures', label: 'Fixtures' },
  { key: 'groups', label: 'Groups' },
  { key: 'intensity', label: 'Intensity' },
  { key: 'position', label: 'Position' },
  { key: 'colour', label: 'Colour' },
  { key: 'gobo', label: 'Gobo' },
  { key: 'beam', label: 'Beam' },
  { key: 'playbacks', label: 'Playbacks' },
  { key: 'effects', label: 'Shapes' },
  { key: 'audio', label: 'Audio' },
]

type SoftKey = {
  k: string
  label?: string
  sub?: string
  kind?: 'action' | 'option' | 'menu' | 'text'
  onClick?: () => void
  disabled?: boolean
  info?: boolean
}

const askLegend = (current: string, apply: (name: string) => void) => {
  const name = window.prompt(i18n.t('desk.legendPrompt'), current)
  if (name !== null && name.trim()) apply(name.trim())
}

/** The Quartz touchscreen — Titan-style: workspace windows of hand-legended buttons
 * on the left, the A–G softkey column (physical-look keys) on the right, and the
 * command line along the bottom. */
export function QuartzScreen({ extMonitor }: { extMonitor?: boolean } = {}) {
  const { t } = useTranslation()
  const rawScreen = useShowStore((s) => s.deskScreen)
  const setScreen = useShowStore((s) => s.setDeskScreen)
  const deskWindows = useShowStore((s) => s.deskWindows)
  const deskFocus = useShowStore((s) => s.deskFocus)
  const focusWindow = useShowStore((s) => s.focusWindow)
  const setWindowPos = useShowStore((s) => s.setWindowPos)
  const setWindowRect = useShowStore((s) => s.setWindowRect)
  const moveWindowMonitor = useShowStore((s) => s.moveWindowMonitor)
  const setViewerLocation = useShowStore((s) => s.setViewerLocation)
  const addWindow = useShowStore((s) => s.addWindow)
  const closeWindow = useShowStore((s) => s.closeWindow)
  const selection = useShowStore((s) => s.selection)
  const select = useShowStore((s) => s.select)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const clearSelection = useShowStore((s) => s.clearSelection)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const highlight = useShowStore((s) => s.highlight)
  const toggleHighlight = useShowStore((s) => s.toggleHighlight)
  const programmer = useShowStore((s) => s.programmer)
  const show = useShowStore((s) => s.show)
  const cmd = useShowStore((s) => s.cmd)
  const deskMenu = useShowStore((s) => s.deskMenu)
  const setMenu = useShowStore((s) => s.setDeskMenu)
  const setRightPanel = useShowStore((s) => s.setRightPanel)
  const viewerVisible = useShowStore((s) => s.viewerVisible)
  const setViewerVisible = useShowStore((s) => s.setViewerVisible)
  const extConnected = useShowStore((s) => s.extConnected)
  const setExtConnected = useShowStore((s) => s.setExtConnected)
  // Connect/disconnect the external monitor (Titan's Display Setup). Connecting opens its window;
  // disconnecting closes it and brings any windows on it (incl. the visualiser) back to the desk.
  const toggleExtMonitor = () => {
    if (extConnected) {
      closeExtMonitor()
      useShowStore.getState().deskWindows.filter((w) => w.monitor === 'ext' && w.id !== 'w-viz-ext').forEach((w) => moveWindowMonitor(w.id, 'main'))
      if (useShowStore.getState().viewerLocation === 'ext') setViewerLocation('dock')
      setExtConnected(false)
    } else {
      openExtMonitor()
      setExtConnected(true)
    }
  }
  const exportShow = useShowStore((s) => s.exportShow)
  const importShow = useShowStore((s) => s.importShow)
  const resetShow = useShowStore((s) => s.resetShow)
  const setShowMeta = useShowStore((s) => s.setShowMeta)
  const setShow = useShowStore((s) => s.setShow)
  const addDefinitions = useShowStore((s) => s.addDefinitions)
  const loadTemplate = useShowStore((s) => s.loadTemplate)
  const workspaces = useShowStore((s) => s.workspaces)
  const recallWorkspace = useShowStore((s) => s.recallWorkspace)
  const recordWorkspace = useShowStore((s) => s.recordWorkspace)
  const showFileRef = useRef<HTMLInputElement>(null)
  // Titan "Record Workspace" (Open/View → Record Workspace): stores the current window
  // layout (the mosaic + viewer + folded panes) under a name so you can recall it later.
  const quickRecordWorkspace = () => {
    const name = window.prompt(t('desk.wsNamePrompt'), `Workspace ${workspaces.length + 1}`)
    if (name != null && name.trim()) recordWorkspace(name)
  }
  // The Disk menu, faithful to Titan (Save / Load / New Show). A browser can't write to the
  // desk's internal disk/USB, so Save downloads a .json and Load reads one back — the same
  // action, different medium (the app's top Import/Export do the same, outside the desk).
  const saveShow = () => {
    const blob = new Blob([exportShow()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${show.name?.trim() || 'show'}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMenu('root')
  }
  const loadShow = () => showFileRef.current?.click()
  // Load / Import from a file — a show (.json), an MVR rig, or a GDTF fixture, like Titan's
  // Disk import (the browser's file picker is our "USB pendrive").
  const onShowFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const ext = f.name.toLowerCase().split('.').pop()
    try {
      if (ext === 'mvr') {
        const { importMvrFile } = await import('../../model/mvr-import')
        const { show: sh, definitions } = await importMvrFile(await f.arrayBuffer())
        addDefinitions(definitions)
        setShow(sh)
      } else if (ext === 'gdtf') {
        const { importGdtfFile } = await import('../../model/gdtf-import')
        const def = await importGdtfFile(await f.arrayBuffer())
        addDefinitions([def])
        alert(t('desk.gdtfAdded', { name: `${def.manufacturer} ${def.model}` }))
      } else if (!importShow(JSON.parse(await f.text()))) {
        alert(t('desk.fileInvalid'))
      }
      setMenu('root')
    } catch {
      alert(t('desk.fileError'))
    }
  }
  // Export / Reports — the same formats the app offered, now on the desk's Disk menu.
  const exportJson = () => {
    const blob = new Blob([exportShow()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${show.name?.trim() || 'show'}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMenu('root')
  }
  const runExport = (p: Promise<void>) => { void p.catch(() => alert(t('desk.exportError'))); setMenu('root') }
  const newShow = () => {
    // Titan asks for the new show's name here; keep that flow (the name also shows in Patch).
    const name = window.prompt(t('desk.newShowPrompt'), '')
    if (name && name.trim()) {
      resetShow()
      setShowMeta({ name: name.trim() })
      setMenu('root')
    }
  }

  const groups = useShowStore((s) => s.groups)
  const recordGroup = useShowStore((s) => s.recordGroup)
  const recallGroup = useShowStore((s) => s.recallGroup)
  const renameGroup = useShowStore((s) => s.renameGroup)
  const deleteGroup = useShowStore((s) => s.deleteGroup)
  const palettes = useShowStore((s) => s.palettes)
  const recordPalette = useShowStore((s) => s.recordPalette)
  const applyPalette = useShowStore((s) => s.applyPalette)
  const deletePalette = useShowStore((s) => s.deletePalette)
  const renamePalette = useShowStore((s) => s.renamePalette)
  const renameFixture = useShowStore((s) => s.renameFixture)
  const legendArm = useShowStore((s) => s.legendArm)
  const setLegendArm = useShowStore((s) => s.setLegendArm)
  const recordMask = useShowStore((s) => s.recordMask)
  const toggleRecordMask = useShowStore((s) => s.toggleRecordMask)
  const clearRecordMask = useShowStore((s) => s.clearRecordMask)
  const fixtureLabel = useShowStore((s) => s.fixtureLabel)
  const setFixtureLabel = useShowStore((s) => s.setFixtureLabel)
  const maskActive = !(Object.values(recordMask) as boolean[]).every(Boolean)

  const fixtures = show.fixtures
  const noFx = fixtures.length === 0
  const noSel = selection.length === 0
  const progActive = Object.keys(programmer).length > 0
  // Screens reachable from a Disk/menu softkey rather than a workspace tab (no tab lights up for them).
  const EXTRA_SCREENS = ['showlib']
  const norm = (raw: string) => (TABS.some((tb) => tb.key === raw) || EXTRA_SCREENS.includes(raw) ? raw : 'groups')
  const kindOf = (raw: string): PaletteKind => (PALETTE_KINDS.includes(raw as PaletteKind) ? (raw as PaletteKind) : 'colour')
  // The focused window's workspace drives the tab highlight + the palette record softkeys.
  const screen = norm(rawScreen)
  const kind: PaletteKind = kindOf(rawScreen)
  const palKind = kind
  // Cog (Window Appearance) popover: which window's position picker is open.
  const [cogFor, setCogFor] = useState<string | null>(null)

  const clearAll = () => {
    clearSelection()
    clearProgrammer()
  }

  // ---- Softkey menus (unchanged content; from the Titan manual) ----
  const MENUS: Record<string, { title: string; keys: SoftKey[] }> = {
    root: {
      title: 'Root',
      keys: [
        { k: 'A', label: 'All', sub: 'Select all', kind: 'action', onClick: () => select(fixtures.map((f) => f.id)), disabled: noFx },
        { k: 'B', label: 'Locate', sub: 'Home values', kind: 'action', onClick: locateSelected, disabled: noSel },
        { k: 'C', label: highlight ? 'Highlight ✓' : 'Highlight', sub: t('desk.subHighlight'), kind: 'action', onClick: toggleHighlight },
        { k: 'D', label: 'Clear', sub: 'Programmer', kind: 'action', onClick: clearAll, disabled: noSel && !progActive },
        { k: 'E', label: legendArm ? 'Set Legend ✓' : 'Set Legend', sub: t('desk.setLegendSub'), kind: 'action', onClick: () => setLegendArm(!legendArm) },
        { k: 'F', label: 'Open / View', sub: 'Workspaces', kind: 'menu', onClick: () => setMenu('view') },
        { k: 'G' },
      ],
    },
    view: {
      title: 'Open / View — Workspaces',
      keys: [
        { k: 'A', label: viewerVisible ? 'Visualiser ✓' : 'Visualiser', sub: t('desk.openViz'), kind: 'action', onClick: () => setViewerVisible(!viewerVisible) },
        { k: 'B', label: extConnected ? 'External Monitor ✓' : 'External Monitor', sub: t('desk.extMonitor'), kind: 'action', onClick: toggleExtMonitor },
        { k: 'C', label: 'Record Workspace', sub: t('desk.subRecordWs'), kind: 'action', onClick: quickRecordWorkspace },
        ...(['D', 'E', 'F', 'G'] as const).map((k, i) => {
          const ws = workspaces[i]
          return ws
            ? { k, label: ws.name, sub: t('desk.subRecall'), kind: 'action' as const, onClick: () => { recallWorkspace(ws.id); setMenu('root') } }
            : { k }
        }),
      ],
    },
    record: {
      title: 'Record',
      keys: [
        { k: 'A', label: 'Record Mode', sub: 'By Fixture', kind: 'option', info: true },
        { k: 'B', label: maskActive ? 'Set Mask •' : 'Set Mask', sub: t('desk.maskSub'), kind: 'menu', onClick: () => setMenu('mask') },
        { k: 'C', label: 'Clear Record Mask', kind: 'action', onClick: clearRecordMask, disabled: !maskActive },
        { k: 'D', label: 'Convert to Chase', kind: 'action', info: true },
        { k: 'E', label: 'Convert to Cue List', kind: 'action', info: true },
        { k: 'F' },
        { k: 'G' },
      ],
    },
    mask: {
      title: 'Record Mask — banks to store',
      keys: [
        { k: 'A', label: `Intensity ${recordMask.intensity ? '✓' : '✗'}`, kind: 'action', onClick: () => toggleRecordMask('intensity') },
        { k: 'B', label: `Position ${recordMask.position ? '✓' : '✗'}`, kind: 'action', onClick: () => toggleRecordMask('position') },
        { k: 'C', label: `Colour ${recordMask.colour ? '✓' : '✗'}`, kind: 'action', onClick: () => toggleRecordMask('colour') },
        { k: 'D', label: `Gobo ${recordMask.gobo ? '✓' : '✗'}`, kind: 'action', onClick: () => toggleRecordMask('gobo') },
        { k: 'E', label: `Beam ${recordMask.beam ? '✓' : '✗'}`, kind: 'action', onClick: () => toggleRecordMask('beam') },
        { k: 'F', label: 'Clear Mask', sub: t('desk.maskClear'), kind: 'action', onClick: clearRecordMask, disabled: !maskActive },
        { k: 'G', label: 'Back', kind: 'menu', onClick: () => setMenu('record') },
      ],
    },
    group: {
      title: 'Group',
      keys: [
        { k: 'A', label: 'Record Group', kind: 'action', onClick: recordGroup, disabled: noSel },
        { k: 'B', label: legendArm ? 'Provide a Legend ✓' : 'Provide a Legend', sub: t('desk.setLegendSub'), kind: 'action', onClick: () => setLegendArm(!legendArm) },
        { k: 'C', label: 'Recall Group', kind: 'menu', info: true },
        { k: 'D', label: 'Fixture Order', kind: 'menu', info: true },
        { k: 'E', label: 'Edit Layout', kind: 'menu', info: true },
        { k: 'F' },
        { k: 'G' },
      ],
    },
    patch: {
      title: 'Patch',
      keys: [
        { k: 'A', label: 'Dimmers', kind: 'menu', info: true },
        { k: 'B', label: 'Fixtures', kind: 'menu', info: true },
        { k: 'C', label: 'DMX Line =', kind: 'text', info: true },
        { k: 'D', label: 'Address =', kind: 'text', info: true },
        { k: 'E', label: 'Quantity', kind: 'text', info: true },
        { k: 'F', label: 'User Number =', kind: 'text', info: true },
        { k: 'G', label: 'Open Patch Panel', sub: 'PWA', kind: 'action', onClick: () => setRightPanel('patch') },
      ],
    },
    palette: {
      title: 'Palettes',
      keys: [
        { k: 'A', label: `Record ${PALETTE_LABELS[palKind]}`, kind: 'action', onClick: () => recordPalette(palKind), disabled: noSel },
        { k: 'B', label: 'Set Mask', kind: 'menu', info: true },
        { k: 'C', label: 'Global / Shared', kind: 'option', info: true },
        { k: 'D', label: 'Record By…', kind: 'option', info: true },
        { k: 'E', label: 'Nested Palettes', kind: 'option', info: true },
        { k: 'F', label: legendArm ? 'Provide a Legend ✓' : 'Provide a Legend', sub: t('desk.setLegendSub'), kind: 'action', onClick: () => setLegendArm(!legendArm) },
        { k: 'G' },
      ],
    },
    ml: {
      title: 'ML Menu',
      keys: [
        { k: 'A', label: 'Align', kind: 'menu', info: true },
        { k: 'B', label: 'Flip', kind: 'action', info: true },
        { k: 'C', label: 'Macros', kind: 'menu', info: true },
        { k: 'D' },
        { k: 'E' },
        { k: 'F' },
        { k: 'G' },
      ],
    },
    disk: {
      title: 'Disk',
      keys: [
        { k: 'A', label: 'Save Show', sub: t('desk.subDownloadJson'), kind: 'action', onClick: saveShow },
        { k: 'B', label: 'Save Show As…', sub: t('desk.subDownloadJson'), kind: 'action', onClick: saveShow },
        { k: 'C', label: 'Load Show', sub: t('desk.subOpenJson'), kind: 'action', onClick: loadShow },
        { k: 'D', label: 'New Show', sub: t('desk.subNewShow'), kind: 'action', onClick: newShow },
        { k: 'E', label: 'Import', sub: '.json · MVR · GDTF', kind: 'action', onClick: loadShow },
        { k: 'F', label: 'Export / Reports', kind: 'menu', onClick: () => setMenu('export') },
        { k: 'G', label: 'Show Library', sub: t('desk.subShows'), kind: 'action', onClick: () => { setScreen('showlib'); setMenu('root') } },
      ],
    },
    export: {
      title: 'Export / Reports',
      keys: [
        { k: 'A', label: 'Show file (.json)', kind: 'action', onClick: exportJson },
        { k: 'B', label: 'Patch report (PDF)', kind: 'action', onClick: () => runExport(openPatchReport(show, useShowStore.getState().definitions)) },
        { k: 'C', label: 'Lighting plot (PDF)', kind: 'action', onClick: () => runExport(openPlot(show, useShowStore.getState().definitions)) },
        { k: 'D', label: 'MVR — rig', sub: 'Capture / grandMA…', kind: 'action', onClick: () => runExport(exportMvr(show, useShowStore.getState().definitions)) },
        { k: 'E', label: 'glTF/GLB — 3D', kind: 'action', onClick: () => runExport(exportGltf(show, useShowStore.getState().definitions)) },
        { k: 'F', label: 'Disk', kind: 'menu', onClick: () => setMenu('disk') },
        { k: 'G' },
      ],
    },
  }
  const menu = MENUS[deskMenu] ?? MENUS.root

  const selNames = fixtures.filter((f) => selection.includes(f.id)).map((f) => f.name)

  // ---- Workspace body ----
  const renderCell = (
    id: string,
    legend: string,
    onClick: () => void,
    onRename: () => void,
    onDelete: () => void,
    opts: { active?: boolean; colorClass?: string; disabled?: boolean; ipcg?: string } = {},
  ) => (
    <div key={id} className={`qd-cell${opts.active ? ' active' : ''}${legendArm ? ' legend-pick' : ''} ${opts.colorClass ?? ''}`}>
      <button
        className="qd-cell-hit"
        onClick={legendArm ? () => { onRename(); setLegendArm(false) } : onClick}
        disabled={opts.disabled && !legendArm}
        title={legendArm ? t('desk.setLegendPick') : legend}
      >
        {legend}
      </button>
      {/* Like Titan: only PALETTES carry the attribute-bank letters, and only the ones the
         palette actually stores are lit. Groups (a selection, not stored attributes) get none. */}
      {opts.ipcg !== undefined && (
        <span className="qd-ipcg" title={t('desk.ipcgTip')}>
          {['I', 'P', 'C', 'G', 'B'].map((l) => (
            <span key={l} className={opts.ipcg!.includes(l) ? 'on' : ''}>{l}</span>
          ))}
        </span>
      )}
      <button className="qd-cell-edit" onClick={onRename} title="Rename legend">✎</button>
      <button className="qd-cell-del" onClick={onDelete} title="Delete">✕</button>
    </div>
  )

  const renderBody = (rawScr: string): React.ReactNode => {
    if (rawScr === 'visualiser') return <VisualiserWindow popped />
    const screen = norm(rawScr)
    const kind = kindOf(rawScr)
    let body: React.ReactNode
    if (screen === 'fixtures') {
    body = noFx ? (
      <div className="qd-muted" style={{ padding: 10 }}>Patch fixtures first (Patch mode).</div>
    ) : (
      <div className="qd-ws-grid">
        {fixtures.map((pf, i) => (
          <div key={pf.id} className={`qd-cell ws-fixture${selection.includes(pf.id) ? ' active' : ''}${legendArm ? ' legend-pick' : ''}`}>
            <button
              className="qd-cell-hit"
              onClick={legendArm ? () => { askLegend(pf.name, (n) => renameFixture(pf.id, n)); setLegendArm(false) } : () => toggleSelect(pf.id)}
              title={legendArm ? t('desk.setLegendPick') : `${pf.name} — nº ${userNumberOf(fixtures, i)} · DMX ${pf.universe}.${pf.address} (teclea ${userNumberOf(fixtures, i)} para seleccionarlo)`}
            >
              {fixtureLabel !== 'hidden' && (
                <span className="qd-usernum">{fixtureLabel === 'address' ? `${pf.universe}.${pf.address}` : userNumberOf(fixtures, i)}</span>
              )}
              {pf.name}
            </button>
          </div>
        ))}
      </div>
    )
  } else if (screen === 'audio') {
    body = <AudioPanel />
  } else if (screen === 'effects') {
    body = <EffectsPanel />
  } else if (screen === 'groups') {
    body = (
      <div className="qd-ws-grid">
        {groups.map((g) => {
          const sameSel = g.fixtureIds.length === selection.length && g.fixtureIds.every((id) => selection.includes(id))
          return renderCell(
            g.id,
            g.name,
            () => recallGroup(g.id),
            () => askLegend(g.name, (n) => renameGroup(g.id, n)),
            () => deleteGroup(g.id),
            { active: sameSel && !noSel, colorClass: 'ws-group' },
          )
        })}
        <button className="qd-cell rec" onClick={recordGroup} disabled={noSel} title="Record the current selection as a group">
          ＋ Record Group
        </button>
      </div>
    )
  } else if (screen === 'playbacks') {
    body = <PlaybacksWindow />
  } else if (screen === 'showlib') {
    body = (
      <div className="qd-showlib">
        <div className="qd-showlib-head">
          <span>{t('desk.showLibHeader')}</span>
          <button className="qd-slk-btn" onClick={loadShow}>{t('desk.importFile')}</button>
        </div>
        <div className="qd-showlib-grid">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} className="qd-showcard" onClick={() => { loadTemplate(tpl.id); setScreen('fixtures') }}>
              <b>{tpl.name}</b>
              <small>{tpl.description}</small>
            </button>
          ))}
        </div>
      </div>
    )
  } else {
    const list = palettes.filter((p) => p.kind === kind)
    body = (
      <div className="qd-ws-grid">
        {list.map((p) =>
          renderCell(
            p.id,
            p.name,
            () => applyPalette(p.id),
            () => askLegend(p.name, (n) => renamePalette(p.id, n)),
            () => deletePalette(p.id),
            { colorClass: `ws-${kind}`, disabled: noSel, ipcg: KIND_LETTER[p.kind] },
          ),
        )}
        <button
          className="qd-cell rec"
          onClick={() => recordPalette(kind)}
          disabled={noSel}
          title={`Record a ${PALETTE_LABELS[kind]} palette from the programmer`}
        >
          ＋ Record {PALETTE_LABELS[kind]}
        </button>
      </div>
    )
    }
    return body
  }

  // Standard Titan window positions (Cog / Window Appearance) → % rectangles on the screen.
  const POS_RECT: Record<WinPos, { l: number; t: number; w: number; h: number }> = {
    full: { l: 0, t: 0, w: 100, h: 100 },
    left: { l: 0, t: 0, w: 50, h: 100 }, right: { l: 50, t: 0, w: 50, h: 100 },
    top: { l: 0, t: 0, w: 100, h: 50 }, bottom: { l: 0, t: 50, w: 100, h: 50 },
    tl: { l: 0, t: 0, w: 50, h: 50 }, tr: { l: 50, t: 0, w: 50, h: 50 },
    bl: { l: 0, t: 50, w: 50, h: 50 }, br: { l: 50, t: 50, w: 50, h: 50 },
  }
  const POS_GRID: { pos: WinPos; label: string }[] = [
    { pos: 'tl', label: '◰' }, { pos: 'top', label: '▀' }, { pos: 'tr', label: '◳' },
    { pos: 'left', label: '▌' }, { pos: 'full', label: '□' }, { pos: 'right', label: '▐' },
    { pos: 'bl', label: '◱' }, { pos: 'bottom', label: '▄' }, { pos: 'br', label: '◲' },
  ]
  const tabLabel = (scr: string) =>
    scr === 'visualiser' ? 'Visualiser' : (TABS.find((tb) => tb.key === scr)?.label ?? TABS.find((tb) => tb.key === norm(scr))?.label ?? scr)

  // This screen shows the windows on ITS monitor: the main touchscreen, or the external one.
  const monitor: 'main' | 'ext' = extMonitor ? 'ext' : 'main'
  const windows = deskWindows.filter((w) => (w.monitor ?? 'main') === monitor)
  type Rect = { l: number; t: number; w: number; h: number }
  // Standard AABB overlap (windows touching edge-to-edge do NOT count as overlapping).
  const rectsOverlap = (a: Rect, b: Rect) => a.l < b.l + b.w && a.l + a.w > b.l && a.t < b.t + b.h && a.t + a.h > b.t
  const otherRects = (id: string) => windows.filter((w) => w.id !== id).map((w) => w.rect ?? POS_RECT[w.pos])
  // Would placing window `id` at `rect` sit on top of another window on this monitor?
  const wouldOverlap = (id: string, rect: Rect) => otherRects(id).some((b) => rectsOverlap(rect, b))


  // Free window drag/resize (like Titan's Resize Window): drag the title bar to move, the
  // bottom-right grip to resize. Deltas are converted to % of the mosaic body so the rect
  // stays layout-independent. Clamped to the screen with sensible minimums.
  const bodyRef = useRef<HTMLDivElement>(null)
  const startWinDrag = (e: React.PointerEvent, w: DeskWindow, mode: 'move' | 'resize') => {
    const host = bodyRef.current
    if (!host) return
    e.preventDefault()
    focusWindow(w.id)
    const box = host.getBoundingClientRect()
    const start = w.rect ?? POS_RECT[w.pos]
    const sx = e.clientX
    const sy = e.clientY
    const s0 = { ...start }
    const onMove = (ev: PointerEvent) => {
      const dxp = ((ev.clientX - sx) / box.width) * 100
      const dyp = ((ev.clientY - sy) / box.height) * 100
      let { l, t, w: ww, h } = s0
      if (mode === 'move') {
        l = Math.max(0, Math.min(100 - ww, s0.l + dxp))
        t = Math.max(0, Math.min(100 - h, s0.t + dyp))
      } else {
        ww = Math.max(18, Math.min(100 - s0.l, s0.w + dxp))
        h = Math.max(18, Math.min(100 - s0.t, s0.h + dyp))
      }
      const cand = { l, t, w: ww, h }
      if (wouldOverlap(w.id, cand)) return // would sit on another window — don't apply this step
      setWindowRect(w.id, cand)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className={`qscreen${extMonitor ? ' qscreen--ext' : ''}`} data-tour="titan-screen">
      <input ref={showFileRef} type="file" accept=".json,.mvr,.gdtf,application/json" style={{ display: 'none' }} onChange={onShowFile} />
      {!extMonitor && (
      <div className="qscreen-head">
        <span className="qd-brand">Avolites Quartz</span>
        <span className="qd-titan">TITAN</span>
        <div className="qd-tabs">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              className={`qd-tab-${tb.key}${screen === tb.key ? ' on' : ''}`}
              onClick={() => setScreen(tb.key)}
            >
              {tb.label}
            </button>
          ))}
          <button
            className="qd-tab-add"
            onClick={() => addWindow()}
            disabled={windows.length >= 4}
            title={t('desk.addWindow')}
          >⊞</button>
        </div>
      </div>
      )}

      <div className="qscreen-main">
        <div className="qscreen-body" ref={bodyRef}>
          {windows.map((w) => {
            const r = w.rect ?? POS_RECT[w.pos]
            const focused = w.id === deskFocus
            const single = windows.length === 1
            const isViz = w.id === 'w-viz-ext'
            const sendOther = () => { // ⤢ move to the other monitor (visualiser has its own home)
              if (isViz) { setViewerLocation('dock'); return }
              const to = monitor === 'ext' ? 'main' : 'ext'
              moveWindowMonitor(w.id, to)
              if (to === 'ext') openExtMonitor()
            }
            const close = () => { if (isViz) setViewerLocation('dock'); else closeWindow(w.id) }
            return (
              <div
                key={w.id}
                className={`qd-win${focused ? ' focused' : ''}`}
                style={{ left: `${r.l}%`, top: `${r.t}%`, width: `${r.w}%`, height: `${r.h}%`, zIndex: focused ? 2 : 1 }}
                onMouseDown={() => { if (!focused) focusWindow(w.id) }}
              >
                {(
                  <div className="qd-win-bar" onPointerDown={(e) => startWinDrag(e, w, 'move')} title={t('desk.winMove')}>
                    <span className="qd-win-name">{tabLabel(w.screen)}</span>
                    <span className="qd-win-tools">
                      <button className="qd-win-btn" title={t('desk.winCog')} onClick={(e) => { e.stopPropagation(); setCogFor(cogFor === w.id ? null : w.id) }} onPointerDown={(e) => e.stopPropagation()}>⚙</button>
                      <button className="qd-win-btn" title={t('desk.winClose')} onClick={(e) => { e.stopPropagation(); close() }} onPointerDown={(e) => e.stopPropagation()}>✕</button>
                    </span>
                    {cogFor === w.id && (
                      <div className="qd-cog" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        {POS_GRID.map((g) => {
                          const clash = wouldOverlap(w.id, POS_RECT[g.pos]) // would cover another window
                          return (
                            <button
                              key={g.pos}
                              className={`qd-cog-cell${!w.rect && w.pos === g.pos ? ' on' : ''}`}
                              title={g.pos}
                              disabled={clash}
                              onClick={() => { setWindowPos(w.id, g.pos); setCogFor(null) }}
                            >{g.label}</button>
                          )
                        })}
                        {(extConnected || monitor === 'ext') && (
                          <button className="qd-cog-move" title={monitor === 'ext' ? t('desk.winToMain') : t('desk.winToExt')} onClick={() => { sendOther(); setCogFor(null) }}>
                            {monitor === 'ext' ? '← Monitor 1' : 'Monitor 2 →'}
                          </button>
                        )}
                        {/* Fixtures windows: what the button corner shows (Titan's window option). */}
                        {norm(w.screen) === 'fixtures' && (
                          <div className="qd-cog-fxlabel" title={t('desk.cornerTip')}>
                            <button className={fixtureLabel === 'user' ? 'on' : ''} onClick={() => setFixtureLabel('user')}>User #</button>
                            <button className={fixtureLabel === 'address' ? 'on' : ''} onClick={() => setFixtureLabel('address')}>DMX</button>
                            <button className={fixtureLabel === 'hidden' ? 'on' : ''} onClick={() => setFixtureLabel('hidden')}>Hidden</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="qd-win-body">{renderBody(w.screen)}</div>
                {!single && (
                  <div className="qd-win-grip" title={t('desk.winResize')} onPointerDown={(e) => { e.stopPropagation(); startWinDrag(e, w, 'resize') }} />
                )}
              </div>
            )
          })}
          {extMonitor && windows.length === 0 && (
            <div className="qd-ext-empty">{t('desk.extEmpty')}</div>
          )}
        </div>

        {!extMonitor && (
        <div className="qscreen-soft">
          <div className="qsk-menu">{menu.title}</div>
          {menu.keys.map((sk) => {
            const suffix = sk.kind === 'menu' ? ' ▸' : sk.kind === 'text' ? ' …' : ''
            return (
              <div key={sk.k} className={`qskrow${sk.info ? ' info' : ''}${sk.label ? '' : ' blank'}`}>
                <span className="qsk-lbl" title={sk.info ? t('desk.refOption') : sk.sub}>
                  {sk.label ? (
                    <>
                      {sk.label}
                      {suffix}
                      {sk.info && <span className="qsk-ref" title={t('desk.refOption')}>ref</span>}
                      {sk.kind === 'option' && sk.sub && <span className="qsk-opt">{sk.sub}</span>}
                    </>
                  ) : null}
                </span>
                <button
                  className="qsk-key"
                  disabled={!sk.label || sk.disabled || sk.info}
                  onClick={sk.onClick}
                  title={sk.info ? t('desk.refOption') : (sk.label ?? '')}
                >
                  {sk.k}
                </button>
              </div>
            )
          })}
        </div>
        )}
      </div>

      {!extMonitor && (
      <div className="qscreen-cmd">
        <span className="qcmd-prompt">›</span>
        {legendArm ? (
          <span className="qcmd-line">
            <span className="qcmd-kw">Set Legend</span>
            <span className="qcmd-sel">{t('desk.setLegendPick')}</span>
          </span>
        ) : cmd ? (
          <span className="qcmd-line"><span className="qcmd-typed">{cmd}</span></span>
        ) : noSel ? (
          <span className="qcmd-hint">Fixture</span>
        ) : (
          <span className="qcmd-line">
            <span className="qcmd-kw">Fixture</span>
            <span className="qcmd-sel">{selNames.slice(0, 6).join(' + ')}{selNames.length > 6 ? ` +${selNames.length - 6}` : ''}</span>
          </span>
        )}
        <span className="qcmd-cursor" />
        <span className="qscreen-spacer" />
        {maskActive && (
          <span className="qcmd-mask" title={t('desk.maskActive')}>
            Mask: {(['intensity', 'position', 'colour', 'gobo', 'beam'] as const).filter((k) => recordMask[k]).map((k) => k[0].toUpperCase()).join('·') || '—'}
          </span>
        )}
        <span className={`qcmd-stat${progActive ? ' live' : ''}`}>
          {progActive ? '● Programmer active' : 'Programmer clear'}
        </span>
      </div>
      )}
    </div>
  )
}
