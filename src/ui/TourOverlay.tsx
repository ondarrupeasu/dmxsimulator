import { useEffect, useState } from 'react'
import { useTour } from '../store/tourStore'
import { useShowStore } from '../store/showStore'

interface Step {
  target?: string // data-tour value to spotlight; omitted = centred card
  enter?: () => void // prepare the desk (open a window/panel) when the step opens
  title: string
  body: string
}

// A first-truss walkthrough on the unified Quartz desk: patch → select → locate →
// position → colour → intensity → record → executors → groups → effect → blind →
// visualiser. Each step spotlights the key/zone to use and opens the right window.
const focusScreen = (screen: string) => useShowStore.getState().setDeskScreen(screen)
const STEPS: Step[] = [
  {
    title: 'Montar un truss de luces',
    body: 'Te guío para encender tu primer truss: añadir focos, seleccionar, posición, color, intensidad, grabar un cue, executors, grupos, un efecto y modo Blind. Haz cada paso tú mismo (se resalta el sitio) o pulsa Siguiente para leerlo.',
  },
  {
    target: 'library',
    enter: () => useShowStore.getState().setRightPanel('patch'),
    title: 'Añade luces',
    body: 'Se ha abierto el panel Patch (PWA). Pulsa “Add” en algún foco (un Moving head o un PAR): aparece en el rig, y puedes asignarle truss (Front/Mid/Back/FOH), universo y dirección. En la mesa real esto se hace desde el menú Patch.',
  },
  {
    target: 'fixtures',
    enter: () => focusScreen('fixtures'),
    title: 'Selecciona',
    body: 'En la ventana Fixtures (pantalla Titan) elige una o varias luces con un clic. En la mesa también puedes teclear en el numpad: Fixture 1 Through 4 Enter. Y en el monitor DMX, un clic en un canal selecciona su foco.',
  },
  {
    target: 'desk-locate',
    title: 'Locate',
    body: 'Pulsa Locate: enciende las luces seleccionadas en su posición base para poder verlas en el visor.',
  },
  { target: 'desk-position', title: 'Position', body: 'Selecciona el atributo Position…' },
  { target: 'desk-wheel', title: 'Ruedas', body: '…y arrastra las ruedas (arriba-izquierda) para orientar el pan/tilt de los focos. Con Fan abanicas los valores por la selección.' },
  {
    target: 'desk-colour',
    title: 'Colour',
    body: 'Atributo Colour: cambia el color con las ruedas, o graba/aplica una paleta desde la pantalla Titan.',
  },
  { target: 'desk-fader', title: 'Intensidad', body: 'Sube un fader de playback (o usa el atributo Intensity) para dar intensidad. Cada fader es el máster de su cue.' },
  {
    target: 'desk-record',
    title: 'Graba un cue',
    body: 'Pulsa Record para guardar este look como un cue. Después lo disparas con Go o con su fader; aparece en la pestaña Playbacks de la pantalla.',
  },
  {
    target: 'desk-executors',
    title: 'Executors',
    body: 'La fila de arriba de la mesa: con un look en el programmer, pulsa un executor vacío para grabarlo en ese botón. Pulsándolo lo disparas/apagas; clic derecho lo libera. Son tus playbacks a un toque.',
  },
  {
    target: 'titan-screen',
    enter: () => focusScreen('groups'),
    title: 'Grupos y paletas',
    body: 'En la pantalla Titan, la ventana Groups guarda selecciones (Record Group) para reusarlas; Colour/Position… guardan paletas. Clic aplica, ✎ renombra a mano.',
  },
  { target: 'desk-shape', title: 'Efecto', body: 'Shape abre los efectos (Shapes): añade movimiento o un cambio de color automático.' },
  {
    target: 'desk-blind',
    title: 'Blind',
    body: 'La tecla Blind te deja programar el siguiente look sin que salga a la salida real (el monitor DMX se congela); lo previsualizas en el visor 3D. Útil para preparar cambios en directo.',
  },
  {
    target: 'room-lights',
    enter: () => useShowStore.getState().setViewerVisible(true),
    title: 'Luz de sala',
    body: 'En el visor, la 💡 enciende la sala para ver dónde está cada foco (con su nombre y dirección DMX). Apágala para diseñar el look a oscuras.',
  },
  {
    target: 'visualizer',
    enter: () => useShowStore.getState().setViewerVisible(true),
    title: '¡Listo! 🎉',
    body: 'Has montado un truss con posición, color, intensidad, un cue, executors, grupos y un efecto. Repite para más trusses o carga un show de ejemplo desde el menú Disk → Show Library de la mesa. ¡A jugar!',
  },
]

const PAD = 8

export function TourOverlay() {
  const { active, step, next, prev, stop } = useTour()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const s = STEPS[step]

  // Prepare the desk for this step (open the right window/panel) as it opens.
  useEffect(() => {
    if (active && s?.enter) s.enter()
  }, [active, step, s])

  // Measure the spotlight target. Re-measure across a few frames so the highlight
  // never lags a step behind while the layout (mode switch, panel reflow) settles.
  useEffect(() => {
    if (!active || !s) return
    const measure = () => {
      const el = s.target ? document.querySelector(`[data-tour="${s.target}"]`) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    // rAF catches layout after React commits; the extra timers catch late reflow.
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure))
    const timers = [80, 200, 400].map((d) => window.setTimeout(measure, d))
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach((t) => window.clearTimeout(t))
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active, step, s])

  if (!active || !s) return null
  const last = step === STEPS.length - 1
  const advance = () => (last ? stop() : next())

  // Place the callout under the target if there's room, else above; centre if no target.
  const vw = window.innerWidth
  const vh = window.innerHeight
  const calloutW = Math.min(360, vw - 24)
  let calloutStyle: React.CSSProperties
  if (rect) {
    const below = rect.bottom + 12
    const above = rect.top - 12
    const placeBelow = below + 180 < vh
    const left = Math.max(12, Math.min(rect.left, vw - calloutW - 12))
    calloutStyle = placeBelow
      ? { top: below, left, width: calloutW }
      : { bottom: vh - above, left, width: calloutW }
  } else {
    calloutStyle = { top: '50%', left: '50%', width: calloutW, transform: 'translate(-50%, -50%)' }
  }

  return (
    <div className="tour-root">
      {rect ? (
        <div
          className="tour-hole"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-callout" style={calloutStyle}>
        <div className="tour-step-n">Paso {step + 1} / {STEPS.length}</div>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
        <div className="tour-actions">
          <button className="tour-skip" onClick={stop}>Salir</button>
          <span className="tour-spacer" />
          {step > 0 && <button className="tour-prev" onClick={prev}>Atrás</button>}
          <button className="tour-next" onClick={advance}>{last ? 'Terminar' : 'Siguiente'}</button>
        </div>
      </div>
    </div>
  )
}
