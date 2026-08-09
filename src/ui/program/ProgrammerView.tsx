import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShowStore } from '../../store/showStore'
import { computeVisualState } from '../../engine/render'

/** Read the resolved value of a channel function on the first selected fixture. */
function useSelectedValue(fn: string): number {
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

function Fader({ label, fn }: { label: string; fn: string }) {
  const value = useSelectedValue(fn)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  return (
    <div className="fader-row">
      <label>{label}</label>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        onChange={(e) => setByFn(fn, Number(e.target.value))}
      />
      <span className="num">{value}</span>
    </div>
  )
}

export function ProgrammerView() {
  const { t } = useTranslation()
  const selection = useShowStore((s) => s.selection)
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const programmer = useShowStore((s) => s.programmer)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)

  // Colour swatch of the first selected fixture.
  const swatch = useMemo(() => {
    const id = selection[0]
    const pf = show.fixtures.find((f) => f.id === id)
    const def = pf && definitions[pf.definitionId]
    if (!pf || !def) return null
    const channels = def.modes[pf.modeIndex]?.channels ?? []
    const values = channels.map((ch, i) => programmer[id]?.[i] ?? ch.defaultValue)
    const vs = computeVisualState(def, pf.modeIndex, values)
    return `rgb(${vs.color.r},${vs.color.g},${vs.color.b})`
  }, [selection, show, definitions, programmer])

  const hasColor = useMemo(() => {
    const id = selection[0]
    const pf = show.fixtures.find((f) => f.id === id)
    const channels = pf && definitions[pf.definitionId]?.modes[pf.modeIndex]?.channels
    return !!channels?.some((c) =>
      ['red', 'green', 'blue', 'white'].includes(c.function),
    )
  }, [selection, show, definitions])

  return (
    <div className="panel">
      <header>
        <h2>{t('program.title')}</h2>
        <span className="sub">{t('program.selected', { count: selection.length })}</span>
      </header>
      <div className="scroll">
        {selection.length === 0 ? (
          <div className="prog-empty">{t('program.selectHint')}</div>
        ) : (
          <>
            <div className="row-actions">
              <button className="primary" onClick={locateSelected}>
                {t('program.locate')}
              </button>
              <button onClick={clearProgrammer}>{t('program.clear')}</button>
              {swatch && <span className="swatch" style={{ background: swatch }} />}
            </div>

            <div className="section-label">{t('program.intensity')}</div>
            <Fader label={t('program.intensity')} fn="dimmer" />

            {hasColor && (
              <>
                <div className="section-label">{t('program.color')}</div>
                <Fader label="Red" fn="red" />
                <Fader label="Green" fn="green" />
                <Fader label="Blue" fn="blue" />
                <Fader label="White" fn="white" />
              </>
            )}
          </>
        )}
        <div className="prog-empty" style={{ marginTop: 18 }}>
          {t('program.placeholder')}
        </div>
      </div>
    </div>
  )
}
