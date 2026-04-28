import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context';
import { api } from '../api';
import BranchFilter from './BranchFilter';
import ExportBar from './ExportBar';
import { Plus, Trash2, Save, X } from 'lucide-react';

const CATEGORIES = ['Rent','Utilities','Salaries','Maintenance','Supplies','Marketing','Transport','Other'];

export default function Expenses() {
  const { t, user } = useApp();
  const [rows, setRows] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === 'branch_user' ? user.branch_id : null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  function emptyForm() {
    return { date: new Date().toISOString().slice(0,10), category: '', description: '', amount: 0, payment_mode: 'cash', notes: '' };
  }

  useEffect(() => { load(); }, [branchId]);

  function load() {
    const p = branchId ? `?branch_id=${branchId}` : '';
    api(`/api/expenses${p}`).then(setRows).catch(() => {});
  }

  async function handleSave() {
    const bid = user?.role === 'branch_user' ? user.branch_id : branchId;
    if (!bid) { toast.error(t('required')); return; }
    try {
      if (editId) {
        await api(`/api/expenses/${editId}`, { method: 'PUT', body: JSON.stringify({ ...form, branch_id: bid }) });
      } else {
        await api('/api/expenses', { method: 'POST', body: JSON.stringify({ ...form, branch_id: bid }) });
      }
      toast.success(t('savedSuccess')); setAdding(false); setEditId(null); setForm(emptyForm()); load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm(t('confirmDelete'))) return;
    await api(`/api/expenses/${id}`, { method: 'DELETE' }); toast.success(t('deletedSuccess')); load();
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({ date: r.date, category: r.category, description: r.description, amount: r.amount, payment_mode: r.payment_mode, notes: r.notes });
    setAdding(true);
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('expenses')}</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <BranchFilter value={branchId} onChange={setBranchId} />
          <ExportBar module="expenses" branchId={branchId} />
          {!adding && <button className="btn btn-primary" onClick={() => { setAdding(true); setEditId(null); setForm(emptyForm()); }}><Plus size={16}/> {t('add')}</button>}
        </div>
      </div>

      {adding && (
        <div className="card" style={{marginBottom:16}}>
          <div className="form-row">
            <div className="form-group"><label>{t('date')}</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div className="form-group"><label>{t('category')}</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option value="">--</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:2}}><label>{t('description')}</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="form-group"><label>{t('amount')}</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} /></div>
            <div className="form-group"><label>{t('paymentMode')}</label>
              <select value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})}>
                <option value="cash">Cash</option><option value="knet">KNET</option><option value="transfer">Transfer</option>
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
          <thead><tr><th>{t('date')}</th><th>{t('category')}</th><th>{t('description')}</th><th>{t('amount')}</th><th>{t('paymentMode')}</th><th>{t('notes')}</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>{t('noData')}</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.date}</td><td>{r.category}</td><td>{r.description}</td><td style={{fontWeight:600}}>{r.amount?.toFixed(2)}</td><td>{r.payment_mode}</td><td>{r.notes}</td>
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
