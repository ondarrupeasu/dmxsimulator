/**
 * "Esquema de conexionado" — a printable cable schedule + visual diagram for the power/patch racks,
 * as a real vector PDF (jsPDF + autoTable), landscape A4, downloaded straight away. With it, an
 * electrician can replicate exactly the patch the student built: a connections table (origin →
 * destination + connector type + DMX note), a source→destination diagram, the breakers that are
 * down, the regletas, and the DMX distribution.
 */

export type PowerConnection = { from: string; to: string; origen: string; destino: string; cable: string; nota: string }
export type PowerReportData = {
  connections: PowerConnection[]
  breakersOff: string[]
  regletas: string[][] // [regleta, alimentación, I/0, tomas]
  s4: string[][] // [salida, destino]
}

// cable-type colours for the diagram (RGB)
const CABLE_COLOR: Record<string, [number, number, number]> = {
  'powerCON – powerCON': [90, 96, 104],
  'powerCON – schuko H': [58, 91, 200],
  'schuko M – powerCON': [40, 150, 90],
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export async function openPowerReport(d: PowerReportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const M = 40
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // Wordmark: DMX + R in red, Simulato in black.
  doc.setFont('helvetica', 'bold').setFontSize(18)
  let x = M
  doc.setTextColor(229, 53, 43).text('DMX', x, 46); x += doc.getTextWidth('DMX')
  doc.setTextColor(17, 17, 17).text('Simulato', x, 46); x += doc.getTextWidth('Simulato')
  doc.setTextColor(229, 53, 43).text('R', x, 46)

  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(17, 17, 17)
  const meta: [string, string][] = [
    ['Documento:', 'Esquema de conexionado eléctrico'],
    ['Fecha:', stamp(new Date())],
    ['Versión:', `DMXSimulatoR ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}`.trim()],
  ]
  meta.forEach(([k, v], i) => { const y = 64 + i * 14; doc.setFont('helvetica', 'bold').text(k, W - 320, y); doc.setFont('helvetica', 'normal').text(v, W - 230, y) })
  doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(90)
    .text('Hoja de conexiones para replicar el patch: origen → destino de cada cable, cuadro, regletas y señal DMX.', M, 62)
  doc.setDrawColor(17).setLineWidth(1).line(M, 82, W - M, 82)

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(17).text('Conexiones (cable schedule)', M, 104)
  autoTable(doc, {
    startY: 112,
    head: [['Nº', 'Origen', 'Destino', 'Cable / conector', 'Notas']],
    body: d.connections.length ? d.connections.map((c, i) => [String(i + 1), c.origen, c.destino, c.cable, c.nota]) : [['—', 'Sin conexiones', '—', '—', '—']],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, lineColor: [150, 150, 150], textColor: 20 },
    headStyles: { fillColor: [217, 217, 217], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 244, 244] },
    columnStyles: { 0: { halign: 'center', cellWidth: 26 }, 1: { cellWidth: 150 }, 2: { cellWidth: 150 }, 3: { cellWidth: 130 } },
    margin: { left: M, right: M },
  })
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  const section = (title: string, head: string[], body: string[][], width?: number) => {
    if (y > H - 120) { doc.addPage(); y = 60 }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(17).text(title, M, y + 22)
    autoTable(doc, {
      startY: y + 30, head: [head], body: body.length ? body : [head.map(() => '—')], theme: 'grid', tableWidth: width,
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [150, 150, 150], textColor: 20 },
      headStyles: { fillColor: [217, 217, 217], textColor: 20, fontStyle: 'bold' }, margin: { left: M, right: M },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  }

  section('Cuadro eléctrico — interruptores bajados (OFF)', ['Interruptor'], d.breakersOff.length ? d.breakersOff.map((b) => [b]) : [['Todos armados (ON)']], 320)
  section('Regletas de fuerza', ['Regleta', 'Alimentación', 'I/0', 'Tomas'], d.regletas)
  section('Distribución DMX — splitter TINHAO S4', ['Salida', 'Destino'], d.s4, 320)

  // ---- Visual diagram: origin (left) → destination (right), one line per cable ----
  if (d.connections.length) drawDiagram(doc, d.connections, M, W, H)

  doc.save('conexionado-electrico.pdf')
}

type Doc = import('jspdf').jsPDF
function drawDiagram(doc: Doc, conns: PowerConnection[], M: number, W: number, H: number) {
  doc.addPage()
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(17).text('Diagrama de conexiones', M, 46)

  // legend
  let lx = M
  doc.setFontSize(8.5)
  for (const [label, rgb] of Object.entries(CABLE_COLOR)) {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]).setLineWidth(2.4).line(lx, 60, lx + 22, 60)
    doc.setTextColor(60).setFont('helvetica', 'normal').text(label, lx + 27, 63)
    lx += 27 + doc.getTextWidth(label) + 22
  }

  const sources = [...new Set(conns.map((c) => c.from))]
  const sinks = [...new Set(conns.map((c) => c.to))]
  const label = (id: string) => (conns.find((c) => c.from === id)?.origen) ?? (conns.find((c) => c.to === id)?.destino) ?? id
  const top = 84, bottom = H - 40
  const boxW = 168, boxH = 20
  const leftX = M, rightX = W - M - boxW
  const slot = (n: number, i: number) => top + (i + 0.5) * ((bottom - top) / Math.max(n, 1))

  const drawCol = (ids: string[], colX: number, align: 'l' | 'r') => {
    doc.setFontSize(8).setFont('helvetica', 'normal')
    ids.forEach((id, i) => {
      const cy = slot(ids.length, i)
      doc.setDrawColor(120).setFillColor(245, 245, 245).setLineWidth(0.6).roundedRect(colX, cy - boxH / 2, boxW, boxH, 3, 3, 'FD')
      doc.setTextColor(20).text(label(id).slice(0, 34), colX + 6, cy + 3)
      void align
    })
  }
  // column headers
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(60)
  doc.text('ORIGEN', leftX, top - 8)
  doc.text('DESTINO', rightX + boxW, top - 8, { align: 'right' })

  // lines first (behind boxes)
  conns.forEach((c) => {
    const si = sources.indexOf(c.from), ki = sinks.indexOf(c.to)
    const y1 = slot(sources.length, si), y2 = slot(sinks.length, ki)
    const rgb = CABLE_COLOR[c.cable] ?? [90, 96, 104]
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]).setLineWidth(1.4).line(leftX + boxW, y1, rightX, y2)
  })
  drawCol(sources, leftX, 'l')
  drawCol(sinks, rightX, 'r')
}
