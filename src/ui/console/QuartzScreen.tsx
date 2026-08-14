import { useRef, useState } from 'react'
import { useShowStore } from '../../store/showStore'
import type { PaletteKind } from '../../model/palette'
import type { WinPos } from '../../store/showStore'
import { PALETTE_LABELS } from '../../model/palette'
import { EffectsPanel } from '../run/EffectsPanel'
import { AudioPanel } from './AudioPanel'
import { PlaybacksWindow } from './PlaybacksWindow'
import { VisualiserWindow } from './VisualiserWindow'
import { userNumberOf } from '../../model/types'
import { TEMPLATES } from '../../model/templates'
import { openPatchReport } from '../../model/report'
import { openPlot } from '../../model/plot'
import { exportMvr } from '../../model/mvr'
import { exportGltf } from '../../model/gltf-export'

const PALETTE_KINDS: PaletteKind[] = ['colour', 'position', 'gobo', 'beam', 'intensity']

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
  { key: 'visualiser', label: 'Visualiser' },
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
  const name = window.prompt('Nombre (legend):', current)
  if (name !== null && name.trim()) apply(name.trim())
}

/** The Quartz touchscreen — Titan-style: workspace windows of hand-legended buttons
 * on the left, the A–G softkey column (physical-look keys) on the right, and the
 * command line along the bottom. */
