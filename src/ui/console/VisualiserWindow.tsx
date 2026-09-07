import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { Visualizer2D } from '../visualizer/Visualizer2D'
import { Visualizer3D } from '../visualizer/Visualizer3D'
import { AimPad } from './AimPad'
import { PwaTag } from '../PwaTag'
import { VENUE_PRESETS } from '../../model/venues'
import { fixtureAttributeKeys } from '../../model/types'
import { PROP_LIBRARY, isPersonKind } from '../visualizer/props'
import type { PropKind } from '../../model/types'

/** The 3D/2D visualiser as a Titan workspace window (the Quartz's Capture output lives on the
 *  touchscreen too). The rig render itself is faithful; the toolbar (venue, room lights, 2D,
 *  aim, effects Play/Pause) is a PWA aid, so it carries the coral PWA tag. */
export function VisualiserWindow({ popped = false }: { popped?: boolean } = {}) {
  const { t } = useTranslation()
  // `popped` === the external-monitor (monitor 2) instance, which is fully independent from the
  // dock (monitor 1): its own 2D/3D and room-lights, so you can run e.g. 2D here + 3D there.
  const ext = popped
  const viewer = useShowStore((s) => (ext ? s.viewerExt : s.viewer))
  const setViewerMain = useShowStore((s) => s.setViewer)
  const setViewerExt = useShowStore((s) => s.setViewerExt)
  const setViewer = ext ? setViewerExt : setViewerMain
  const setViewerVisible = useShowStore((s) => s.setViewerVisible)
  const setViewerLocation = useShowStore((s) => s.setViewerLocation)
  const extConnected = useShowStore((s) => s.extConnected)
  const viewLights = useShowStore((s) => (ext ? s.viewLightsExt : s.viewLights))
  const setViewLightsMain = useShowStore((s) => s.setViewLights)
  const setViewLightsExt = useShowStore((s) => s.setViewLightsExt)
  const setViewLights = ext ? setViewLightsExt : setViewLightsMain
  const venueUrl = useShowStore((s) => s.venueUrl)
  const venueName = useShowStore((s) => s.venueName)
  const venuePreset = useShowStore((s) => s.show.venuePreset)
  const setVenue = useShowStore((s) => s.setVenue)
  const setVenuePreset = useShowStore((s) => s.setVenuePreset)
  const fixtures = useShowStore((s) => s.show.fixtures)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const setFixtureAim = useShowStore((s) => s.setFixtureAim)
  const focusSelected = useShowStore((s) => s.focusSelected)
  const resetView = useShowStore((s) => s.resetView)
  const viewMode = useShowStore((s) => s.viewMode)
  const setCameraView = useShowStore((s) => s.setCameraView)
  const addProp = useShowStore((s) => s.addProp)
  const selectedProp = useShowStore((s) => s.selectedProp)
  const rotateProp = useShowStore((s) => s.rotateProp)
  const removeProp = useShowStore((s) => s.removeProp)
  const setPropFace = useShowStore((s) => s.setPropFace)
  const nudgeFace = useShowStore((s) => s.nudgeFace)
  const props = useShowStore((s) => s.show.props)
  const selProp = props?.find((p) => p.id === selectedProp)
  const selIsPerson = selProp ? isPersonKind(selProp.kind as PropKind) : false
  const effectsCount = useShowStore((s) => s.effects.length)
  const playing = useShowStore((s) => s.playing)
  const setPlaying = useShowStore((s) => s.setPlaying)

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

  // Face photo for a person prop: read the chosen image, centre-crop to a square and shrink to
  // 128 px, then store the tiny JPEG on the prop. The image never leaves the device (no upload).
  const faceRef = useRef<HTMLInputElement>(null)
  const onFaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedProp) return
    const img = new Image()
    img.onload = () => {
      const size = 200
      const cv = document.createElement('canvas')
      cv.width = cv.height = size
      const ctx = cv.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingQuality = 'high'
      const s = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(img.src)
      // PNG, not JPEG: keeps transparency (a cut-out head photo would otherwise get a black
      // background) and avoids JPEG colour loss.
      setPropFace(selectedProp, cv.toDataURL('image/png'))
    }
    img.src = URL.createObjectURL(file)
  }

  // Non-moving fixtures you aim by hand (PARs, profiles…) — the aim joystick appears when one
  // is selected. Same rule as before (no pan/tilt attribute, not a hazer).
  const selAimable = fixtures.filter(
    (pf) => selection.includes(pf.id) && definitions[pf.definitionId] &&
      !fixtureAttributeKeys(definitions[pf.definitionId], pf.modeIndex).has('P') &&
      definitions[pf.definitionId].category !== 'hazer',
  )
  const aim = selAimable[0]?.aim ?? { pan: 0, tilt: 0 }

  return (
    <div className="viz-win">
      <div className="viz-win-tools">
        <PwaTag sim={t('visualizer.pwaSim')} real={t('visualizer.pwaReal')} />
        {effectsCount > 0 && (
          <button className="play-toggle" onClick={() => setPlaying(!playing)} title={playing ? 'Pause effects' : 'Play effects'}>
            {playing ? '❚❚' : '▶'}
          </button>
        )}
        {viewer === '3d' && (
          <>
            <input ref={venueRef} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" style={{ display: 'none' }} onChange={onVenueFile} />
            <select className="venue-select" value={venueUrl ? '__custom' : (venuePreset ?? '')} onChange={(e) => onVenueSelect(e.target.value)} title="Venue behind the rig">
              <option value="">🏛 Venue: none</option>
              {VENUE_PRESETS.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
              {venueUrl && <option value="__custom">{venueName}</option>}
              <option value="__file">Load glTF…</option>
            </select>
            <select className="venue-select" value={viewMode} onChange={(e) => setCameraView(e.target.value as never)} title={t('visualizer.viewTip')}>
              <option value="home">🎥 {t('visualizer.views.home')}</option>
              <option value="techPov">🎛 {t('visualizer.views.techPov')}</option>
              <option value="stage">🎭 {t('visualizer.views.stage')}</option>
              <option value="sideLeft">⬅ {t('visualizer.views.sideLeft')}</option>
              <option value="sideRight">➡ {t('visualizer.views.sideRight')}</option>
            </select>
            <button className={`ghost-btn${viewLights ? ' active' : ''}`} data-tour="room-lights" onClick={() => setViewLights(!viewLights)} title={t('visualizer.roomLights')}>
              💡
            </button>
            <button className="ghost-btn" onClick={() => focusSelected()} disabled={selection.length === 0} title={t('visualizer.focus')}>
              🎯
            </button>
            <button className="ghost-btn" onClick={() => resetView()} title={t('visualizer.homeView')}>
              ⌂
            </button>
            <select className="venue-select" value="" onChange={(e) => { if (e.target.value) addProp(e.target.value as never) }} title={t('props.addTip')}>
              <option value="">➕ {t('props.add')}</option>
              {PROP_LIBRARY.map((p) => (<option key={p.kind} value={p.kind}>{p.emoji} {t(`props.kinds.${p.kind}`)}</option>))}
            </select>
            {selectedProp && (
              <>
                <button className="ghost-btn" onClick={() => rotateProp(selectedProp, -15)} title={t('props.rotL')}>↺</button>
                <button className="ghost-btn" onClick={() => rotateProp(selectedProp, 15)} title={t('props.rotR')}>↻</button>
                {selIsPerson && (
                  <>
                    <input ref={faceRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFaceFile} />
                    <button className="ghost-btn" onClick={() => faceRef.current?.click()} title={t('props.face')}>📷</button>
                    {selProp?.face && (
                      <>
                        <button className="ghost-btn" onClick={() => nudgeFace(selectedProp, 0.2, 0, 0)} title={t('props.faceZoomIn')}>🔍+</button>
                        <button className="ghost-btn" onClick={() => nudgeFace(selectedProp, -0.2, 0, 0)} title={t('props.faceZoomOut')}>🔍−</button>
                        <button className="ghost-btn" onClick={() => nudgeFace(selectedProp, 0, -0.06, 0)} title={t('props.facePan')}>◀</button>
                        <button className="ghost-btn" onClick={() => nudgeFace(selectedProp, 0, 0.06, 0)} title={t('props.facePan')}>▶</button>
                        <button className="ghost-btn" onClick={() => nudgeFace(selectedProp, 0, 0, 0.06)} title={t('props.facePan')}>▲</button>
                        <button className="ghost-btn" onClick={() => nudgeFace(selectedProp, 0, 0, -0.06)} title={t('props.facePan')}>▼</button>
                        <button className="ghost-btn" onClick={() => setPropFace(selectedProp, null)} title={t('props.faceClear')}>🚫</button>
                      </>
                    )}
                  </>
                )}
                <button className="ghost-btn" onClick={() => removeProp(selectedProp)} title={t('props.remove')}>🗑</button>
              </>
            )}
          </>
        )}
        <div className="view-toggle">
          <button className={viewer === '3d' ? 'active' : ''} onClick={() => setViewer('3d')}>3D</button>
          <button className={viewer === '2d' ? 'active' : ''} onClick={() => setViewer('2d')}>2D</button>
        </div>
        {!popped && (
          <>
            {extConnected && (
              <button className="viz-hide" onClick={() => setViewerLocation('ext')} title={t('visualizer.popout')}>⤢</button>
            )}
            <button className="viz-hide" onClick={() => setViewerVisible(false)} title={t('visualizer.hide')}>✕</button>
          </>
        )}
      </div>
      <div className="viz-win-stage" data-tour="visualizer">
        {viewer === '3d' ? <Visualizer3D ext={ext} /> : <Visualizer2D />}
        {viewer === '3d' && selAimable.length > 0 && (
          <div className="viz-aim" title={t('visualizer.aimTip')}>
            <span className="viz-aim-cap">Aim ↺ {selAimable.length > 1 ? `${selAimable.length} ${t('visualizer.aimUnit')}` : selAimable[0].name}</span>
            <AimPad pan={aim.pan} tilt={aim.tilt} onChange={(p, tt) => selAimable.forEach((f) => setFixtureAim(f.id, p, tt))} />
          </div>
        )}
      </div>
    </div>
  )
}
