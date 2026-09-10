/**
 * "Esquema de conexionado" — a printable cable schedule for the power/patch racks, generated as a
 * real vector PDF (jsPDF + autoTable) and downloaded straight away. With it, an electrician can
 * replicate exactly the patch the student built: every cable (origin → destination + connector
 * type), the breakers that are down, the regletas, and the DMX distribution.
 */

export type PowerReportData = {
  connections: string[][] // [nº, origen, destino, cable, nota]
  breakersOff: string[]
  regletas: string[][] // [regleta, alimentación, I/0, tomas]
  s4: string[][] // [salida, destino]
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export async function openPowerReport(d: PowerReportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const M = 40
  const W = doc.internal.pageSize.getWidth()

  // Wordmark: DMX + R in red, Simulato in black.
  doc.setFont('helvetica', 'bold').setFontSize(18)
  let x = M
  doc.setTextColor(229, 53, 43).text('DMX', x, 50); x += doc.getTextWidth('DMX')
  doc.setTextColor(17, 17, 17).text('Simulato', x, 50); x += doc.getTextWidth('Simulato')
  doc.setTextColor(229, 53, 43).text('R', x, 50)

  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(17, 17, 17)
  const meta: [string, string][] = [
    ['Documento:', 'Esquema de conexionado eléctrico'],
    ['Fecha:', stamp(new Date())],
    ['Versión:', `DMXSimulatoR ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}`.trim()],
  ]
  meta.forEach(([k, v], i) => {
    const y = 72 + i * 15
    doc.setFont('helvetica', 'bold').text(k, M, y)
    doc.setFont('helvetica', 'normal').text(v, M + 90, y)
  })
  doc.setDrawColor(17).setLineWidth(1).line(M, 128, W - M, 128)
  doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(90)
    .text('Hoja de conexiones para replicar el patch: origen → destino de cada cable, cuadro, regletas y señal DMX.', M, 142)

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(17)
    .text('Conexiones (cable schedule)', M, 166)
  autoTable(doc, {
    startY: 174,
    head: [['Nº', 'Origen', 'Destino', 'Cable / conector', 'Notas']],
    body: d.connections.length ? d.connections : [['—', 'Sin conexiones', '—', '—', '—']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, lineColor: [150, 150, 150], textColor: 20 },
    headStyles: { fillColor: [217, 217, 217], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 244, 244] },
    columnStyles: { 0: { halign: 'center', cellWidth: 26 }, 3: { cellWidth: 118 } },
    margin: { left: M, right: M },
  })
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  const section = (title: string, head: string[], body: string[][], width?: number) => {
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 60 }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(17).text(title, M, y + 24)
    autoTable(doc, {
      startY: y + 32,
      head: [head],
      body: body.length ? body : [head.map(() => '—')],
      theme: 'grid',
      tableWidth: width,
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [150, 150, 150], textColor: 20 },
      headStyles: { fillColor: [217, 217, 217], textColor: 20, fontStyle: 'bold' },
      margin: { left: M, right: M },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  }

  section('Cuadro eléctrico — interruptores bajados (OFF)', ['Interruptor'],
    d.breakersOff.map((b) => [b]).length ? d.breakersOff.map((b) => [b]) : [['Todos armados (ON)']], 320)
  section('Regletas de fuerza', ['Regleta', 'Alimentación', 'I/0', 'Tomas'], d.regletas)
  section('Distribución DMX — splitter TINHAO S4', ['Salida', 'Destino'], d.s4, 320)

  doc.save('conexionado-electrico.pdf')
}
