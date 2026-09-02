import auro1 from '../assets/gobos/cameo-auro-spot-z300/g1.png'
import auro2 from '../assets/gobos/cameo-auro-spot-z300/g2.png'
import auro3 from '../assets/gobos/cameo-auro-spot-z300/g3.png'
import auro4 from '../assets/gobos/cameo-auro-spot-z300/g4.png'
import auro5 from '../assets/gobos/cameo-auro-spot-z300/g5.png'
import auro6 from '../assets/gobos/cameo-auro-spot-z300/g6.png'

/** Real gobo-wheel images per fixture definition id, used as the beam pool's alphaMap (white =
 *  light passes) so a spot throws its actual gobo pattern instead of a generic one. Extracted
 *  from each fixture's GDTF wheel images and reduced to compact grayscale PNGs (a few KB each,
 *  emitted by Vite as separate assets loaded only when that fixture is patched). When a fixture
 *  isn't listed here the visualiser falls back to its generic gobo set. */
export const FIXTURE_GOBOS: Record<string, string[]> = {
  // Cameo AURO Spot Z300 — "Gobo 1" rotating wheel (6 gobos).
  'cameo-auro-spot-z300': [auro1, auro2, auro3, auro4, auro5, auro6],
}
