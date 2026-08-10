import { useState } from 'react'
import { useShowStore } from '../../store/showStore'
import type { PaletteKind } from '../../model/palette'
import { PALETTE_LABELS } from '../../model/palette'
import { EffectsPanel } from '../run/EffectsPanel'
import { useSelectedValue, useSelectionFunctions } from './useSelectedValue'

const PALETTE_KINDS: PaletteKind[] = ['colour', 'position', 'gobo', 'beam', 'intensity']
type ScreenTab = 'fixtures' | 'effects' | PaletteKind

/**
 * Avolites Quartz — faithful control surface (work in progress).
 *
 * Laid out like the real desk (see the Tartanga photo): a touchscreen strip for
 * fixtures/groups, the three wheels, the attribute + program key banks, the ten
 * playback faders and the keypad / transport with Go and Locate. Essentials are
 * wired to the shared show core; keys we haven't implemented yet are shown but
 * inert (dimmed, with a tooltip) so the panel already reads like the machine.
 */

// Each attribute maps the 3 wheels to channel functions (first present wins).
const ATTRIBUTES: { name: string; color: string; wheels: string[][] }[] = [
  { name: 'Intensity', color: 'var(--at-intensity)', wheels: [['dimmer']] },
  { name: 'Position', color: 'var(--at-position)', wheels: [['pan'], ['tilt']] },
  { name: 'Colour', color: 'var(--at-colour)', wheels: [['red', 'colorWheel'], ['green'], ['blue', 'white']] },
  { name: 'Gobo', color: 'var(--at-gobo)', wheels: [['gobo'], ['goboRotation']] },
  { name: 'Beam', color: 'var(--at-beam)', wheels: [['prism'], ['shutter'], ['zoom', 'focus']] },
  { name: 'Effect', color: 'var(--ink-3)', wheels: [] },
  { name: 'Special', color: 'var(--ink-3)', wheels: [] },
]

const PROGRAM_KEYS_TOP = ['Record', 'Update', 'Edit', 'Select If', 'Patch', 'Disk']
const PROGRAM_KEYS_BOT = ['Delete', 'Copy', 'Move', 'Unfold', 'Include', 'Release']
const KEYPAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'Enter']

function Wheel({ label, fn }: { label: string; fn: string }) {
  const value = useSelectedValue(fn)
  const setByFn = useShowStore((s) => s.setSelectedByFunction)
  const angle = (value / 255) * 270 - 135
  return (
    <div className="qd-wheel">
      <div className="qd-dial">
        <span className="qd-dial-tick" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        aria-label={label}
        onChange={(e) => setByFn(fn, Number(e.target.value))}
      />
      <div className="qd-wheel-cap">{label}</div>
      <div className="qd-wheel-val">{value}</div>
    </div>
  )
}

