import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context';
import { api } from '../api';
import BranchFilter from './BranchFilter';
import ExportBar from './ExportBar';
import { Plus, Trash2, Save, X } from 'lucide-react';

export default function CashSheet() {
  const { t, user } = useApp();
  const [rows, setRows] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === 'branch_user' ? user.branch_id : null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);

  function emptyForm() {
    return { date: new Date().toISOString().slice(0,10), opening_balance: 0, deposited: 0, notes: '' };
  }

  useEffect(() => { load(); }, [branchId]);

  function load() {
    const p = branchId ? `?branch_id=${branchId}` : '';
    api(`/api/cash${p}`).then(setRows).catch(() => {});
  }

  async function handleSave() {
    const bid = user?.role === 'branch_user' ? user.branch_id : branchId;
    if (!bid) { toast.error(t('required')); return; }
    try {
      if (editId) {
        await api(`/api/cash/${editId}`, { method: 'PUT', body: JSON.stringify({ ...form, branch_id: bid }) });
      } else {
        await api('/api/cash', { method: 'POST', body: JSON.stringify({ ...form, branch_id: bid }) });
      }
      toast.success(t('savedSuccess')); setAdding(false); setEditId(null); setForm(emptyForm()); load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm(t('confirmDelete'))) return;
    await api(`/api/cash/${id}`, { method: 'DELETE' }); toast.success(t('deletedSuccess')); load();
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({ date: r.date, opening_balance: r.opening_balance, deposited: r.deposited, notes: r.notes });
    setAdding(true);
  }

  const fmt = n => Number(n||0).toFixed(2);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('cashSheet')}</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <BranchFilter value={branchId} onChange={setBranchId} />
          <ExportBar module="cash" branchId={branchId} />
          {!adding && <button className="btn btn-primary" onClick={() => { setAdding(true); setEditId(null); setForm(emptyForm()); }}><Plus size={16}/> {t('add')}</button>}
        </div>
      </div>

      {adding && (
        <div className="card" style={{marginBottom:16}}>
          <div className="form-row">
            <div className="form-group"><label>{t('date')}</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            <div className="form-group"><label>{t('openingBalance')}</label><input type="number" step="0.01" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: Number(e.target.value)})} /></div>
            <div className="form-group"><label>{t('deposited')}</label><input type="number" step="0.01" value={form.deposited} onChange={e => setForm({...form, deposited: Number(e.target.value)})} /></div>
            <div className="form-group" style={{flex:2}}><label>{t('notes')}</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <p style={{fontSize:12,color:'var(--text-muted)',margin:'6px 0'}}>Cash Sales, Purchases & Expenses are auto-calculated from recorded entries.</p>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave}><Save size={14}/> {t('save')}</button>
            <button className="btn btn-outline" onClick={() => { setAdding(false); setEditId(null); }}><X size={14}/> {t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="card"><div className="table-wrap">
        <table>
          <thead><tr>
            <th>{t('date')}</th><th>{t('openingBalance')}</th><th>{t('cashSales')}</th><th>{t('cashPurchases')}</th>
            <th>{t('cashExpenses')}</th><th>{t('deposited')}</th><th>{t('closingBalance')}</th><th>{t('notes')}</th><th></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>{t('noData')}</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.date}</td><td>{fmt(r.opening_balance)}</td><td>{fmt(r.cash_sales)}</td>
                <td>{fmt(r.cash_purchases)}</td><td>{fmt(r.cash_expenses)}</td><td>{fmt(r.deposited)}</td>
                <td style={{fontWeight:600, color: r.closing_balance < 0 ? 'var(--danger)' : 'var(--success)'}}>{fmt(r.closing_balance)}</td>
                <td>{r.notes}</td>
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
