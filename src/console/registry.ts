/**
 * Registry of available control surfaces. Adding a console = one entry here.
 */
import type { ConsoleDefinition } from './types'
import { UniversalSurface } from '../ui/console/UniversalSurface'
import { QuartzPanel } from '../ui/console/QuartzPanel'

export const CONSOLES: ConsoleDefinition[] = [
  {
    id: 'avolites-quartz',
    brand: 'Avolites',
    model: 'Quartz',
    status: 'wip',
    // Rendered as a 4-quadrant layout (screen + panel) by AppShell when docked.
    Surface: QuartzPanel,
    note: 'Faithful Quartz panel — practise the real desk. In progress.',
  },
  {
    id: 'universal',
    brand: 'DMXSimulatoR',
    model: 'Universal (clean)',
    status: 'available',
    Surface: UniversalSurface,
    note: 'Brand-neutral surface — learn the concepts without a specific desk.',
  },
]

const byId: Record<string, ConsoleDefinition> = Object.fromEntries(
  CONSOLES.map((c) => [c.id, c]),
)

export function consoleById(id: string): ConsoleDefinition {
  return byId[id] ?? CONSOLES[0]
}
