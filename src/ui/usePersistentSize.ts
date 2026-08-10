import { useCallback, useState } from 'react'

/**
 * A pixel size (panel width/height) that persists to localStorage and is clamped
 * to [min, max]. Returns the value and an updater that takes the previous value.
 */
export function usePersistentSize(
  key: string,
  initial: number,
  min: number,
  max: number,
): readonly [number, (updater: (prev: number) => number) => void] {
  const storeKey = `dmxsim-size-${key}`
  const [size, setSize] = useState<number>(() => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storeKey) : null
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : initial
  })
  const update = useCallback(
    (updater: (prev: number) => number) => {
      setSize((prev) => {
        const next = Math.min(max, Math.max(min, updater(prev)))
        try {
          localStorage.setItem(storeKey, String(next))
        } catch {
          // ignore quota / privacy-mode errors
        }
        return next
      })
    },
    [storeKey, min, max],
  )
  return [size, update]
}
