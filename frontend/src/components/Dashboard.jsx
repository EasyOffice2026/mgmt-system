import React, { useEffect, useState } from 'react';
import { useApp } from '../context';
import { api } from '../api';
import BranchFilter from './BranchFilter';

export default function Dashboard() {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [branchId, setBranchId] = useState(null);

  useEffect(() => {
    const params = branchId ? `?branch_id=${branchId}` : '';
    api(`/api/dashboard${params}`).then(setData).catch(() => {});
  }, [branchId]);

  if (!data) return <div style={{padding:40,textAlign:'center'}}>Loading...</div>;

  const fmt = n => Number(n || 0).toLocaleString(lang === 'ar' ? 'ar-KW' : 'en-KW', {minimumFractionDigits:2, maximumFractionDigits:2});

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('dashboard')}</h2>
        <BranchFilter value={branchId} onChange={setBranchId} />
      </div>
      <div className="kpi-grid">
        <div className="kpi-card"><div className="label">{t('totalSales')}</div><div className="value">{fmt(data.total_sales)}</div></div>
        <div className="kpi-card"><div className="label">{t('totalPurchases')}</div><div className="value">{fmt(data.total_purchases)}</div></div>
        <div className="kpi-card"><div className="label">{t('totalExpenses')}</div><div className="value">{fmt(data.total_expenses)}</div></div>
        <div className="kpi-card"><div className="label">{t('employees')}</div><div className="value">{data.employee_count}</div></div>
      </div>
      {data.branch_summary?.length > 0 && (
        <div className="card">
          <h3 style={{marginBottom:12,fontSize:15,fontWeight:600}}>{t('branchSummary')}</h3>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>{t('branch')}</th><th>{t('totalSales')}</th><th>{t('totalPurchases')}</th><th>{t('totalExpenses')}</th>
              </tr></thead>
              <tbody>
                {data.branch_summary.map(b => (
                  <tr key={b.branch_id}>
                    <td>{lang === 'ar' ? b.name_ar : b.name}</td>
                    <td>{fmt(b.total_sales)}</td><td>{fmt(b.total_purchases)}</td><td>{fmt(b.total_expenses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
