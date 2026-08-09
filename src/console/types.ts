/**
 * Console surface layer.
 *
 * A console is an interchangeable "skin" over the shared core (patch, programmer,
 * DMX engine, visualizer). The student picks a console and practises *that* desk;
 * every console drives the same underlying show state. Add a new desk by adding a
 * ConsoleDefinition to the registry — the core never changes.
 */
import type { ComponentType } from 'react'

export type ConsoleStatus = 'available' | 'wip' | 'planned'

export interface ConsoleDefinition {
  id: string
  brand: string
  model: string
  status: ConsoleStatus
  /** Renders the control surface shown in Program/Run modes. */
  Surface: ComponentType
  /** Short note for the picker (what's inspired/faithful, what's missing). */
  note?: string
}
