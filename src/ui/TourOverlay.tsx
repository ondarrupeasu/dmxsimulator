import { useEffect, useState } from 'react'
import { useTour } from '../store/tourStore'
import { useShowStore } from '../store/showStore'
import type { AppMode } from '../store/showStore'

interface Step {
  target?: string // data-tour value to spotlight; omitted = centred card
  mode?: AppMode // switch the app to this mode when the step opens
  title: string
  body: string
}

// A first-truss walkthrough: patch → select → locate → position → colour →
// intensity → record → effect. Each step spotlights the button/zone to use.
const STEPS: Step[] = [
  {
    title: 'Montar un truss de luces',
    body: 'Te guío para encender tu primer truss: seleccionar, posición, color, intensidad, grabar un cue, executors, grupos, un efecto y modo blind. Haz cada paso tú mismo (se resalta el sitio) o pulsa Siguiente para leerlo.',
  },
  { mode: 'patch', target: 'mode-patch', title: 'Patch', body: 'Estás en Patch: aquí eliges y colocas las luces del rig.' },
  {
    mode: 'patch',
    target: 'library',
    title: 'Añade luces',
    body: 'Pulsa “Add” en algún foco (un Moving head o un PAR). Aparece en el rig, y en la lista puedes asignarle truss (Front/Mid/Back/FOH) y universo.',
  },
  { mode: 'program', target: 'mode-program', title: 'Program', body: 'Pasa a Program para controlar las luces que has puesto.' },
  {
    mode: 'program',
    target: 'fixtures',
    title: 'Selecciona',
    body: 'Elige una o varias luces haciendo clic aquí. En la mesa también puedes teclear en el numpad: Fixture 1 Through 4 Enter. Y en el monitor DMX, un clic en un canal selecciona su foco y salta al atributo.',
  },
  {
    mode: 'program',
    target: 'desk-locate',
    title: 'Locate',
    body: 'Pulsa Locate: enciende las luces seleccionadas en su posición base para poder verlas en el visor.',
  },
  { mode: 'program', target: 'desk-position', title: 'Posición', body: 'Selecciona el atributo Position…' },
  { mode: 'program', target: 'desk-wheel', title: 'Ruedas', body: '…y arrastra las ruedas (arriba-izquierda) para orientar el pan/tilt de los focos. Con Fan abanicas los valores por la selección.' },
  {
    mode: 'program',
    target: 'desk-colour',
    title: 'Color',
    body: 'Atributo Colour: cambia el color con las ruedas, o graba/aplica una paleta desde la pantalla Titan.',
  },
  { mode: 'program', target: 'desk-fader', title: 'Intensidad', body: 'Sube un fader de playback (o usa el atributo Intensity) para dar intensidad. Cada fader es el máster de su cue.' },
  {
    mode: 'program',
    target: 'desk-record',
    title: 'Graba un cue',
    body: 'Pulsa Record para guardar este look como un cue. Después lo disparas con Go o con su fader; aparece en la pestaña Playbacks de la pantalla.',
  },
  {
    mode: 'program',
    title: 'Executors',
    body: 'En la fila de arriba de la mesa: con un look en el programmer, pulsa un executor vacío para grabarlo en ese botón. Pulsándolo lo disparas/apagas; clic derecho lo libera. Son tus playbacks a un toque.',
  },
  {
    mode: 'program',
    title: 'Grupos y paletas',
    body: 'En la pantalla Titan (arriba-izquierda), la pestaña Groups guarda selecciones (Record Group) para reusarlas; Colour/Position… guardan paletas. Clic aplica, ✎ renombra el nombre a mano.',
  },
  { mode: 'program', target: 'desk-shape', title: 'Efecto', body: 'Shape abre los efectos (Shapes): añade movimiento o un cambio de color automático.' },
  {
    mode: 'program',
    title: 'Blind',
    body: 'La tecla Blind te deja programar el siguiente look sin que salga a la salida real (el monitor DMX se congela); lo previsualizas en el visor 3D. Útil para preparar cambios en directo.',
  },
  {
    mode: 'program',
    target: 'room-lights',
    title: 'Luz de sala',
    body: 'En el visor, “Luz de sala” enciende la sala para ver dónde está cada foco (con su nombre y dirección DMX). Apágala para diseñar el look a oscuras.',
  },
  {
    target: 'visualizer',
    title: '¡Listo! 🎉',
    body: 'Has montado un truss con posición, color, intensidad, un cue, executors, grupos y un efecto. Repite para más trusses o carga un show de ejemplo desde el menú Disk → Show Library de la mesa. ¡A jugar!',
  },
]

const PAD = 8

export function TourOverlay() {
  const { active, step, next, prev, stop } = useTour()
  const setMode = useShowStore((s) => s.setMode)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const s = STEPS[step]

  // Switch to the step's mode as it opens.
  useEffect(() => {
    if (active && s?.mode) setMode(s.mode)
  }, [active, step, s?.mode, setMode])

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
