import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { amiriRegularBase64, amiriBoldBase64 } from './fonts/amiri';

function registerArabicFonts(doc: jsPDF) {
  doc.addFileToVFS('Amiri-Regular.ttf', amiriRegularBase64);
  doc.addFileToVFS('Amiri-Bold.ttf', amiriBoldBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.addFont('Amiri-Bold.ttf', 'Amiri', 'bold');
}

export function exportToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const doc = new jsPDF();
  registerArabicFonts(doc);

  doc.setFontSize(18);
  doc.setFont('Amiri', 'bold');
  doc.text('Approve Trading Company', 14, 15);
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(14);
  doc.text(title, 14, 25);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 33);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 40,
    styles: { fontSize: 8, cellPadding: 3, font: 'Amiri' },
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

export function exportToCsv(
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => {
      const str = String(cell ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
