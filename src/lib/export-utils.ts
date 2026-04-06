import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function exportToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${filename}.pdf`);
}

export function exportToExcel(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  sheetName = 'Sheet1'
) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Auto-width columns
  const maxWidths = headers.map((h, i) => {
    const colValues = [h, ...rows.map(r => String(r[i] ?? ''))];
    return Math.max(...colValues.map(v => v.length));
  });
  ws['!cols'] = maxWidths.map(w => ({ wch: Math.min(w + 2, 40) }));

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
