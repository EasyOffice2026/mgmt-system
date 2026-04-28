import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context';
import { api } from '../api';
import BranchFilter from './BranchFilter';
import ExportBar from './ExportBar';
import { Plus, Trash2, Save, X } from 'lucide-react';

const CHANNELS = ['cash','knet','link','wamd','talabat','jahez','keeta'];

export default function Sales() {
  const { t, user, lang } = useApp();
  const [rows, setRows] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === 'branch_user' ? user.branch_id : null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  function emptyForm() {
    return { date: new Date().toISOString().slice(0,10), cash:0, knet:0, link:0, wamd:0, talabat:0, jahez:0, keeta:0, foodics_total:0, notes:'' };
  }

  useEffect(() => { load(); }, [branchId]);

  function load() {
    const params = branchId ? `?branch_id=${branchId}` : '';
    api(`/api/sales${params}`).then(setRows).catch(() => {});
  }

  function physical() {
    return CHANNELS.reduce((s, c) => s + Number(form[c] || 0), 0);
  }

  async function handleSave() {
    const bid = user?.role === 'branch_user' ? user.branch_id : branchId;
    if (!bid) { toast.error(t('required')); return; }
    try {
      if (editId) {
        await api(`/api/sales/${editId}`, { method: 'PUT', body: JSON.stringify({ ...form, branch_id: bid }) });
      } else {
        await api('/api/sales', { method: 'POST', body: JSON.stringify({ ...form, branch_id: bid }) });
      }
      toast.success(t('savedSuccess'));
      setAdding(false); setEditId(null); setForm(emptyForm()); load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm(t('confirmDelete'))) return;
    await api(`/api/sales/${id}`, { method: 'DELETE' });
    toast.success(t('deletedSuccess')); load();
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({ date: r.date, cash: r.cash, knet: r.knet, link: r.link, wamd: r.wamd, talabat: r.talabat, jahez: r.jahez, keeta: r.keeta, foodics_total: r.foodics_total, notes: r.notes });
    setAdding(true);
  }

  const fmt = n => Number(n||0).toFixed(2);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('sales')}</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <BranchFilter value={branchId} onChange={setBranchId} />
          <ExportBar module="sales" branchId={branchId} />
          {!adding && <button className="btn btn-primary" onClick={() => { setAdding(true); setEditId(null); setForm(emptyForm()); }}><Plus size={16}/> {t('add')}</button>}
        </div>
      </div>

      {adding && (
        <div className="card" style={{marginBottom:16}}>
          <div className="form-row">
            <div className="form-group"><label>{t('date')}</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            {CHANNELS.map(c => (
              <div className="form-group" key={c}><label>{t(c)}</label><input type="number" step="0.01" value={form[c]} onChange={e => setForm({...form, [c]: Number(e.target.value)})} /></div>
            ))}
            <div className="form-group"><label>{t('foodicsTotal')}</label><input type="number" step="0.01" value={form.foodics_total} onChange={e => setForm({...form, foodics_total: Number(e.target.value)})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>{t('physicalTotal')}</label><input readOnly value={fmt(physical())} style={{background:'#f4f6fa'}} /></div>
            <div className="form-group"><label>{t('difference')}</label><input readOnly value={fmt(physical() - Number(form.foodics_total||0))} style={{background:'#f4f6fa'}} /></div>
            <div className="form-group" style={{flex:2}}><label>{t('notes')}</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave}><Save size={14}/> {t('save')}</button>
            <button className="btn btn-outline" onClick={() => { setAdding(false); setEditId(null); }}><X size={14}/> {t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('date')}</th>
              {CHANNELS.map(c => <th key={c}>{t(c)}</th>)}
              <th>{t('physicalTotal')}</th><th>{t('foodicsTotal')}</th><th>{t('difference')}</th><th>{t('notes')}</th><th></th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={12} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>{t('noData')}</td></tr>}
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  {CHANNELS.map(c => <td key={c}>{fmt(r[c])}</td>)}
                  <td style={{fontWeight:600}}>{fmt(r.physical_total)}</td>
                  <td>{fmt(r.foodics_total)}</td>
                  <td style={{color: r.difference < 0 ? 'var(--danger)' : r.difference > 0 ? 'var(--success)' : ''}}>{fmt(r.difference)}</td>
                  <td>{r.notes}</td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm btn-outline" onClick={() => startEdit(r)}>{t('edit')}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
