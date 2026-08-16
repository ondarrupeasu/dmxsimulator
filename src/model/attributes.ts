/** Titan attribute banks (IPCGBES) and the channel functions each of the 3 wheels controls.
 *  Shared by the physical wheels (QuartzPanel) and the on-screen wheel display (QuartzScreen).
 *  Each wheel slot lists the candidate functions; a fixture uses the first one it actually has. */
export interface AttributeBank {
  name: string
  /** Up to 3 wheels; each is a list of candidate channel functions (first the fixture has wins). */
  wheels: string[][]
}

export const ATTRIBUTE_BANKS: AttributeBank[] = [
  { name: 'Intensity', wheels: [['dimmer', 'haze'], ['shutter', 'strobe']] },
  { name: 'Position', wheels: [['pan'], ['tilt']] },
  { name: 'Colour', wheels: [['red', 'colorWheel'], ['green', 'amber'], ['blue', 'white']] },
  { name: 'Gobo', wheels: [['gobo'], ['goboRotation']] },
  { name: 'Beam', wheels: [['prism', 'iris'], ['zoom'], ['focus']] },
  { name: 'Effect', wheels: [] },
  { name: 'Special', wheels: [] },
]

export const bankByName = (name: string): AttributeBank => ATTRIBUTE_BANKS.find((b) => b.name === name) ?? ATTRIBUTE_BANKS[0]
