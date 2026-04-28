import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context';
import { api } from '../api';
import BranchFilter from './BranchFilter';
import ExportBar from './ExportBar';
import { Plus, Trash2, Save, X } from 'lucide-react';

export default function HR() {
  const { t, user } = useApp();
  const [rows, setRows] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === 'branch_user' ? user.branch_id : null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  function emptyForm() {
    return { name: '', name_ar: '', civil_id: '', mobile: '', position: '', nationality: '', salary: 0, join_date: '', status: 'active', notes: '' };
  }

  useEffect(() => { load(); }, [branchId]);

  function load() {
    const p = branchId ? `?branch_id=${branchId}` : '';
    api(`/api/hr${p}`).then(setRows).catch(() => {});
  }

  function validateFields() {
    if (form.civil_id && (form.civil_id.length !== 12 || !/^\d+$/.test(form.civil_id))) {
      toast.error(t('civilIdError')); return false;
    }
    if (form.mobile && (form.mobile.length !== 8 || !/^\d+$/.test(form.mobile))) {
      toast.error(t('mobileError')); return false;
    }
    return true;
  }

  async function handleSave() {
    const bid = user?.role === 'branch_user' ? user.branch_id : branchId;
    if (!bid || !form.name) { toast.error(t('required')); return; }
    if (!validateFields()) return;
    try {
      const payload = { ...form, branch_id: bid, join_date: form.join_date || null };
      if (editId) {
        await api(`/api/hr/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/hr', { method: 'POST', body: JSON.stringify(payload) });
      }
      toast.success(t('savedSuccess')); setAdding(false); setEditId(null); setForm(emptyForm()); load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm(t('confirmDelete'))) return;
    await api(`/api/hr/${id}`, { method: 'DELETE' }); toast.success(t('deletedSuccess')); load();
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({ name: r.name, name_ar: r.name_ar, civil_id: r.civil_id, mobile: r.mobile, position: r.position, nationality: r.nationality, salary: r.salary, join_date: r.join_date || '', status: r.status, notes: r.notes });
    setAdding(true);
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('hr')}</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <BranchFilter value={branchId} onChange={setBranchId} />
          <ExportBar module="hr" branchId={branchId} />
          {!adding && <button className="btn btn-primary" onClick={() => { setAdding(true); setEditId(null); setForm(emptyForm()); }}><Plus size={16}/> {t('add')}</button>}
        </div>
      </div>

      {adding && (
        <div className="card" style={{marginBottom:16}}>
          <div className="form-row">
            <div className="form-group"><label>{t('name')}</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div className="form-group"><label>{t('nameAr')}</label><input value={form.name_ar} onChange={e => setForm({...form, name_ar: e.target.value})} /></div>
            <div className="form-group"><label>{t('civilId')} (12)</label><input value={form.civil_id} maxLength={12} onChange={e => setForm({...form, civil_id: e.target.value.replace(/\D/g,'')})} placeholder="123456789012" /></div>
            <div className="form-group"><label>{t('mobile')} (8)</label><input value={form.mobile} maxLength={8} onChange={e => setForm({...form, mobile: e.target.value.replace(/\D/g,'')})} placeholder="12345678" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t('position')}</label><input value={form.position} onChange={e => setForm({...form, position: e.target.value})} /></div>
            <div className="form-group"><label>{t('nationality')}</label><input value={form.nationality} onChange={e => setForm({...form, nationality: e.target.value})} /></div>
            <div className="form-group"><label>{t('salary')}</label><input type="number" step="0.01" value={form.salary} onChange={e => setForm({...form, salary: Number(e.target.value)})} /></div>
            <div className="form-group"><label>{t('joinDate')}</label><input type="date" value={form.join_date} onChange={e => setForm({...form, join_date: e.target.value})} /></div>
            <div className="form-group"><label>{t('status')}</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:2}}><label>{t('notes')}</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave}><Save size={14}/> {t('save')}</button>
            <button className="btn btn-outline" onClick={() => { setAdding(false); setEditId(null); }}><X size={14}/> {t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="card"><div className="table-wrap">
        <table>
          <thead><tr><th>{t('name')}</th><th>{t('civilId')}</th><th>{t('mobile')}</th><th>{t('position')}</th><th>{t('nationality')}</th><th>{t('salary')}</th><th>{t('joinDate')}</th><th>{t('status')}</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>{t('noData')}</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.name}</td><td>{r.civil_id}</td><td>{r.mobile}</td><td>{r.position}</td><td>{r.nationality}</td>
                <td>{r.salary?.toFixed(2)}</td><td>{r.join_date}</td>
                <td><span style={{color: r.status === 'active' ? 'var(--success)' : 'var(--danger)'}}>{t(r.status)}</span></td>
                <td><div style={{display:'flex',gap:4}}>
                  <button className="btn btn-sm btn-outline" onClick={() => startEdit(r)}>{t('edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}><Trash2 size={12}/></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
