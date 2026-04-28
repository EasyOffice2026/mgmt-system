import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '../context';
import { api } from '../api';
import BranchFilter from './BranchFilter';
import ExportBar from './ExportBar';
import { Plus, Trash2, Save, X } from 'lucide-react';

export default function Purchases() {
  const { t, user } = useApp();
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === 'branch_user' ? user.branch_id : null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState('orders');
  const [itemForm, setItemForm] = useState({ name: '', name_ar: '', unit_price: 0, unit: 'piece', category: '' });

  function emptyForm() {
    return { date: new Date().toISOString().slice(0,10), supplier: '', item_id: null, item_name: '', quantity: 0, unit_price: 0, payment_mode: 'cash', notes: '' };
  }

  useEffect(() => { load(); loadItems(); }, [branchId]);

  function load() {
    const p = branchId ? `?branch_id=${branchId}` : '';
    api(`/api/purchases${p}`).then(setRows).catch(() => {});
  }

  function loadItems() {
    api('/api/purchases/items').then(setItems).catch(() => {});
  }

  function onItemSelect(itemId) {
    const item = items.find(i => i.id === Number(itemId));
    if (item) setForm(f => ({ ...f, item_id: item.id, item_name: item.name, unit_price: item.unit_price }));
    else setForm(f => ({ ...f, item_id: null, item_name: '', unit_price: 0 }));
  }

  async function handleSave() {
    const bid = user?.role === 'branch_user' ? user.branch_id : branchId;
    if (!bid) { toast.error(t('required')); return; }
    try {
      if (editId) {
        await api(`/api/purchases/${editId}`, { method: 'PUT', body: JSON.stringify({ ...form, branch_id: bid }) });
      } else {
        await api('/api/purchases', { method: 'POST', body: JSON.stringify({ ...form, branch_id: bid }) });
      }
      toast.success(t('savedSuccess')); setAdding(false); setEditId(null); setForm(emptyForm()); load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm(t('confirmDelete'))) return;
    await api(`/api/purchases/${id}`, { method: 'DELETE' }); toast.success(t('deletedSuccess')); load();
  }

  async function addItem() {
    if (!itemForm.name) { toast.error(t('required')); return; }
    await api('/api/purchases/items', { method: 'POST', body: JSON.stringify(itemForm) });
    toast.success(t('savedSuccess')); setItemForm({ name: '', name_ar: '', unit_price: 0, unit: 'piece', category: '' }); loadItems();
  }

  async function deleteItem(id) {
    if (!confirm(t('confirmDelete'))) return;
    await api(`/api/purchases/items/${id}`, { method: 'DELETE' }); toast.success(t('deletedSuccess')); loadItems();
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({ date: r.date, supplier: r.supplier, item_id: r.item_id, item_name: r.item_name, quantity: r.quantity, unit_price: r.unit_price, payment_mode: r.payment_mode, notes: r.notes });
    setAdding(true);
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{t('purchases')}</h2>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <BranchFilter value={branchId} onChange={setBranchId} />
          <ExportBar module="purchases" branchId={branchId} />
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button className={`btn ${tab==='orders'?'btn-primary':'btn-outline'}`} onClick={() => setTab('orders')}>{t('purchases')}</button>
        <button className={`btn ${tab==='items'?'btn-primary':'btn-outline'}`} onClick={() => setTab('items')}>{t('items')}</button>
      </div>

      {tab === 'orders' && <>
        {!adding && <button className="btn btn-primary" style={{marginBottom:12}} onClick={() => { setAdding(true); setEditId(null); setForm(emptyForm()); }}><Plus size={16}/> {t('add')}</button>}
        {adding && (
          <div className="card" style={{marginBottom:16}}>
            <div className="form-row">
              <div className="form-group"><label>{t('date')}</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
              <div className="form-group"><label>{t('supplier')}</label><input value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} /></div>
              <div className="form-group"><label>{t('item')}</label>
                <select value={form.item_id || ''} onChange={e => onItemSelect(e.target.value)}>
                  <option value="">--</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit_price})</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('quantity')}</label><input type="number" step="0.01" value={form.quantity} onChange={e => setForm({...form, quantity: Number(e.target.value)})} /></div>
              <div className="form-group"><label>{t('unitPrice')}</label><input type="number" step="0.01" value={form.unit_price} onChange={e => setForm({...form, unit_price: Number(e.target.value)})} /></div>
              <div className="form-group"><label>{t('total')}</label><input readOnly value={(form.quantity * form.unit_price).toFixed(2)} style={{background:'#f4f6fa'}} /></div>
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
            <thead><tr><th>{t('date')}</th><th>{t('supplier')}</th><th>{t('item')}</th><th>{t('quantity')}</th><th>{t('unitPrice')}</th><th>{t('total')}</th><th>{t('paymentMode')}</th><th>{t('notes')}</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>{t('noData')}</td></tr>}
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.supplier}</td><td>{r.item_name}</td><td>{r.quantity}</td><td>{r.unit_price}</td>
                  <td style={{fontWeight:600}}>{r.total?.toFixed(2)}</td><td>{r.payment_mode}</td><td>{r.notes}</td>
                  <td><div style={{display:'flex',gap:4}}>
                    <button className="btn btn-sm btn-outline" onClick={() => startEdit(r)}>{t('edit')}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}><Trash2 size={12}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      </>}

      {tab === 'items' && (
        <div className="card">
          <div className="form-row" style={{marginBottom:12}}>
            <div className="form-group"><label>{t('name')}</label><input value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} /></div>
            <div className="form-group"><label>{t('nameAr')}</label><input value={itemForm.name_ar} onChange={e => setItemForm({...itemForm, name_ar: e.target.value})} /></div>
            <div className="form-group"><label>{t('unitPrice')}</label><input type="number" step="0.01" value={itemForm.unit_price} onChange={e => setItemForm({...itemForm, unit_price: Number(e.target.value)})} /></div>
            <div className="form-group"><label>{t('unit')}</label><input value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} /></div>
            <div className="form-group"><label>{t('category')}</label><input value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} /></div>
            <div className="form-group" style={{justifyContent:'flex-end'}}><button className="btn btn-primary" onClick={addItem}><Plus size={14}/> {t('addItem')}</button></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('name')}</th><th>{t('nameAr')}</th><th>{t('unitPrice')}</th><th>{t('unit')}</th><th>{t('category')}</th><th></th></tr></thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id}><td>{i.name}</td><td>{i.name_ar}</td><td>{i.unit_price}</td><td>{i.unit}</td><td>{i.category}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => deleteItem(i.id)}><Trash2 size={12}/></button></td>
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
