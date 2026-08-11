/**
 * Patch report — a "Patch View" laid out like the Avolites Titan export Miren sent,
 * but branded DMXSimulatoR (we describe the simulated desk in the header; we don't
 * reproduce Avolites' logo). Generated as a real vector PDF (jsPDF + autoTable) and
 * downloaded straight away — no print dialog.
 */
import type { Show, FixtureDefinition } from './types'
import { fixtureFootprint } from './types'

/** Two-digit date/time in the same shape as the Titan report (DD/MM/YY-HH:MM). */
function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}-${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Build and download the patch report as a PDF. */
export async function openPatchReport(
  show: Show,
  definitions: Record<string, FixtureDefinition>,
  opts: { console?: string; software?: string } = {},
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const consoleType = opts.console ?? 'Avolites Quartz (simulated)'
  const software = opts.software ?? `DMXSimulatoR ${__APP_VERSION__}`

  const rows = [...show.fixtures]
    .sort((a, b) => a.universe - b.universe || a.address - b.address)
    .map((pf, i) => {
      const def = definitions[pf.definitionId]
      const foot = def ? fixtureFootprint(def, pf.modeIndex) : 1
      const mode = def?.modes[pf.modeIndex]?.name ?? '—'
      const fixture = def ? `${def.manufacturer} ${def.model}` : pf.definitionId
      return [
        String(i + 1),
        fixture,
        mode,
        `${pf.universe}.${pf.address}`,
        String(foot),
        `${pf.universe}.${pf.address + foot - 1}`,
        pf.name,
      ]
    })

  const counts = new Map<string, number>()
  for (const pf of show.fixtures) {
    const def = definitions[pf.definitionId]
    const key = def ? `${def.manufacturer} ${def.model}` : pf.definitionId
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const schedule = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, v]) => [`${v}×`, k])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const M = 40

  // Wordmark: DMX + R in red, Simulato in black.
  doc.setFont('helvetica', 'bold').setFontSize(18)
  let x = M
  doc.setTextColor(229, 53, 43).text('DMX', x, 50); x += doc.getTextWidth('DMX')
  doc.setTextColor(17, 17, 17).text('Simulato', x, 50); x += doc.getTextWidth('Simulato')
  doc.setTextColor(229, 53, 43).text('R', x, 50)

  // Header meta block.
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(17, 17, 17)
  const meta: [string, string][] = [
    ['Showname:', show.name],
    ['Date:', stamp(new Date())],
    ['Software Version:', software],
    ['Console Type:', consoleType],
    ['Universes:', String(show.universeCount)],
  ]
  meta.forEach(([k, v], i) => {
    const y = 74 + i * 15
    doc.setFont('helvetica', 'bold').text(k, M, y)
    doc.setFont('helvetica', 'normal').text(v, M + 110, y)
  })
  doc.setDrawColor(17).setLineWidth(1).line(M, 158, doc.internal.pageSize.getWidth() - M, 158)

  // Title.
  doc.setFont('helvetica', 'bold').setFontSize(14)
    .text('Patch View', doc.internal.pageSize.getWidth() / 2, 178, { align: 'center' })

  autoTable(doc, {
    startY: 192,
    head: [['User no.', 'Fixture', 'Mode', 'Address', 'Ch', 'Last', 'Legend']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, lineColor: [150, 150, 150], textColor: 20 },
    headStyles: { fillColor: [217, 217, 217], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 244, 244] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 48 },
      2: { cellWidth: 95 },
      3: { halign: 'center', cellWidth: 48 },
      4: { halign: 'center', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 48 },
    },
    margin: { left: M, right: M },
  })

  const afterPatch = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(17, 17, 17)
    .text('Fixture schedule', M, afterPatch + 24)
  autoTable(doc, {
    startY: afterPatch + 32,
    head: [['Qty', 'Fixture']],
    body: schedule,
    theme: 'grid',
    tableWidth: 260,
    styles: { fontSize: 9, cellPadding: 3, lineColor: [150, 150, 150], textColor: 20 },
    headStyles: { fillColor: [217, 217, 217], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'center', cellWidth: 44 } },
    margin: { left: M },
  })

  doc.save(`${show.name || 'patch'}-patch.pdf`)
}
