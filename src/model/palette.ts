/**
 * Palettes — reusable stored settings (Avolites' signature feature). A colour /
 * position / gobo / beam / intensity palette captures the relevant channel
 * functions from the programmer so they can be recalled onto any selection.
 *
 * Stored per channel *function* (not per fixture) so a palette recorded on one
 * fixture applies to others that share those functions — the educational point.
 */
import type { ChannelFunction } from './types'

export type PaletteKind = 'colour' | 'position' | 'gobo' | 'beam' | 'intensity'

export interface Palette {
  id: string
  name: string
  kind: PaletteKind
  /** channelFunction → 0–255 */
  values: Partial<Record<ChannelFunction, number>>
}

/** Which channel functions each palette kind captures. */
export const PALETTE_FUNCTIONS: Record<PaletteKind, ChannelFunction[]> = {
  colour: ['red', 'green', 'blue', 'white', 'amber', 'uv', 'colorWheel', 'colorTemp'],
  position: ['pan', 'tilt', 'panFine', 'tiltFine'],
  gobo: ['gobo', 'goboRotation'],
  beam: ['prism', 'zoom', 'focus', 'iris', 'shutter'],
  intensity: ['dimmer'],
}

export const PALETTE_LABELS: Record<PaletteKind, string> = {
  colour: 'Colour',
  position: 'Position',
  gobo: 'Gobo',
  beam: 'Beam',
  intensity: 'Intensity',
}
