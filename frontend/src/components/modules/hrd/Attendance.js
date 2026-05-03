// src/components/modules/hrd/Attendance.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Modal, EmptyState, Spinner, DownloadButtons } from '../../layout/SharedComponents';

const STATUS_OPTS = ['present', 'absent', 'late', 'half_day', 'holiday', 'leave'];
const STATUS_COLORS = { present: 'badge-success', absent: 'badge-danger', late: 'badge-warning', half_day: 'badge-info', holiday: 'badge-gray', leave: 'badge-purple' };

export default function Attendance() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMark, setShowMark] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [empFilter, setEmpFilter] = useState('');
  const [form, setForm] = useState({ employee_id: '', attendance_date: new Date().toISOString().split('T')[0], check_in: '', check_out: '', status: 'present', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('attendance').select('*, employees(full_name, employee_no)').order('attendance_date', { ascending: false }).limit(200);
    if (empFilter) q = q.eq('employee_id', empFilter);
    const { data } = await q;
    setRecords(data || []);
    setLoading(false);
  }, [empFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('employees').select('id, full_name, employee_no').eq('status', 'active').then(({ data }) => setEmployees(data || []));
  }, []);

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.employee_id || !form.attendance_date) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      // Upsert — if attendance already exists for this employee+date, update
      const { error } = await supabase.from('attendance').upsert({
        ...form,
        hours_worked: form.check_in && form.check_out
          ? Math.round((new Date(`2000-01-01T${form.check_out}`) - new Date(`2000-01-01T${form.check_in}`)) / 36000) / 100
          : null,
        created_by: profile.id
      }, { onConflict: 'employee_id,attendance_date' });
      if (error) throw error;
      toast.success('Attendance saved ✓');
      setShowMark(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  // Bulk mark all employees for a date
  async function bulkMark(status) {
    if (!employees.length) return;
    setSaving(true);
    try {
      const rows = employees.map(e => ({
        employee_id: e.id, attendance_date: selectedDate, status, created_by: profile.id
      }));
      const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'employee_id,attendance_date' });
      if (error) throw error;
      toast.success(`All marked as ${status}`);
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  const getRows = () => records.map(r => [r.employees?.employee_no, r.employees?.full_name, r.attendance_date, r.check_in || '—', r.check_out || '—', r.hours_worked || '—', r.status]);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('attendance')}</div><div className="page-subtitle">{records.length} records</div></div>
        <div className="action-btns">
          <DownloadButtons title="Attendance" columns={[t('employeeNo'), t('fullName'), t('date'), t('checkIn'), t('checkOut'), t('hoursWorked'), t('status')]} getRows={getRows} />
          <button className="btn btn-primary" onClick={() => setShowMark(true)}>+ {t('markAttendance')}</button>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Bulk mark for date:</span>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: 160 }} />
          <button className="btn btn-success btn-sm" onClick={() => bulkMark('present')}>✅ All Present</button>
          <button className="btn btn-outline btn-sm" onClick={() => bulkMark('holiday')}>🏖 Holiday</button>
          <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={{ width: 200 }}>
            <option value="">{t('allEmployees')}</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : records.length === 0 ? <EmptyState icon="🕐" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('employeeNo')}</th><th>{t('fullName')}</th><th>{t('date')}</th><th>{t('checkIn')}</th><th>{t('checkOut')}</th><th>{t('hoursWorked')}</th><th>{t('status')}</th></tr></thead>
            <tbody>{records.map(r => (
              <tr key={r.id}>
                <td><span className="tag">{r.employees?.employee_no}</span></td>
                <td><strong>{r.employees?.full_name}</strong></td>
                <td>{r.attendance_date}</td>
                <td>{r.check_in || '—'}</td>
                <td>{r.check_out || '—'}</td>
                <td>{r.hours_worked ? `${r.hours_worked}h` : '—'}</td>
                <td><span className={`badge ${STATUS_COLORS[r.status] || 'badge-gray'}`}>{t(r.status) || r.status}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      <Modal open={showMark} onClose={() => setShowMark(false)} title={`🕐 ${t('markAttendance')}`}
        footer={<><button className="btn btn-outline" onClick={() => setShowMark(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button></>}
      >
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('fullName')} *</label>
            <select value={form.employee_id} onChange={e => f('employee_id', e.target.value)}>
              <option value="">—</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('date')} *</label><input type="date" value={form.attendance_date} onChange={e => f('attendance_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('status')}</label>
            <select value={form.status} onChange={e => f('status', e.target.value)}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{t(s) || s}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('checkIn')}</label><input type="time" value={form.check_in} onChange={e => f('check_in', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('checkOut')}</label><input type="time" value={form.check_out} onChange={e => f('check_out', e.target.value)} /></div>
          <div className="form-group full"><label className="field-label">Notes</label><textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} /></div>
        </div>
      </Modal>
    </div>
  );
}
