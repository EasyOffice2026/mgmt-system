// src/utils/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ── File upload helper ─────────────────────────────────────
export async function uploadFile(bucket, path, file) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path: data.path, publicUrl: urlData.publicUrl };
}

// ── PDF export helper ──────────────────────────────────────
export function exportToPDF(title, columns, rows) {
  const { jsPDF } = window.jspdf || require('jspdf');
  require('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);
  doc.autoTable({ head: [columns], body: rows, startY: 30, styles: { fontSize: 9 } });
  doc.save(`${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

// ── Excel export helper ────────────────────────────────────
export function exportToExcel(filename, sheetName, columns, rows) {
  const XLSX = require('xlsx');
  const wsData = [columns, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${Date.now()}.xlsx`);
}
