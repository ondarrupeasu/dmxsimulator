/** The rig's trusses, shared by the patch UI and the 3D visualiser so a fixture's
 *  `truss` index means the same thing everywhere. Matches the Tartanga layout:
 *  three trusses over the stage (front → back) plus a front-of-house truss over the
 *  audience aimed back at the stage. */
export interface TrussDef {
  id: number
  name: string
  z: number // world Z (positive = toward the audience/downstage)
  y: number // hang height in metres
  foh?: boolean // front-of-house: hangs over the audience, aims at the stage
}

export const TRUSSES: TrussDef[] = [
  { id: 0, name: 'Front', z: 4, y: 5 },
  { id: 1, name: 'Mid', z: 0, y: 5 },
  { id: 2, name: 'Back', z: -4, y: 5 },
  { id: 3, name: 'FOH', z: 9, y: 7, foh: true },
]

/** Default truss for fixtures with no explicit assignment (the middle stage truss). */
export const DEFAULT_TRUSS = 1

export const trussById = (id: number | undefined): TrussDef =>
  TRUSSES.find((t) => t.id === id) ?? TRUSSES[DEFAULT_TRUSS]

/** Stage deck (tarima) height above the floor, in metres. */
export const STAGE_TOP = 1
