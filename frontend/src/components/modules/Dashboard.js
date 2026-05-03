// src/components/modules/Dashboard.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useLang } from '../../contexts/LangContext';
import { KpiCard, DownloadButtons } from '../layout/SharedComponents';
import { StatusBadge } from '../layout/SharedComponents';

export default function Dashboard() {
  const { t } = useLang();
  const [stats, setStats] = useState({
    totalSales: 0, totalPurchase: 0, totalExpenses: 0,
    activeContracts: 0, dueFromCustomers: 0, legalCases: 0,
    totalEmployees: 0, activeEmployees: 0, onLeave: 0, monthlyPayroll: 0,
  });
  const [recentContracts, setRecentContracts] = useState([]);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [contracts, purchases, expenses, employees, legal] = await Promise.all([
        supabase.from('contracts').select('sale_price, status'),
        supabase.from('purchases').select('purchase_price'),
        supabase.from('expenses').select('amount'),
        supabase.from('employees').select('status, basic_salary, housing_allowance, transport_allowance, other_allowance'),
        supabase.from('legal_cases').select('id, status'),
      ]);

      const totalSales = (contracts.data || []).reduce((s, c) => s + Number(c.sale_price), 0);
      const activeContracts = (contracts.data || []).filter(c => c.status === 'ongoing').length;
      const totalPurchase = (purchases.data || []).reduce((s, p) => s + Number(p.purchase_price), 0);
      const totalExpenses = (expenses.data || []).reduce((s, e) => s + Number(e.amount), 0);
      const totalEmployees = (employees.data || []).length;
      const activeEmployees = (employees.data || []).filter(e => e.status === 'active').length;
      const onLeave = (employees.data || []).filter(e => e.status === 'leave').length;
      const monthlyPayroll = (employees.data || []).reduce((s, e) =>
        s + Number(e.basic_salary) + Number(e.housing_allowance) + Number(e.transport_allowance) + Number(e.other_allowance), 0);
      const legalCases = (legal.data || []).filter(l => l.status === 'active').length;

      setStats({ totalSales, totalPurchase, totalExpenses, activeContracts, legalCases, totalEmployees, activeEmployees, onLeave, monthlyPayroll, dueFromCustomers: 0 });

      // Recent contracts
      const { data: rc } = await supabase
        .from('contracts')
        .select('*, customers(full_name, customer_no)')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentContracts(rc || []);

      // Expiring documents (employees with docs expiring in 60 days)
      const soon = new Date(); soon.setDate(soon.getDate() + 60);
      const { data: emp } = await supabase
        .from('employees')
        .select('full_name, residency_expiry, passport_expiry, work_permit_expiry')
        .eq('status', 'active');

      const expiring = [];
      (emp || []).forEach(e => {
        if (e.residency_expiry && new Date(e.residency_expiry) <= soon)
          expiring.push({ name: e.full_name, doc: t('residencyNo'), expiry: e.residency_expiry });
        if (e.passport_expiry && new Date(e.passport_expiry) <= soon)
          expiring.push({ name: e.full_name, doc: t('passportNo'), expiry: e.passport_expiry });
        if (e.work_permit_expiry && new Date(e.work_permit_expiry) <= soon)
          expiring.push({ name: e.full_name, doc: t('workPermitNo'), expiry: e.work_permit_expiry });
      });
      setExpiringDocs(expiring.slice(0, 5));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n) => `KD ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('dashboard')}</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {/* KPIs Row 1 — Financial */}
      <div className="kpi-grid">
        <KpiCard label={t('totalSales')} value={fmt(stats.totalSales)} sub="All time" icon="💰" color="blue" />
        <KpiCard label={t('totalPurchase')} value={fmt(stats.totalPurchase)} sub="All time" icon="🛒" color="amber" />
        <KpiCard label={t('totalExpenses')} value={fmt(stats.totalExpenses)} sub="All time" icon="💸" color="red" />
        <KpiCard label={t('activeContracts')} value={stats.activeContracts} icon="📄" color="green" />
        <KpiCard label={t('legalCases')} value={stats.legalCases} icon="⚖️" color="red" />
        <KpiCard label={t('dueFromCourt')} value="KD 0" icon="🏛️" color="purple" />
      </div>

      {/* KPIs Row 2 — HRD */}
      <div className="kpi-grid">
        <KpiCard label={t('totalEmployees')} value={stats.totalEmployees} icon="👥" color="blue" />
        <KpiCard label={t('active')} value={stats.activeEmployees} icon="✅" color="green" />
        <KpiCard label={t('onLeave')} value={stats.onLeave} icon="🌴" color="amber" />
        <KpiCard label={t('monthlyPayroll')} value={fmt(stats.monthlyPayroll)} icon="💳" color="teal" />
      </div>

      {/* Charts + Expiring docs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-title">📊 {t('topCategories')}</div>
          <div className="bar-chart-h">
            {[
              { label: 'Car', pct: 85, color: 'var(--primary-light)' },
              { label: 'Mobile', pct: 60, color: 'var(--success)' },
              { label: 'Furniture', pct: 40, color: 'var(--warning)' },
              { label: 'Other', pct: 20, color: 'var(--text2)' },
            ].map(b => (
              <div key={b.label} className="bar-row">
                <div className="bar-row-label">{b.label}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${b.pct}%`, background: b.color }}>{b.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">⏰ {t('expiringDocs')}</div>
          {expiringDocs.length === 0 ? (
            <div style={{ color: 'var(--text2)', fontSize: 13, padding: '8px 0' }}>✅ No documents expiring soon</div>
          ) : expiringDocs.map((d, i) => (
            <div key={i} className="info-row">
              <span className="info-label">{d.name} — {d.doc}</span>
              <span className="badge badge-warning">{d.expiry}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Contracts */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>{t('recentContracts')}</div>
          <DownloadButtons title="Recent_Contracts"
            columns={['Contract No', 'Customer', 'Sale Price', 'Status']}
            getRows={() => recentContracts.map(c => [c.contract_no, c.customers?.full_name, `KD ${c.sale_price}`, c.status])}
          />
        </div>
        {recentContracts.length === 0 ? (
          <div style={{ color: 'var(--text2)', fontSize: 13, padding: 16, textAlign: 'center' }}>No contracts yet</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contract No.</th>
                  <th>Customer</th>
                  <th>Sale Price</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentContracts.map(c => (
                  <tr key={c.id}>
                    <td><span className="tag">{c.contract_no}</span></td>
                    <td><strong>{c.customers?.full_name}</strong></td>
                    <td><strong>KD {Number(c.sale_price).toLocaleString()}</strong></td>
                    <td>{c.duration_months}M</td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
