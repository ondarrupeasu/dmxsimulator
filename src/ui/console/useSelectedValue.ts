import { useMemo } from 'react'
import { useShowStore } from '../../store/showStore'

/** Resolved value of a channel function on the first selected fixture (0–255). */
export function useSelectedValue(fn: string): number {
  const selection = useShowStore((s) => s.selection)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const programmer = useShowStore((s) => s.programmer)
  return useMemo(() => {
    const id = selection[0]
    if (!id) return 0
    const pf = show.fixtures.find((f) => f.id === id)
    if (!pf) return 0
    const channels = definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels ?? []
    const idx = channels.findIndex((c) => c.function === fn)
    if (idx < 0) return 0
    return programmer[id]?.[idx] ?? channels[idx].defaultValue
  }, [fn, selection, show, definitions, programmer])
}

/** Set of all channel functions present across the current selection. */
export function useSelectionFunctions(): Set<string> {
  const selection = useShowStore((s) => s.selection)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  return useMemo(() => {
    const fns = new Set<string>()
    for (const id of selection) {
      const pf = show.fixtures.find((f) => f.id === id)
      const channels = pf && definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
      channels?.forEach((c) => fns.add(c.function))
    }
    return fns
  }, [selection, show, definitions])
}
