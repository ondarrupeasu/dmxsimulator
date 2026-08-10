import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * A draggable divider between two flex panes. `dir='col'` is a vertical bar that
 * resizes width (drag on X); `dir='row'` is a horizontal bar that resizes height
 * (drag on Y). `onDrag` receives the pointer delta in px since the last move.
 */
export function Splitter({
  dir,
  onDrag,
}: {
  dir: 'col' | 'row'
  onDrag: (delta: number) => void
}) {
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    let last = dir === 'col' ? e.clientX : e.clientY
    document.body.style.userSelect = 'none'
    document.body.style.cursor = dir === 'col' ? 'col-resize' : 'row-resize'
    const move = (ev: PointerEvent) => {
      const cur = dir === 'col' ? ev.clientX : ev.clientY
      onDrag(cur - last)
      last = cur
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      className={`splitter splitter-${dir}`}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation={dir === 'col' ? 'vertical' : 'horizontal'}
    />
  )
}
