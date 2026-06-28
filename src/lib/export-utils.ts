import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { amiriRegularBase64, amiriBoldBase64 } from './fonts/amiri';
import { approvLogoBase64 } from './fonts/logo';

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
  filename: string,
  lang: 'en' | 'ar' = 'en'
) {
  const isRtl = lang === 'ar';
  const doc = new jsPDF();
  registerArabicFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const logoWidth = 35;
  const logoHeight = 18;

  if (isRtl) {
    // RTL: Logo on top-right
    doc.addImage('data:image/png;base64,' + approvLogoBase64, 'PNG', pageWidth - margin - logoWidth, 8, logoWidth, logoHeight);
    const textX = pageWidth - margin - logoWidth - 5;
    doc.setFontSize(16);
    doc.setFont('Amiri', 'bold');
    doc.text('Approv', textX, 15, { align: 'right' });
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(9);
    doc.text('\u0634\u0631\u0643\u0629 \u0627\u0628\u0631\u0648\u0641 \u0644\u062a\u062c\u0627\u0631\u0629 \u0627\u0644\u062c\u0645\u0644\u0647 \u0648\u0627\u0644\u062a\u062c\u0632\u0626\u0629', textX, 22, { align: 'right' });
    doc.setFontSize(13);
    doc.setFont('Amiri', 'bold');
    doc.text(title, pageWidth - margin, 34, { align: 'right' });
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString('ar-KW'), pageWidth - margin, 40, { align: 'right' });
  } else {
    // LTR: Logo on top-left
    doc.addImage('data:image/png;base64,' + approvLogoBase64, 'PNG', margin, 8, logoWidth, logoHeight);
    const textX = margin + logoWidth + 5;
    doc.setFontSize(16);
    doc.setFont('Amiri', 'bold');
    doc.text('Approv', textX, 15);
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(9);
    doc.text('\u0634\u0631\u0643\u0629 \u0627\u0628\u0631\u0648\u0641 \u0644\u062a\u062c\u0627\u0631\u0629 \u0627\u0644\u062c\u0645\u0644\u0647 \u0648\u0627\u0644\u062a\u062c\u0632\u0626\u0629', textX, 22);
    doc.setFontSize(13);
    doc.setFont('Amiri', 'bold');
    doc.text(title, margin, 34);
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 40);
  }

  const tableHeaders = isRtl ? [...headers].reverse() : headers;
  const tableRows = isRtl ? rows.map(r => [...r].reverse()) : rows;

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: 46,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      font: 'Amiri',
      halign: isRtl ? 'right' : 'left',
    },
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
