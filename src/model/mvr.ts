/**
 * MVR (My Virtual Rig) export — bundles the whole rig as a `.mvr` (a ZIP holding
 * GeneralSceneDescription.xml + one GDTF per fixture type) so it opens in Capture,
 * Vectorworks, grandMA, etc. Each fixture carries its GDTF reference, DMX address and
 * a position matrix derived from its truss + offset. Matrices are 4×3, Z-up, in mm
 * (GDTF geometry is metres — MVR is millimetres). Spec: github.com/mvrdevelopment/spec.
 */
import type { Show, FixtureDefinition } from './types'
import { getTrusses, trussById } from './venue'
import { buildGdtfDescription, gdtfFileName, guidFrom, xmlEsc } from './gdtf'

/** World position (mm, Z-up) of a fixture: x across, y = truss depth, z = hang height. */
function matrixOf(
  pf: Show['fixtures'][number],
  def: FixtureDefinition | undefined,
  trusses: ReturnType<typeof getTrusses>,
): string {
  const t = trussById(trusses, pf.truss)
  const x = Math.round((pf.position.x ?? 0) * 5000) // ±5 m across the stage
  const y = Math.round((t?.z ?? 0) * 1000) // truss depth
  const z = def?.category === 'hazer' ? 1000 : Math.round((t?.y ?? 5) * 1000) // hang height (floor machines on the deck)
  return `{1,0,0}{0,1,0}{0,0,1}{${x},${y},${z}}`
}

function buildSceneXml(
  show: Show,
  definitions: Record<string, FixtureDefinition>,
  fileByDef: Record<string, string>,
): string {
  const trusses = getTrusses(show)
  const fixtures = show.fixtures
    .map((pf, i) => {
      const def = definitions[pf.definitionId]
      const spec = fileByDef[pf.definitionId] ?? ''
      const mode = def?.modes[pf.modeIndex]?.name ?? ''
      const addr = show.universeCount > 1 ? `${pf.universe}.${pf.address}` : String(pf.address)
      return `          <Fixture uuid="${guidFrom(pf.id)}" name="${xmlEsc(pf.name)}">
            <Matrix>${matrixOf(pf, def, trusses)}</Matrix>
            <GDTFSpec>${xmlEsc(spec)}</GDTFSpec>
            <GDTFMode>${xmlEsc(mode)}</GDTFMode>
            <Addresses>
              <Address break="1">${addr}</Address>
            </Addresses>
            <FixtureID>${i + 1}</FixtureID>
            <UnitNumber>0</UnitNumber>
            <FixtureTypeId>0</FixtureTypeId>
            <CustomId>0</CustomId>
            <Classing></Classing>
          </Fixture>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<GeneralSceneDescription verMajor="1" verMinor="5" provider="DMXSimulatoR" providerVersion="${__APP_VERSION__}">
  <Scene>
    <AUXData/>
    <Layers>
      <Layer uuid="${guidFrom('layer:rig')}" name="${xmlEsc(show.name || 'Rig')}">
        <ChildList>
${fixtures}
        </ChildList>
      </Layer>
    </Layers>
  </Scene>
</GeneralSceneDescription>`
}

/** Build the .mvr archive and download it. */
export async function exportMvr(
  show: Show,
  definitions: Record<string, FixtureDefinition>,
): Promise<void> {
  const { default: JSZip } = await import('jszip')

  const usedDefIds = [...new Set(show.fixtures.map((f) => f.definitionId))]
  const fileByDef: Record<string, string> = {}
  const mvr = new JSZip()

  for (const id of usedDefIds) {
    const def = definitions[id]
    if (!def) continue
    const fname = gdtfFileName(def)
    fileByDef[id] = fname
    // Each .gdtf is itself a ZIP (description.xml at root) embedded in the .mvr.
    const g = new JSZip()
    g.file('description.xml', buildGdtfDescription(def))
    const bytes = await g.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    mvr.file(fname, bytes)
  }

  mvr.file('GeneralSceneDescription.xml', buildSceneXml(show, definitions, fileByDef))
  const blob = await mvr.generateAsync({ type: 'blob', compression: 'DEFLATE' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${show.name || 'rig'}.mvr`
  a.click()
  URL.revokeObjectURL(url)
}
