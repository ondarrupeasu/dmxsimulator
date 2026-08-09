# DMXSimulatoR — brief

> **Nombre DECIDIDO (8 ago 2026): DMXSimulatoR** (la versión PWA educativa). Carpeta
> `~/Proyectos/dmxsimulator`.
> Proyecto NUEVO e independiente — arrancar en **su propia sesión**, no desde la de
> AV Bible. Documento sembrado el 8 ago 2026 desde la sesión de AV Bible (solo el brief;
> nada de código todavía).
>
> **Producto hermano futuro (si se hace ejecutable Win/Mac con control de mesas reales):
> LightDesignR / LightingDesignR** ("lighting design" es el término correcto; más largo).
> = la línea pro con salida Art-Net/sACN. La PWA DMXSimulatoR es la educativa/simulador.

## Qué es
Idea de Alex: una app **educativa** para que los alumnos aprendan iluminación DMX
**probando** — "un LiveMixR pero para luz". Diseñar un universo DMX, elegir fixtures
típicos del mercado, configurarlos por controles, con una superficie de control
**inspirada en Avolites** y un **visor** que muestra el resultado.

## Decisiones tomadas (8 ago 2026)

- **v1 = PWA, simulador puro, SIN control de hardware real.** Los alumnos aprenden
  experimentando; el visor ES la salida. Fácil de repartir y desplegar (como AV Bible).
- **Filosofía clave (Alex):** el software **abstrae la complejidad específica de cada
  marca de mesa**. Cada consola física hace las cosas a su modo (botonera propia); aquí
  se ofrece una **UI universal y limpia** que enseña los CONCEPTOS sin la muscle-memory
  de una consola concreta. El software se traga la dificultad técnica.
- **Control de hardware real = fase POSTERIOR** (opcional, "para más tarde").

## Alcance v1 (simulador)
- **Patch / universo DMX**: 512 canales por universo; asignar fixtures a direcciones;
  monitor de canales en vivo (didáctico — ver los valores cambiar, algo que una mesa real
  esconde).
- **Librería de fixtures**: usar **GDTF** y/o la **Open Fixture Library** (bases abiertas
  de "personalidades" de fixtures) en vez de teclear cada canal. Fixtures típicos:
  dimmer (1ch), PAR LED RGB/RGBW (3-4ch+), cabeza móvil wash/spot/beam (16+ch: pan/tilt/
  color/gobo/dimmer/strobe…), estrobo, hazer.
- **Superficie de control** *inspirada* en Avolites (programmer, grupos, paletas,
  cue lists, faders de playback), con modelo propio y simplificado. **NO clonar la Titan**
  (enorme + es producto suyo). Alex tiene una mesa concreta en Tartanga (marca/modelo
  PENDIENTE de que la diga) para usar como referencia de flujo.
- **Visor**: mostrar el resultado de lo programado.

## Visor: 3D recomendado
A diferencia del módulo de luz de AV Bible (que es 2.5D), aquí **el 3D sí merece la pena**
(**Three.js/WebGL**): escenario con **haces volumétricos**, cabezas móviles y posiciones
en el espacio se entienden mucho mejor en 3D. Categoría Capture / WYSIWYG / Depence, en web.
Alternativa si hay límite de esfuerzo: **2D cenital + alzado**.

## Stack sugerido (a confirmar al arrancar)
- PWA (como AV Bible): buildable y offline. Framework a decidir (React+Vite encaja).
- Three.js para el visor 3D (aquí SÍ se acepta la dependencia; es una app, no la web
  "sin librerías" de AV Bible).
- **v1 NO necesita red**: nada de Art-Net/sACN ni puente. Autocontenida.

## Nombre (DECIDIDO)
- **PWA educativa = DMXSimulatoR** (dice exactamente lo que es, encaja con "aprender
  probando", searchable). La -R sale sola de "Simulato**R**".
- **Futuro ejecutable Win/Mac con control real = LightDesignR / LightingDesignR.**
Descartados por el camino: LightMixR (choca con LiveMixR), VRLuxR (VR=Virtual Reality),
VirtualLuxR, LuxSimulatoR, LightSimulatoR, RigR, LuxR, BeamR.

## Fase posterior — control real (nota técnica)
Si se añade control de fixtures reales: el **navegador NO puede** emitir Art-Net/sACN
(UDP) ni USB-DMX fiable (WebUSB). Haría falta **escritorio (Electron/nativo)** o
**PWA + puente local** que emita Art-Net/sACN — mismo patrón que el helper de AudioPatchR
o el host agent de MediaDriveR.

## Relación con el resto del portfolio
- AV Bible tendrá un **módulo DMX educativo** (distinto: es una lección dentro de la web,
  no esta app-herramienta).
- Encaja con la suite **CinemaFilmak launchR** y con la línea de virtualización de LiveMixR.

## Al arrancar (checklist)
1. Elegir nombre definitivo y renombrar carpeta.
2. Alex aporta: fixtures concretos del escenario de Tartanga + marca/modelo de la mesa.
3. Decidir stack y si el visor es 3D (Three.js) o 2D cenital/alzado.
4. Scaffolding PWA + modelo de datos (universo/patch/fixtures GDTF) + superficie + visor.
