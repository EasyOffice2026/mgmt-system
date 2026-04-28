import React from 'react';
import { useApp } from '../context';
import { FileSpreadsheet, FileText, FileDown } from 'lucide-react';

export default function ExportBar({ module, branchId }) {
  const { t } = useApp();
  const token = localStorage.getItem('token');

  function dl(fmt) {
    let url = `/api/export/${module}/${fmt}`;
    const params = [];
    if (branchId) params.push(`branch_id=${branchId}`);
    if (params.length) url += '?' + params.join('&');
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const u = URL.createObjectURL(blob);
        a.href = u;
        a.download = `${module}.${fmt === 'excel' ? 'xlsx' : fmt}`;
        a.click();
        URL.revokeObjectURL(u);
      });
  }

  return (
    <div className="export-btns">
      <button className="btn btn-sm btn-outline" onClick={() => dl('excel')}><FileSpreadsheet size={14}/> {t('excel')}</button>
      <button className="btn btn-sm btn-outline" onClick={() => dl('csv')}><FileText size={14}/> {t('csv')}</button>
      <button className="btn btn-sm btn-outline" onClick={() => dl('pdf')}><FileDown size={14}/> {t('pdf')}</button>
    </div>
  );
}
