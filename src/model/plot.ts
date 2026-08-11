/**
 * Lighting plot — a printable top-down plan of the rig (fixtures drawn as symbols on
 * their trusses, a key, and a title block/cajetín), in the style of a Vectorworks /
 * Lightwright plot. Returns a self-contained HTML doc (inline SVG) to print to PDF.
 */
import type { Show, FixtureDefinition, FixtureCategory } from './types'
import { getTrusses, trussById } from './venue'

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

const CAT_STYLE: Record<FixtureCategory, { color: string; label: string }> = {
  movingHead: { color: '#d0842a', label: 'Cabeza móvil' },
  par: { color: '#2a7fd0', label: 'PAR / LED' },
  dimmer: { color: '#777777', label: 'Dimmer / convencional' },
  strobe: { color: '#b040c0', label: 'Estrobo' },
  hazer: { color: '#2ba79a', label: 'Humo / haze' },
  other: { color: '#666666', label: 'Otros' },
}

/** One fixture symbol (shape varies by category) centred at (x,y). */
function symbol(cat: FixtureCategory, x: number, y: number, color: string): string {
  const s = (n: number) => n.toFixed(1)
  switch (cat) {
    case 'movingHead':
      return `<circle cx="${s(x)}" cy="${s(y)}" r="7.5" fill="${color}" stroke="#111" stroke-width="1"/>`
        + `<line x1="${s(x)}" y1="${s(y - 9)}" x2="${s(x)}" y2="${s(y + 9)}" stroke="#111" stroke-width="1"/>`
    case 'par':
      return `<circle cx="${s(x)}" cy="${s(y)}" r="7" fill="${color}" stroke="#111" stroke-width="1"/>`
    case 'dimmer':
      return `<circle cx="${s(x)}" cy="${s(y)}" r="5.5" fill="none" stroke="${color}" stroke-width="2"/>`
    case 'strobe':
      return `<path d="M ${s(x)} ${s(y - 8)} L ${s(x + 8)} ${s(y)} L ${s(x)} ${s(y + 8)} L ${s(x - 8)} ${s(y)} Z" fill="${color}" stroke="#111" stroke-width="1"/>`
    case 'hazer':
      return `<rect x="${s(x - 9)}" y="${s(y - 6)}" width="18" height="12" rx="2" fill="${color}" stroke="#111" stroke-width="1"/>`
    default:
      return `<circle cx="${s(x)}" cy="${s(y)}" r="6.5" fill="none" stroke="${color}" stroke-width="2"/>`
  }
}