export function QuartzScreen() {
  const rawScreen = useShowStore((s) => s.deskScreen)
  const setScreen = useShowStore((s) => s.setDeskScreen)
  const deskWindows = useShowStore((s) => s.deskWindows)
  const deskFocus = useShowStore((s) => s.deskFocus)
  const focusWindow = useShowStore((s) => s.focusWindow)
  const setWindowPos = useShowStore((s) => s.setWindowPos)
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
  const setMode = useShowStore((s) => s.setMode)
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
    const name = window.prompt('Nombre del Workspace:', `Workspace ${workspaces.length + 1}`)
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
        alert(`Fixture añadido a la librería: ${def.manufacturer} ${def.model}`)
      } else if (!importShow(JSON.parse(await f.text()))) {
        alert('Ese archivo no es un show válido.')
      }
      setMenu('root')
    } catch {
      alert('No se pudo leer el archivo.')
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
  const runExport = (p: Promise<void>) => { void p.catch(() => alert('No se pudo exportar.')); setMenu('root') }
  const newShow = () => {
    // Titan asks for the new show's name here; keep that flow (the name also shows in Patch).
    const name = window.prompt('New Show — nombre del nuevo show (deja vacío para cancelar):', '')
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
        { k: 'C', label: highlight ? 'Highlight ✓' : 'Highlight', sub: 'Ver selección', kind: 'action', onClick: toggleHighlight },
        { k: 'D', label: 'Clear', sub: 'Programmer', kind: 'action', onClick: clearAll, disabled: noSel && !progActive },
        { k: 'E', label: 'Set Legend', kind: 'text', info: true },
        { k: 'F', label: 'Open / View', sub: 'Workspaces', kind: 'menu', onClick: () => setMenu('view') },
        { k: 'G' },
      ],
    },
    view: {
      title: 'Open / View — Workspaces',
      keys: [
        { k: 'A', label: 'Record Workspace', sub: 'Guarda el mosaico', kind: 'action', onClick: quickRecordWorkspace },
        ...(['B', 'C', 'D', 'E', 'F', 'G'] as const).map((k, i) => {
          const ws = workspaces[i]
          return ws
            ? { k, label: ws.name, sub: 'Recuperar', kind: 'action' as const, onClick: () => { recallWorkspace(ws.id); setMenu('root') } }
            : { k }
        }),
      ],
    },
    record: {
      title: 'Record',
      keys: [
        { k: 'A', label: 'Record Mode', sub: 'By Fixture', kind: 'option', info: true },
        { k: 'B', label: 'Set Mask', kind: 'menu', info: true },
        { k: 'C', label: 'Clear Record Mask', kind: 'action', info: true },
        { k: 'D', label: 'Convert to Chase', kind: 'action', info: true },
        { k: 'E', label: 'Convert to Cue List', kind: 'action', info: true },
        { k: 'F' },
        { k: 'G' },
      ],
    },
    group: {
      title: 'Group',
      keys: [
        { k: 'A', label: 'Record Group', kind: 'action', onClick: recordGroup, disabled: noSel },
        { k: 'B', label: 'Provide a Legend', kind: 'text', info: true },
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
        { k: 'G', label: 'Open Patch View', kind: 'action', onClick: () => setMode('patch') },
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
        { k: 'F', label: 'Provide a Legend', kind: 'text', info: true },
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
        { k: 'A', label: 'Save Show', sub: 'Descarga .json', kind: 'action', onClick: saveShow },
        { k: 'B', label: 'Save Show As…', sub: 'Descarga .json', kind: 'action', onClick: saveShow },
        { k: 'C', label: 'Load Show', sub: 'Abre .json', kind: 'action', onClick: loadShow },
        { k: 'D', label: 'New Show', sub: 'Borra y empieza', kind: 'action', onClick: newShow },
        { k: 'E', label: 'Import', sub: '.json · MVR · GDTF', kind: 'action', onClick: loadShow },
        { k: 'F', label: 'Export / Reports', kind: 'menu', onClick: () => setMenu('export') },
        { k: 'G', label: 'Show Library', sub: 'Shows de ejemplo', kind: 'action', onClick: () => { setScreen('showlib'); setMenu('root') } },
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
    opts: { active?: boolean; colorClass?: string; disabled?: boolean } = {},
  ) => (
    <div key={id} className={`qd-cell${opts.active ? ' active' : ''} ${opts.colorClass ?? ''}`}>
      <button className="qd-cell-hit" onClick={onClick} disabled={opts.disabled} title={legend}>
        {legend}
      </button>
      <span className="qd-ipcg">I P C G B E S FX</span>
      <button className="qd-cell-edit" onClick={onRename} title="Rename legend">✎</button>
      <button className="qd-cell-del" onClick={onDelete} title="Delete">✕</button>
    </div>
  )

  const renderBody = (rawScr: string): React.ReactNode => {
    const screen = norm(rawScr)
    const kind = kindOf(rawScr)
    let body: React.ReactNode
    if (screen === 'fixtures') {
    body = noFx ? (
      <div className="qd-muted" style={{ padding: 10 }}>Patch fixtures first (Patch mode).</div>
    ) : (
      <div className="qd-ws-grid">
        {fixtures.map((pf, i) => (
          <div key={pf.id} className={`qd-cell ws-fixture${selection.includes(pf.id) ? ' active' : ''}`}>
            <button className="qd-cell-hit" onClick={() => toggleSelect(pf.id)} title={`${pf.name} — nº ${userNumberOf(fixtures, i)} (teclea ${userNumberOf(fixtures, i)} para seleccionarlo)`}>
              <span className="qd-usernum">{userNumberOf(fixtures, i)}</span>
              {pf.name}
            </button>
          </div>
        ))}
      </div>
    )
  } else if (screen === 'visualiser') {
    body = <VisualiserWindow />
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
          <span>Show Library — shows de ejemplo</span>
          <button className="qd-slk-btn" onClick={loadShow}>Importar archivo…</button>
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
            { colorClass: `ws-${kind}`, disabled: noSel },
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
  const tabLabel = (scr: string) => TABS.find((tb) => tb.key === norm(scr))?.label ?? scr

  return (
    <div className="qscreen" data-tour="titan-screen">
      <input ref={showFileRef} type="file" accept=".json,.mvr,.gdtf,application/json" style={{ display: 'none' }} onChange={onShowFile} />
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
            disabled={deskWindows.length >= 4}
            title="Abrir otra ventana en mosaico (hasta 4 — como el touchscreen del Titan)"
          >⊞</button>
        </div>
      </div>

      <div className="qscreen-main">
        <div className="qscreen-body">
          {deskWindows.map((w) => {
            const r = POS_RECT[w.pos]
            const focused = w.id === deskFocus
            const single = deskWindows.length === 1
            return (
              <div
                key={w.id}
                className={`qd-win${focused && !single ? ' focused' : ''}`}
                style={{ left: `${r.l}%`, top: `${r.t}%`, width: `${r.w}%`, height: `${r.h}%`, zIndex: focused ? 2 : 1 }}
                onMouseDown={() => { if (!focused) focusWindow(w.id) }}
              >
                {!single && (
                  <div className="qd-win-bar">
                    <span className="qd-win-name">{tabLabel(w.screen)}</span>
                    <span className="qd-win-tools">
                      <button className="qd-win-btn" title="Window Appearance (posición/tamaño)" onClick={(e) => { e.stopPropagation(); setCogFor(cogFor === w.id ? null : w.id) }}>⚙</button>
                      <button className="qd-win-btn" title="Cerrar esta ventana" onClick={(e) => { e.stopPropagation(); closeWindow(w.id) }}>✕</button>
                    </span>
                    {cogFor === w.id && (
                      <div className="qd-cog" onMouseDown={(e) => e.stopPropagation()}>
                        {POS_GRID.map((g) => (
                          <button
                            key={g.pos}
                            className={`qd-cog-cell${w.pos === g.pos ? ' on' : ''}`}
                            title={g.pos}
                            onClick={() => { setWindowPos(w.id, g.pos); setCogFor(null) }}
                          >{g.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="qd-win-body">{renderBody(w.screen)}</div>
              </div>
            )
          })}
        </div>

        <div className="qscreen-soft">
          <div className="qsk-menu">{menu.title}</div>
          {menu.keys.map((sk) => {
            const suffix = sk.kind === 'menu' ? ' ▸' : sk.kind === 'text' ? ' …' : ''
            return (
              <div key={sk.k} className={`qskrow${sk.info ? ' info' : ''}${sk.label ? '' : ' blank'}`}>
                <span className="qsk-lbl" title={sk.info ? 'Opción real del menú Titan (referencia)' : sk.sub}>
                  {sk.label ? (
                    <>
                      {sk.label}
                      {suffix}
                      {sk.kind === 'option' && sk.sub && <span className="qsk-opt">{sk.sub}</span>}
                    </>
                  ) : null}
                </span>
                <button
                  className="qsk-key"
                  disabled={!sk.label || sk.disabled}
                  onClick={sk.onClick}
                  title={sk.label ?? ''}
                >
                  {sk.k}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="qscreen-cmd">
        <span className="qcmd-prompt">›</span>
        {cmd ? (
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
        <span className={`qcmd-stat${progActive ? ' live' : ''}`}>
          {progActive ? '● Programmer active' : 'Programmer clear'}
        </span>
      </div>
    </div>
  )
}
