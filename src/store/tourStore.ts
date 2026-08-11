import { create } from 'zustand'

/** Guided-tour state for the step-by-step novice tutorial (see ui/TourOverlay). */
interface TourState {
  active: boolean
  step: number
  start: () => void
  stop: () => void
  next: () => void
  prev: () => void
}

export const useTour = create<TourState>((set) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  stop: () => set({ active: false }),
  next: () => set((s) => ({ step: s.step + 1 })),
  prev: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
}))
