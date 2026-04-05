// src/components/modules/hrd/Leaves.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Modal, StatusBadge, EmptyState, Spinner, DownloadButtons } from '../../layout/SharedComponents';

export default function Leaves() {
  const { t } = useLang();
  const { profile, isAdmin } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', from_date: '', to_date: '', days_count: 0, reason: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('leaves').select('*, employees(full_name, employee_no), leave_types(name)').order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setLeaves(data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('employees').select('id, full_name, employee_no').eq('status', 'active').then(({ data }) => setEmployees(data || []));
    supabase.from('leave_types').select('*').then(({ data }) => setLeaveTypes(data || []));
  }, []);

  function f(k, v) {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      // Auto-calculate days
      if ((k === 'from_date' || k === 'to_date') && next.from_date && next.to_date) {
        const diff = Math.ceil((new Date(next.to_date) - new Date(next.from_date)) / (1000 * 60 * 60 * 24)) + 1;
        next.days_count = Math.max(0, diff);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.employee_id || !form.from_date || !form.to_date) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('leaves').insert({ ...form, status: 'pending', created_by: profile.id });
      if (error) throw error;
      toast.success('Leave request submitted');
      setShowAdd(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from('leaves').update({ status, approved_by: profile.id, approved_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success(`Leave ${status}`); load(); }
  }

  const getRows = () => leaves.map(l => [l.employees?.employee_no, l.employees?.full_name, l.leave_types?.name, l.from_date, l.to_date, l.days_count, l.status]);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('leaves')}</div><div className="page-subtitle">{leaves.length} requests</div></div>
        <div className="action-btns">
          <DownloadButtons title="Leaves" columns={[t('employeeNo'), t('fullName'), t('leaveType'), t('fromDate'), t('toDate'), t('days'), t('status')]} getRows={getRows} />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('requestLeave')}</button>
        </div>
      </div>

      <div className="search-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 200 }}>
          <option value="">All Status</option>
          <option value="pending">{t('pending')}</option>
          <option value="approved">{t('approved')}</option>
          <option value="rejected">{t('rejected')}</option>
        </select>
      </div>

      <div className="card">
        {loading ? <Spinner /> : leaves.length === 0 ? <EmptyState icon="🌴" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('employeeNo')}</th><th>{t('fullName')}</th><th>{t('leaveType')}</th><th>{t('fromDate')}</th><th>{t('toDate')}</th><th>{t('days')}</th><th>{t('reason')}</th><th>{t('status')}</th>{isAdmin && <th>{t('actions')}</th>}</tr></thead>
            <tbody>{leaves.map(l => (
              <tr key={l.id}>
                <td><span className="tag">{l.employees?.employee_no}</span></td>
                <td><strong>{l.employees?.full_name}</strong></td>
                <td><span className="pill">{l.leave_types?.name}</span></td>
                <td>{l.from_date}</td>
                <td>{l.to_date}</td>
                <td><strong>{l.days_count} {t('days')}</strong></td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason || '—'}</td>
                <td><StatusBadge status={l.status} /></td>
                {isAdmin && (
                  <td>
                    {l.status === 'pending' && (
                      <div className="action-btns">
                        <button className="btn btn-success btn-sm" onClick={() => updateStatus(l.id, 'approved')}>✅ {t('approved')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => updateStatus(l.id, 'rejected')}>❌ {t('rejected')}</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`🌴 ${t('requestLeave')}`}
        footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button></>}
      >
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('fullName')} *</label>
            <select value={form.employee_id} onChange={e => f('employee_id', e.target.value)}>
              <option value="">—</option>{employees.map(e => <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('leaveType')} *</label>
            <select value={form.leave_type_id} onChange={e => f('leave_type_id', e.target.value)}>
              <option value="">—</option>{leaveTypes.map(l => <option key={l.id} value={l.id}>{l.name} {l.is_paid ? '(Paid)' : '(Unpaid)'}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('fromDate')} *</label><input type="date" value={form.from_date} onChange={e => f('from_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('toDate')} *</label><input type="date" value={form.to_date} onChange={e => f('to_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('days')}</label><input readOnly value={form.days_count} style={{ fontWeight: 700 }} /></div>
          <div className="form-group full"><label className="field-label">{t('reason')}</label><textarea value={form.reason} onChange={e => f('reason', e.target.value)} rows={3} /></div>
        </div>
      </Modal>
    </div>
  );
}
