import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { Visualizer2D } from '../visualizer/Visualizer2D'
import { Visualizer3D } from '../visualizer/Visualizer3D'
import { AimPad } from './AimPad'
import { PwaTag } from '../PwaTag'
import { VENUE_PRESETS } from '../../model/venues'
import { fixtureAttributeKeys } from '../../model/types'

/** The 3D/2D visualiser as a Titan workspace window (the Quartz's Capture output lives on the
 *  touchscreen too). The rig render itself is faithful; the toolbar (venue, room lights, 2D,
 *  aim, effects Play/Pause) is a PWA aid, so it carries the coral PWA tag. */
export function VisualiserWindow() {
  const { t } = useTranslation()
  const viewer = useShowStore((s) => s.viewer)
  const setViewer = useShowStore((s) => s.setViewer)
  const viewLights = useShowStore((s) => s.viewLights)
  const setViewLights = useShowStore((s) => s.setViewLights)
  const venueUrl = useShowStore((s) => s.venueUrl)
  const venueName = useShowStore((s) => s.venueName)
  const venuePreset = useShowStore((s) => s.show.venuePreset)
  const setVenue = useShowStore((s) => s.setVenue)
  const setVenuePreset = useShowStore((s) => s.setVenuePreset)
  const fixtures = useShowStore((s) => s.show.fixtures)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const setFixtureAim = useShowStore((s) => s.setFixtureAim)
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
        <PwaTag
          sim="ayudas del simulador: Play/Pausa de efectos, cargar decorado, luces de sala, vista 2D y orientar PARs a mano"
          real="el visor (Capture) del Quartz no trae estos controles, o los hace de otra forma"
        />
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
            <button className={`ghost-btn${viewLights ? ' active' : ''}`} onClick={() => setViewLights(!viewLights)} title={t('visualizer.roomLights')}>
              💡
            </button>
          </>
        )}
        <div className="view-toggle">
          <button className={viewer === '3d' ? 'active' : ''} onClick={() => setViewer('3d')}>3D</button>
          <button className={viewer === '2d' ? 'active' : ''} onClick={() => setViewer('2d')}>2D</button>
        </div>
      </div>
      <div className="viz-win-stage">
        {viewer === '3d' ? <Visualizer3D /> : <Visualizer2D />}
        {viewer === '3d' && selAimable.length > 0 && (
          <div className="viz-aim" title="Orientar el foco a mano (montaje físico — no es DMX).">
            <span className="viz-aim-cap">Aim ↺ {selAimable.length > 1 ? `${selAimable.length} focos` : selAimable[0].name}</span>
            <AimPad pan={aim.pan} tilt={aim.tilt} onChange={(p, tt) => selAimable.forEach((f) => setFixtureAim(f.id, p, tt))} />
          </div>
        )}
      </div>
    </div>
  )
}
