// src/components/modules/hrd/Payroll.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Modal, StatusBadge, EmptyState, Spinner, KpiCard, DownloadButtons } from '../../layout/SharedComponents';

export default function Payroll() {
  const { t } = useLang();
  const { profile, user } = useAuth();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProcess, setShowProcess] = useState(false);
  const [monthFilter, setMonthFilter] = useState('');
  const [form, setForm] = useState({
    employee_id: '', payroll_month: '', basic_salary: 0,
    housing_allowance: 0, transport_allowance: 0, other_allowance: 0,
    gross_salary: 0, deductions: 0, deduction_reason: '', net_salary: 0,
    payment_date: '', payment_mode_id: '', status: 'paid'
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('payroll').select('*, employees(full_name, employee_no, departments(name)), payment_modes(name)').order('payroll_month', { ascending: false });
    if (monthFilter) q = q.gte('payroll_month', monthFilter + '-01').lte('payroll_month', monthFilter + '-31');
    const { data } = await q;
    setRecords(data || []);
    setLoading(false);
  }, [monthFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('employees').select('id, full_name, employee_no, basic_salary, housing_allowance, transport_allowance, other_allowance').eq('status', 'active').then(({ data }) => setEmployees(data || []));
    supabase.from('payment_modes').select('*').then(({ data }) => setPaymentModes(data || []));
  }, []);

  function f(k, v) {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      const gross = Number(next.basic_salary) + Number(next.housing_allowance) + Number(next.transport_allowance) + Number(next.other_allowance);
      next.gross_salary = gross;
      next.net_salary = gross - Number(next.deductions);
      return next;
    });
  }

  function loadEmployee(empId) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    setForm(prev => {
      const basic = Number(emp.basic_salary);
      const housing = Number(emp.housing_allowance);
      const transport = Number(emp.transport_allowance);
      const other = Number(emp.other_allowance);
      const gross = basic + housing + transport + other;
      return { ...prev, employee_id: empId, basic_salary: basic, housing_allowance: housing, transport_allowance: transport, other_allowance: other, gross_salary: gross, net_salary: gross - Number(prev.deductions) };
    });
  }

  async function handleSave() {
    if (!form.employee_id || !form.payroll_month) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('payroll').upsert({
        ...form,
        payroll_month: form.payroll_month + '-01',
        created_by: profile?.id || user?.id
      }, { onConflict: 'employee_id,payroll_month' });
      if (error) throw error;
      toast.success(t('salarySaved'));
      setShowProcess(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  // Bulk process all employees for a month
  async function bulkProcess(month) {
    if (!employees.length || !month) { toast.error('Select a month and ensure employees exist'); return; }
    setSaving(true);
    try {
      const rows = employees.map(e => {
        const gross = Number(e.basic_salary) + Number(e.housing_allowance) + Number(e.transport_allowance) + Number(e.other_allowance);
        return {
          employee_id: e.id, payroll_month: month + '-01',
          basic_salary: e.basic_salary, housing_allowance: e.housing_allowance,
          transport_allowance: e.transport_allowance, other_allowance: e.other_allowance,
          gross_salary: gross, deductions: 0, net_salary: gross,
          status: 'paid', payment_date: new Date().toISOString().split('T')[0],
          created_by: profile?.id || user?.id
        };
      });
      const { error } = await supabase.from('payroll').upsert(rows, { onConflict: 'employee_id,payroll_month' });
      if (error) throw error;
      toast.success(`Payroll processed for ${employees.length} employees`);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  const totalNet = records.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.net_salary), 0);
  const getRows = () => records.map(r => [r.employees?.employee_no, r.employees?.full_name, r.payroll_month?.slice(0,7), `KD ${r.gross_salary}`, `KD ${r.deductions}`, `KD ${r.net_salary}`, r.status]);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('payroll')}</div></div>
        <div className="action-btns">
          <DownloadButtons title="Payroll" columns={[t('employeeNo'), t('fullName'), t('salaryMonth'), t('grossSalary'), t('deductions'), t('netSalary'), t('payStatus')]} getRows={getRows} />
          <button className="btn btn-primary" onClick={() => setShowProcess(true)}>+ {t('processPayroll')}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label={t('totalEmployees')} value={employees.length} icon="👥" color="blue" />
        <KpiCard label="Total Net Paid" value={`KD ${totalNet.toFixed(3)}`} icon="💳" color="green" />
        <KpiCard label="Pending" value={records.filter(r => r.status === 'pending').length} icon="⏳" color="amber" />
      </div>

      {/* Bulk process */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Bulk process month:</span>
          <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ width: 180 }} />
          <button className="btn btn-success btn-sm" onClick={() => bulkProcess(monthFilter)} disabled={!monthFilter}>
            ⚡ Process All Employees
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : records.length === 0 ? <EmptyState icon="💳" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('employeeNo')}</th><th>{t('fullName')}</th><th>{t('department')}</th><th>{t('salaryMonth')}</th><th>{t('grossSalary')}</th><th>{t('deductions')}</th><th>{t('netSalary')}</th><th>{t('payStatus')}</th><th>{t('actions')}</th></tr></thead>
            <tbody>{records.map(r => (
              <tr key={r.id}>
                <td><span className="tag">{r.employees?.employee_no}</span></td>
                <td><strong>{r.employees?.full_name}</strong></td>
                <td>{r.employees?.departments?.name || '—'}</td>
                <td>{r.payroll_month?.slice(0,7)}</td>
                <td>KD {Number(r.gross_salary).toFixed(3)}</td>
                <td style={{ color: Number(r.deductions) > 0 ? 'var(--danger)' : '' }}>KD {Number(r.deductions).toFixed(3)}</td>
                <td><strong style={{ color: 'var(--success)' }}>KD {Number(r.net_salary).toFixed(3)}</strong></td>
                <td><StatusBadge status={r.status} /></td>
                <td><button className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨 {t('payslip')}</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <Modal open={showProcess} onClose={() => setShowProcess(false)} title={`💳 ${t('processPayroll')}`}
        footer={<><button className="btn btn-outline" onClick={() => setShowProcess(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button></>}
      >
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('fullName')} *</label>
            <select value={form.employee_id} onChange={e => loadEmployee(e.target.value)}>
              <option value="">—</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('salaryMonth')} *</label><input type="month" value={form.payroll_month} onChange={e => f('payroll_month', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('basicSalary')} (KD)</label><input type="number" value={form.basic_salary} onChange={e => f('basic_salary', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('housingAllowance')} (KD)</label><input type="number" value={form.housing_allowance} onChange={e => f('housing_allowance', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('transportAllowance')} (KD)</label><input type="number" value={form.transport_allowance} onChange={e => f('transport_allowance', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('otherAllowance')} (KD)</label><input type="number" value={form.other_allowance} onChange={e => f('other_allowance', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('grossSalary')} (KD)</label><input readOnly value={form.gross_salary.toFixed ? form.gross_salary.toFixed(3) : form.gross_salary} style={{ fontWeight: 700 }} /></div>
          <div className="form-group"><label className="field-label">{t('deductions')} (KD)</label><input type="number" value={form.deductions} onChange={e => f('deductions', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('deduction_reason')}</label><input value={form.deduction_reason} onChange={e => f('deduction_reason', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('netSalary')} (KD)</label><input readOnly value={form.net_salary.toFixed ? form.net_salary.toFixed(3) : form.net_salary} style={{ fontWeight: 700, color: 'var(--success)' }} /></div>
          <div className="form-group"><label className="field-label">{t('paymentDate')}</label><input type="date" value={form.payment_date} onChange={e => f('payment_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('paymentMode')}</label><select value={form.payment_mode_id} onChange={e => f('payment_mode_id', e.target.value)}><option value="">—</option>{paymentModes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="form-group"><label className="field-label">{t('payStatus')}</label><select value={form.status} onChange={e => f('status', e.target.value)}><option value="paid">{t('paid')}</option><option value="pending">{t('pending')}</option></select></div>
        </div>
      </Modal>
    </div>
  );
}
