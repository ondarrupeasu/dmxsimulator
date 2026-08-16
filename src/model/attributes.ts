/** Titan attribute banks (IPCGBES) and the channel functions each holds, in wheel order.
 *  A bank can hold more functions than the 3 wheels — re-pressing the bank key PAGES through
 *  them (Titan behaviour), so e.g. Colour is Red/Green/Blue on page 1, White/CTO on page 2.
 *  Shared by the physical wheels (QuartzPanel) and the on-screen wheel display (QuartzScreen). */
export interface AttributeBank {
  name: string
  /** All the bank's functions, in the order they lay across the wheels/pages. */
  functions: string[]
}

export const ATTRIBUTE_BANKS: AttributeBank[] = [
  { name: 'Intensity', functions: ['dimmer', 'shutter', 'strobe', 'haze'] },
  { name: 'Position', functions: ['pan', 'tilt'] },
  { name: 'Colour', functions: ['red', 'green', 'blue', 'white', 'amber', 'uv', 'colorWheel', 'colorTemp'] },
  { name: 'Gobo', functions: ['gobo', 'goboRotation'] },
  { name: 'Beam', functions: ['zoom', 'focus', 'iris', 'prism'] },
  { name: 'Effect', functions: [] },
  { name: 'Special', functions: [] },
]

export const bankByName = (name: string): AttributeBank => ATTRIBUTE_BANKS.find((b) => b.name === name) ?? ATTRIBUTE_BANKS[0]

/** The bank's functions the current selection actually has, in bank order. */
export const bankFunctions = (name: string, present: Set<string>): string[] =>
  bankByName(name).functions.filter((fn) => present.has(fn))

/** How many wheel pages the bank needs for this selection (min 1). */
export const wheelPageCount = (name: string, present: Set<string>): number =>
  Math.max(1, Math.ceil(bankFunctions(name, present).length / 3))

/** The 3 functions on the wheels for a given page (wraps; undefined where a wheel is empty). */
export const wheelPageFns = (name: string, present: Set<string>, page: number): (string | undefined)[] => {
  const avail = bankFunctions(name, present)
  const pages = wheelPageCount(name, present)
  const p = ((page % pages) + pages) % pages
  return [0, 1, 2].map((i) => avail[p * 3 + i])
}