export function QuartzDesk() {
  const [attr, setAttr] = useState('Intensity')
  const [screenTab, setScreenTab] = useState<ScreenTab>('fixtures')
  const show = useShowStore((s) => s.show)
  const definitions = useShowStore((s) => s.definitions)
  const selection = useShowStore((s) => s.selection)
  const toggleSelect = useShowStore((s) => s.toggleSelect)
  const locateSelected = useShowStore((s) => s.locateSelected)
  const clearProgrammer = useShowStore((s) => s.clearProgrammer)
  const recordCue = useShowStore((s) => s.recordCue)
  const updateCue = useShowStore((s) => s.updateCue)
  const deleteCue = useShowStore((s) => s.deleteCue)
  const releaseCue = useShowStore((s) => s.releaseCue)
  const cues = useShowStore((s) => s.cues)
  const activeCueId = useShowStore((s) => s.activeCueId)
  const goCue = useShowStore((s) => s.goCue)
  const palettes = useShowStore((s) => s.palettes)
  const recordPalette = useShowStore((s) => s.recordPalette)
  const applyPalette = useShowStore((s) => s.applyPalette)
  const deletePalette = useShowStore((s) => s.deletePalette)
  const playbackPage = useShowStore((s) => s.playbackPage)
  const setPlaybackPage = useShowStore((s) => s.setPlaybackPage)
  const present = useSelectionFunctions()

  const active = ATTRIBUTES.find((a) => a.name === attr) ?? ATTRIBUTES[0]
  const wheels = active.wheels
    .map((cands) => cands.find((fn) => present.has(fn)))
    .filter((fn): fn is string => !!fn)
  const noSel = selection.length === 0

  // Step through the cue list (wraps). Go and Next both advance.
  const goRel = (dir: 1 | -1) => {
    if (cues.length === 0) return
    const idx = cues.findIndex((c) => c.id === activeCueId)
    const next = idx < 0 ? (dir > 0 ? 0 : cues.length - 1) : (idx + dir + cues.length) % cues.length
    goCue(cues[next].id)
  }
  const hasProgrammer = useShowStore((s) => Object.keys(s.programmer).length > 0)

  // Program-key handlers; keys not listed here stay inert (WIP).
  const programHandlers: Record<string, { fn: () => void; enabled: boolean }> = {
    Record: { fn: recordCue, enabled: hasProgrammer },
    Update: { fn: () => activeCueId && updateCue(activeCueId), enabled: !!activeCueId && hasProgrammer },
    Delete: { fn: () => activeCueId && deleteCue(activeCueId), enabled: !!activeCueId },
    Release: { fn: releaseCue, enabled: !!activeCueId },
  }

  return (
    <div className="qd">
      {/* Touchscreen strip: fixtures + palette windows (tabbed) */}
      <div className="qd-screen">
        <div className="qd-screen-head">
          <span className="qd-brand">Avolites Quartz</span>
          <div className="qd-tabs">
            <button
              className={screenTab === 'fixtures' ? 'on' : ''}
              onClick={() => setScreenTab('fixtures')}
            >
              Fixtures
            </button>
            {PALETTE_KINDS.map((k) => (
              <button
                key={k}
                className={`qd-tab-${k}${screenTab === k ? ' on' : ''}`}
                onClick={() => setScreenTab(k)}
              >
                {PALETTE_LABELS[k]}
              </button>
            ))}
            <button
              className={screenTab === 'effects' ? 'on' : ''}
              onClick={() => setScreenTab('effects')}
            >
              Shapes
            </button>
          </div>
          <span className="qd-wip">WIP</span>
        </div>

        {screenTab === 'fixtures' ? (
          <div className="qd-fixtures">
            {show.fixtures.length === 0 ? (
              <span className="qd-muted">Patch fixtures first.</span>
            ) : (
              show.fixtures.map((pf) => (
                <button
                  key={pf.id}
                  className={`qd-fx${selection.includes(pf.id) ? ' sel' : ''}`}
                  onClick={() => toggleSelect(pf.id)}
                >
                  <span className="qd-fx-name">{pf.name}</span>
                  <span className="qd-fx-def">{definitions[pf.definitionId]?.model}</span>
                </button>
              ))
            )}
          </div>
        ) : screenTab === 'effects' ? (
          <EffectsPanel />
        ) : (
          <div className="qd-palettes">
            <button
              className="qd-key rec qd-pal-rec"
              title={`Record a ${PALETTE_LABELS[screenTab]} palette from the programmer`}
              disabled={noSel}
              onClick={() => recordPalette(screenTab)}
            >
              Record {PALETTE_LABELS[screenTab]}
            </button>
            {palettes.filter((p) => p.kind === screenTab).length === 0 ? (
              <span className="qd-muted">
                No {PALETTE_LABELS[screenTab].toLowerCase()} palettes yet — set a look, select
                fixtures, then Record.
              </span>
            ) : (
              palettes
                .filter((p) => p.kind === screenTab)
                .map((p) => (
                  <span className="qd-pal" key={p.id}>
                    <button
                      className="qd-pal-apply"
                      title={`Apply ${p.name} to the selection`}
                      disabled={noSel}
                      onClick={() => applyPalette(p.id)}
                    >
                      {p.name}
                    </button>
                    <button className="qd-pal-del" title="Delete palette" onClick={() => deletePalette(p.id)}>
                      ✕
                    </button>
                  </span>
                ))
            )}
          </div>
        )}
      </div>

      {/* Hardware */}
      <div className="qd-hw">
        {/* LEFT: attribute + program keys */}
        <div className="qd-col qd-left">
          <div className="qd-caplabel">Attributes</div>
          <div className="qd-attrs">
            {ATTRIBUTES.map((a) => (
              <button
                key={a.name}
                className={`qd-key qd-attr${a.name === attr ? ' on' : ''}`}
                style={{ ['--k' as string]: a.color }}
                onClick={() => setAttr(a.name)}
              >
                {a.name}
              </button>
            ))}
          </div>

          <div className="qd-caplabel">Program</div>
          <div className="qd-prog">
            {[...PROGRAM_KEYS_TOP, ...PROGRAM_KEYS_BOT].map((k) => {
              const h = programHandlers[k]
              if (!h) {
                return (
                  <button key={k} className="qd-key inert" title="Coming soon">
                    {k}
                  </button>
                )
              }
              return (
                <button
                  key={k}
                  className={`qd-key${k === 'Record' ? ' rec' : ''}`}
                  title={k}
                  disabled={!h.enabled}
                  onClick={h.fn}
                >
                  {k}
                </button>
              )
            })}
          </div>
        </div>

        {/* CENTER: wheels + faders */}
        <div className="qd-col qd-center">
          <div className="qd-wheels">
            {noSel ? (
              <span className="qd-muted">Select fixtures to drive the wheels.</span>
            ) : wheels.length === 0 ? (
              <span className="qd-muted">No {attr.toLowerCase()} control on this fixture.</span>
            ) : (
              wheels.map((fn) => <Wheel key={fn} fn={fn} label={fn} />)
            )}
          </div>

          <div className="qd-playhead">
            <span className="qd-caplabel">Playback</span>
            <div className="qd-pages">
              <button
                className="qd-key"
                title="Previous page"
                disabled={playbackPage === 0}
                onClick={() => setPlaybackPage(playbackPage - 1)}
              >
                − Page
              </button>
              <span className="qd-page-n">Page {playbackPage + 1}</span>
              <button className="qd-key" title="Next page" onClick={() => setPlaybackPage(playbackPage + 1)}>
                + Page
              </button>
            </div>
          </div>
          <div className="qd-faders">
            {Array.from({ length: 10 }, (_, i) => {
              const globalIndex = playbackPage * 10 + i
              const cue = cues[globalIndex]
              const on = cue && cue.id === activeCueId
              return (
                <div className="qd-fader" key={i}>
                  <button
                    className={`qd-flash${on ? ' on' : ''}${cue ? '' : ' empty'}`}
                    title={cue ? `Fire ${cue.name}` : 'Empty playback'}
                    onClick={() => cue && goCue(cue.id)}
                  >
                    {globalIndex + 1}
                  </button>
                  <input type="range" min={0} max={255} defaultValue={cue ? 255 : 0} disabled={!cue} />
                  <span className="qd-fader-cap">{cue ? cue.name.replace('Cue ', 'Q') : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: keypad + transport */}
        <div className="qd-col qd-right">
          <div className="qd-transport">
            <button className="qd-key" title="Previous cue" disabled={!cues.length} onClick={() => goRel(-1)}>
              Prev Cue
            </button>
            <button className="qd-key" title="Next cue" disabled={!cues.length} onClick={() => goRel(1)}>
              Next Cue
            </button>
            <button className="qd-key go" title="Go to next cue" disabled={!cues.length} onClick={() => goRel(1)}>
              Go
            </button>
          </div>

          <div className="qd-selkeys">
            <button className="qd-key" title="Fixtures window" onClick={() => setScreenTab('fixtures')}>
              Fixture
            </button>
            <button className="qd-key" title="Palettes window" onClick={() => setScreenTab('colour')}>
              Palette
            </button>
            <button className="qd-key inert" title="Coming soon">
              Macro
            </button>
            <button className="qd-key inert" title="Coming soon">
              Group
            </button>
          </div>

          <div className="qd-keypad">
            {KEYPAD.map((k) => (
              <button key={k} className="qd-key inert num" title="Coming soon">
                {k}
              </button>
            ))}
          </div>

          <div className="qd-bigkeys">
            <button className="qd-key locate" title="Locate selected" disabled={noSel} onClick={locateSelected}>
              Locate
            </button>
            <button className="qd-key clear" title="Clear the programmer" onClick={clearProgrammer}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