export function buildPlotHTML(
  show: Show,
  definitions: Record<string, FixtureDefinition>,
): string {
  const trusses = getTrusses(show)
  // Plan drawing area + right column (key over title block).
  const PL = 40, PT = 60, PW = 760, PH = 640
  const zs = trusses.map((t) => t.z)
  const zMin = Math.min(...zs, 0) - 2
  const zMax = Math.max(...zs, 0) + 2
  const xToX = (x: number) => PL + (x * 0.5 + 0.5) * PW
  const zToY = (z: number) => PT + ((z - zMin) / (zMax - zMin || 1)) * PH

  // Truss bars + labels.
  const trussSvg = trusses
    .map((t) => {
      const y = zToY(t.z)
      return `<line x1="${xToX(-1.03)}" y1="${y}" x2="${xToX(1.03)}" y2="${y}" stroke="${t.foh ? '#b06a1a' : '#444'}" stroke-width="3" stroke-dasharray="${t.foh ? '7 4' : ''}"/>`
        + `<text x="${xToX(-1.06)}" y="${y + 4}" text-anchor="end" font-size="12" fill="#333">${esc(t.name)}</text>`
    })
    .join('')

  // Fixtures as symbols, each with its start address under it. Address labels are
  // staggered into two rows per truss (by x order) so dense rows don't overprint.
  const present = new Set<FixtureCategory>()
  const rowRank = new Map<string, number>()
  const byTruss = new Map<number, typeof show.fixtures>()
  for (const pf of show.fixtures) {
    const arr = byTruss.get(pf.truss ?? 0) ?? []
    arr.push(pf)
    byTruss.set(pf.truss ?? 0, arr)
  }
  for (const arr of byTruss.values()) {
    ;[...arr].sort((a, b) => a.position.x - b.position.x).forEach((pf, i) => rowRank.set(pf.id, i))
  }
  const fxSvg = show.fixtures
    .map((pf) => {
      const def = definitions[pf.definitionId]
      const cat = (def?.category ?? 'other') as FixtureCategory
      present.add(cat)
      const color = CAT_STYLE[cat].color
      const t = trussById(trusses, pf.truss)
      const x = xToX(pf.position.x)
      const y = zToY(t.z)
      const ly = y + ((rowRank.get(pf.id) ?? 0) % 2 === 0 ? 20 : 31)
      return symbol(cat, x, y, color)
        + `<text x="${x.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="9" fill="#111">${pf.universe}.${pf.address}</text>`
    })
    .join('')

  // Key: one row per category present, with its symbol + count.
  const counts = new Map<FixtureCategory, number>()
  for (const pf of show.fixtures) {
    const cat = (definitions[pf.definitionId]?.category ?? 'other') as FixtureCategory
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }
  const KX = 840
  const keyRows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n], i) => {
      const y = 96 + i * 30
      return `<g transform="translate(${KX},${y})">${symbol(cat, 12, 0, CAT_STYLE[cat].color)}`
        + `<text x="34" y="4" font-size="12" fill="#111">${esc(CAT_STYLE[cat].label)} — ${n}</text></g>`
    })
    .join('')

  const p = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  const date = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
  // Title block (cajetín) bottom-right.
  const TB_X = 830, TB_Y = 470, TB_W = 250, TB_H = 190
  const tbLine = (i: number, k: string, v: string) =>
    `<text x="${TB_X + 10}" y="${TB_Y + 26 + i * 24}" font-size="11" fill="#111"><tspan font-weight="700">${k}</tspan>  ${esc(v)}</text>`
  const titleBlock =
    `<rect x="${TB_X}" y="${TB_Y}" width="${TB_W}" height="${TB_H}" fill="none" stroke="#111" stroke-width="1.5"/>`
    + `<line x1="${TB_X}" y1="${TB_Y + 34}" x2="${TB_X + TB_W}" y2="${TB_Y + 34}" stroke="#111"/>`
    + `<text x="${TB_X + 10}" y="${TB_Y + 22}" font-size="14" font-weight="800" fill="#111">LIGHTING PLOT</text>`
    + tbLine(1, 'Show:', show.name)
    + tbLine(2, 'Universos:', String(show.universeCount))
    + tbLine(3, 'Aparatos:', String(show.fixtures.length))
    + tbLine(4, 'Fecha:', date)
    + tbLine(5, 'Dibujo:', `DMXSimulatoR ${__APP_VERSION__}`)
    + tbLine(6, 'Escala:', 'N.T.S.')

  const svg = `<svg viewBox="0 0 1100 700" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif">
    <rect x="0" y="0" width="1100" height="700" fill="#fff"/>
    <text x="${PL}" y="34" font-size="18" font-weight="800" fill="#111">Lighting Plot — ${esc(show.name)}</text>
    <text x="${KX}" y="80" font-size="13" font-weight="700" fill="#111">Leyenda</text>
    <rect x="${PL}" y="${PT}" width="${PW}" height="${PH}" fill="#fafafa" stroke="#ccc"/>
    <text x="${xToX(0)}" y="${PT + 16}" text-anchor="middle" font-size="11" fill="#999">FONDO / UPSTAGE</text>
    <text x="${xToX(0)}" y="${PT + PH - 8}" text-anchor="middle" font-size="11" fill="#999">PÚBLICO / FOH</text>
    ${trussSvg}
    ${fxSvg}
    ${keyRows}
    ${titleBlock}
  </svg>`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Lighting Plot — ${esc(show.name)}</title>
<style>
  html, body { background: #fff; margin: 0; }
  body { font-family: Arial, Helvetica, sans-serif; }
  .noprint { position: fixed; top: 10px; right: 10px; }
  .noprint button { font: 13px Arial; padding: 6px 12px; cursor: pointer; }
  svg { width: 100%; height: auto; display: block; }
  @page { size: A4 landscape; margin: 8mm; }
  @media print { .noprint { display: none; } }
</style></head><body>
<div class="noprint"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
${svg}
</body></html>`
}

/** Open the plot in a new window so the user can print it / save as PDF. */
export function openPlot(
  show: Show,
  definitions: Record<string, FixtureDefinition>,
): void {
  const html = buildPlotHTML(show, definitions)
  const w = window.open('', '_blank')
  if (!w) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${show.name || 'plot'}-plan.html`
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  w.document.write(html)
  w.document.close()
}
