// src/components/modules/PlaceholderModules.js
// This file provides complete implementations for all remaining modules.
// Each module follows the same pattern as Customers.js and Employees.js.

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useLang } from '../../contexts/LangContext';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Modal, StatusBadge, DownloadButtons, AttachZone, CameraZone,
  EmptyState, Spinner, InfoRow, KpiCard, useConfirm
} from '../layout/SharedComponents';

// ── SALES / CONTRACTS ──────────────────────────────────────
export function Sales() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [form, setForm] = useState({
    customer_id: '', purchase_id: '', category_id: '', client_type: 'new',
    file_opening_charges: 0, sale_price: 0, duration_months: 12,
    start_date: '', first_installment_date: '', payment_mode_id: '', status: 'ongoing'
  });
  const [installPreview, setInstallPreview] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('contracts')
      .select('*, customers(full_name, customer_no), categories(name), payment_modes(name)')
      .order('created_at', { ascending: false });
    setContracts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('customers').select('id, full_name, customer_no').then(({ data }) => setCustomers(data || []));
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []));
    supabase.from('payment_modes').select('*').then(({ data }) => setPaymentModes(data || []));
    supabase.from('purchases').select('id, item_name, model_type, categories(name)').eq('inventory_status', 'in_stock').then(({ data }) => setInventory(data || []));
  }, []);

  function f(k, v) {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'sale_price' || k === 'duration_months') calcPreview(next);
      return next;
    });
  }

  function handleDuplicate(contract) {
    const duplicated = {
      customer_id: contract.customer_id || '',
      purchase_id: '',
      category_id: contract.category_id || '',
      client_type: contract.client_type || 'new',
      file_opening_charges: contract.file_opening_charges || 0,
      sale_price: contract.sale_price || 0,
      duration_months: contract.duration_months || 12,
      start_date: '',
      first_installment_date: '',
      payment_mode_id: contract.payment_mode_id || '',
      status: 'ongoing'
    };
    setForm(duplicated);
    calcPreview(duplicated);
    setShowAdd(true);
  }

  function calcPreview(frm) {
    const sp = parseFloat(frm.sale_price) || 0;
    const dur = parseInt(frm.duration_months) || 1;
    const iv = sp / dur;
    const start = frm.first_installment_date ? new Date(frm.first_installment_date) : new Date();
    const rows = [];
    for (let i = 0; i < Math.min(dur, 6); i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      rows.push({ no: i + 1, date: d.toISOString().split('T')[0], amount: iv.toFixed(3) });
    }
    setInstallPreview(rows);
  }

  async function handleSave() {
    if (!form.customer_id || !form.sale_price || !form.start_date) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      const sp = parseFloat(form.sale_price);
      const dur = parseInt(form.duration_months);
      const iv = sp / dur;
      const lastDate = form.first_installment_date ? new Date(form.first_installment_date) : new Date();
      lastDate.setMonth(lastDate.getMonth() + dur - 1);
      const { data: noData } = await supabase.rpc('next_contract_no');
      const { error } = await supabase.from('contracts').insert({
        ...form, contract_no: noData, installment_value: iv.toFixed(3),
        last_installment_date: lastDate.toISOString().split('T')[0],
        created_by: profile.id
      });
      if (error) throw error;
      // Mark inventory item as assigned
      if (form.purchase_id) await supabase.from('purchases').update({ inventory_status: 'assigned' }).eq('id', form.purchase_id);
      toast.success(t('contractSaved'));
      setShowAdd(false); setForm({ customer_id:'', purchase_id:'', category_id:'', client_type:'new', file_opening_charges:0, sale_price:0, duration_months:12, start_date:'', first_installment_date:'', payment_mode_id:'', status:'ongoing' });
      load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('sales')}</div><div className="page-subtitle">{contracts.length} {t('sales').toLowerCase()}</div></div>
        <div className="action-btns">
          <DownloadButtons title="Contracts" columns={[t('contractNo'), t('customer'), t('salePrice'), t('status')]} getRows={() => contracts.map(c => [c.contract_no, c.customers?.full_name, `KD ${c.sale_price}`, c.status])} />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('addContract')}</button>
        </div>
      </div>
      <div className="card">
        {loading ? <Spinner /> : contracts.length === 0 ? <EmptyState icon="📄" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('contractNo')}</th><th>{t('customer')}</th><th>{t('category')}</th><th>{t('salePrice')}</th><th>{t('durationMonths')}</th><th>{t('installmentValue')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead>
            <tbody>{contracts.map(c => (
              <tr key={c.id}>
                <td><span className="tag">{c.contract_no}</span></td>
                <td><strong>{c.customers?.full_name}</strong></td>
                <td><span className="pill">{c.categories?.name || '—'}</span></td>
                <td><strong>KD {Number(c.sale_price).toLocaleString()}</strong></td>
                <td>{c.duration_months}M</td>
                <td>KD {Number(c.installment_value).toFixed(3)}</td>
                <td><StatusBadge status={c.status} /></td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => setViewItem(c)}>👁 {t('view')}</button>
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: 4 }} onClick={() => handleDuplicate(c)}>📋 {t('duplicate')}</button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`📄 ${t('addContract')}`} size="modal-lg"
        footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button></>}
      >
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('customer')} *</label>
            <select value={form.customer_id} onChange={e => f('customer_id', e.target.value)}>
              <option value="">{t('selectCustomer')}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.customer_no} — {c.full_name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('category')}</label>
            <select value={form.category_id} onChange={e => f('category_id', e.target.value)}>
              <option value="">—</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('clientType')}</label>
            <select value={form.client_type} onChange={e => f('client_type', e.target.value)}>
              <option value="new">{t('newClient')}</option><option value="existing">{t('existingClient')}</option>
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('fileOpeningCharges')} (KD)</label><input type="number" value={form.file_opening_charges} onChange={e => f('file_opening_charges', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('salePrice')} (KD) *</label><input type="number" value={form.sale_price} onChange={e => f('sale_price', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('durationMonths')} *</label><input type="number" value={form.duration_months} onChange={e => f('duration_months', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('installmentValue')} (KD)</label><input readOnly value={form.duration_months > 0 ? (form.sale_price / form.duration_months).toFixed(3) : 0} style={{ fontWeight: 700 }} /></div>
          <div className="form-group"><label className="field-label">{t('startDate')} *</label><input type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('firstInstallDate')}</label><input type="date" value={form.first_installment_date} onChange={e => f('first_installment_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('paymentMode')}</label>
            <select value={form.payment_mode_id} onChange={e => f('payment_mode_id', e.target.value)}>
              <option value="">—</option>
              {paymentModes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('status')}</label>
            <select value={form.status} onChange={e => f('status', e.target.value)}>
              <option value="ongoing">{t('ongoing')}</option><option value="finished">{t('finished')}</option><option value="legal">{t('legalCase')}</option>
            </select>
          </div>
          <div className="form-group full"><label className="field-label">{t('selectProduct')}</label>
            <select value={form.purchase_id} onChange={e => f('purchase_id', e.target.value)}>
              <option value="">—</option>
              {inventory.map(p => <option key={p.id} value={p.id}>{p.item_name} — {p.model_type} ({p.categories?.name})</option>)}
            </select>
          </div>
        </div>
        {installPreview.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="section-label">📅 {t('installmentSchedule')} ({t('durationMonths')}: {form.duration_months})</div>
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>{t('dueDate')}</th><th>{t('amount')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {installPreview.map(r => <tr key={r.no}><td>{r.no}</td><td>{r.date}</td><td>KD {r.amount}</td><td><span className="badge badge-gray">{t('pending')}</span></td></tr>)}
                {form.duration_months > 6 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 12 }}>... {form.duration_months - 6} more installments</td></tr>}
              </tbody>
            </table></div>
          </div>
        )}
        <hr className="divider" />
        <div className="attach-grid-2">
          <AttachZone icon="📄" label={t('attachContract')} bucket="contracts" path="contract-copies" />
          <CameraZone label={t('takePhoto')} bucket="contracts" path="photos" />
        </div>
      </Modal>
    </div>
  );
}

// ── PURCHASE ──────────────────────────────────────────────
export function Purchase() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ purchase_date: '', supplier_name: '', invoice_no: '', place: '', category_id: '', item_name: '', model_type: '', purchase_price: 0, payment_mode_id: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('purchases').select('*, categories(name), payment_modes(name)').order('purchase_date', { ascending: false });
    setPurchases(data || []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []));
    supabase.from('payment_modes').select('*').then(({ data }) => setPaymentModes(data || []));
  }, []);

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.supplier_name || !form.item_name || !form.purchase_date) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      const { data: noData } = await supabase.rpc('next_purchase_no').catch(() => ({ data: `P-${Date.now()}` }));
      const { error } = await supabase.from('purchases').insert({ ...form, purchase_no: noData || `P-${Date.now()}`, created_by: profile.id });
      if (error) throw error;
      toast.success(t('purchaseSaved')); setShowAdd(false); load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('purchase')}</div></div>
        <div className="action-btns">
          <DownloadButtons title="Purchases" columns={[t('purchaseDate'), t('supplierName'), t('invoiceNo'), t('itemName'), t('purchasePrice')]} getRows={() => purchases.map(p => [p.purchase_date, p.supplier_name, p.invoice_no, p.item_name, `KD ${p.purchase_price}`])} />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('addPurchase')}</button>
        </div>
      </div>
      <div className="card">
        {loading ? <Spinner /> : purchases.length === 0 ? <EmptyState icon="🛒" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('purchaseDate')}</th><th>{t('supplierName')}</th><th>{t('invoiceNo')}</th><th>{t('category')}</th><th>{t('itemName')}</th><th>{t('modelType')}</th><th>{t('purchasePrice')}</th><th>{t('status')}</th></tr></thead>
            <tbody>{purchases.map(p => (
              <tr key={p.id}>
                <td>{p.purchase_date}</td>
                <td><strong>{p.supplier_name}</strong></td>
                <td><span className="tag">{p.invoice_no || '—'}</span></td>
                <td><span className="pill">{p.categories?.name || '—'}</span></td>
                <td>{p.item_name}</td><td>{p.model_type || '—'}</td>
                <td><strong>KD {Number(p.purchase_price).toLocaleString()}</strong></td>
                <td><StatusBadge status={p.inventory_status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`🛒 ${t('addPurchase')}`}
        footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button></>}
      >
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('purchaseDate')} *</label><input type="date" value={form.purchase_date} onChange={e => f('purchase_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('supplierName')} *</label><input value={form.supplier_name} onChange={e => f('supplier_name', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('invoiceNo')}</label><input value={form.invoice_no} onChange={e => f('invoice_no', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('placeOffice')}</label><input value={form.place} onChange={e => f('place', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('category')}</label><select value={form.category_id} onChange={e => f('category_id', e.target.value)}><option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="form-group"><label className="field-label">{t('itemName')} *</label><input value={form.item_name} onChange={e => f('item_name', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('modelType')}</label><input value={form.model_type} onChange={e => f('model_type', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('purchasePrice')} (KD) *</label><input type="number" value={form.purchase_price} onChange={e => f('purchase_price', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('paymentMode')}</label><select value={form.payment_mode_id} onChange={e => f('payment_mode_id', e.target.value)}><option value="">—</option>{paymentModes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
        <hr className="divider" />
        <div className="attach-grid-2">
          <AttachZone icon="🧾" label="Attach Invoice" bucket="purchases" path="invoices" />
          <CameraZone label={t('takePhoto')} bucket="purchases" path="photos" />
        </div>
      </Modal>
    </div>
  );
}

// ── INVENTORY ─────────────────────────────────────────────
export function Inventory() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('purchases').select('*, categories(name), payment_modes(name)').order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('inventory_status', statusFilter);
    const { data } = await q;
    setItems(data || []); setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('inventory')}</div><div className="page-subtitle">{items.length} items</div></div>
        <div className="action-btns">
          <DownloadButtons title="Inventory" columns={['ID', t('category'), t('itemName'), t('modelType'), t('purchasePrice'), t('supplierName'), t('status')]} getRows={() => items.map(i => [i.purchase_no, i.categories?.name, i.item_name, i.model_type, `KD ${i.purchase_price}`, i.supplier_name, i.inventory_status])} />
        </div>
      </div>
      <div className="search-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 200 }}>
          <option value="">All Status</option>
          <option value="in_stock">{t('inStock')}</option>
          <option value="assigned">{t('assigned')}</option>
          <option value="sold">{t('sold')}</option>
        </select>
      </div>
      <div className="card">
        {loading ? <Spinner /> : items.length === 0 ? <EmptyState icon="📦" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>ID</th><th>{t('category')}</th><th>{t('itemName')}</th><th>{t('modelType')}</th><th>{t('purchasePrice')}</th><th>{t('supplierName')}</th><th>{t('status')}</th></tr></thead>
            <tbody>{items.map(i => (
              <tr key={i.id}>
                <td><span className="tag">{i.purchase_no}</span></td>
                <td><span className="pill">{i.categories?.name || '—'}</span></td>
                <td><strong>{i.item_name}</strong></td>
                <td>{i.model_type || '—'}</td>
                <td><strong>KD {Number(i.purchase_price).toLocaleString()}</strong></td>
                <td>{i.supplier_name}</td>
                <td><StatusBadge status={i.inventory_status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// ── LEGAL CASES ───────────────────────────────────────────
export function LegalCases() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [cases, setCases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customer_id:'', contract_id:'', purchase_price:0, original_contract_amount:0, remaining_from_customer:0, case_amount:0, received_from_customer:0, received_from_court:0, status:'active' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('legal_cases').select('*, customers(full_name, customer_no), contracts(contract_no)').order('created_at', { ascending: false });
    setCases(data || []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('customers').select('id, full_name, customer_no').eq('status', 'legal').then(({ data }) => setCustomers(data || []));
  }, []);

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function loadContracts(custId) {
    const { data } = await supabase.from('contracts').select('id, contract_no').eq('customer_id', custId).eq('status', 'legal');
    setContracts(data || []);
  }

  async function handleSave() {
    if (!form.customer_id) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      const { data: noData } = await supabase.rpc('next_legal_no');
      const { error } = await supabase.from('legal_cases').insert({ ...form, case_no: noData, created_by: profile.id });
      if (error) throw error;
      toast.success(t('caseSaved')); setShowAdd(false); load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  const excess = (parseFloat(form.received_from_court) || 0) + (parseFloat(form.received_from_customer) || 0) - (parseFloat(form.remaining_from_customer) || 0);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('legal')}</div></div>
        <div className="action-btns">
          <DownloadButtons title="Legal_Cases" columns={[t('caseNo'), t('customer'), t('contractNo'), t('originalContractAmount'), t('remainingFromCustomer'), t('excessAmount')]} getRows={() => cases.map(c => [c.case_no, c.customers?.full_name, c.contracts?.contract_no, `KD ${c.original_contract_amount}`, `KD ${c.remaining_from_customer}`, `KD ${c.excess_amount}`])} />
          <button className="btn btn-danger" onClick={() => setShowAdd(true)}>⚖️ {t('addLegalCase')}</button>
        </div>
      </div>
      <div className="card">
        {loading ? <Spinner /> : cases.length === 0 ? <EmptyState icon="⚖️" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('caseNo')}</th><th>{t('customer')}</th><th>{t('contractNo')}</th><th>{t('originalContractAmount')}</th><th>{t('remainingFromCustomer')}</th><th>{t('caseAmount')}</th><th>{t('receivedFromCustomer')}</th><th>{t('receivedFromCourt')}</th><th>{t('excessAmount')}</th><th>{t('status')}</th></tr></thead>
            <tbody>{cases.map(c => (
              <tr key={c.id}>
                <td><span className="tag">{c.case_no}</span></td>
                <td><strong>{c.customers?.full_name}</strong></td>
                <td><span className="tag">{c.contracts?.contract_no}</span></td>
                <td>KD {Number(c.original_contract_amount).toFixed(3)}</td>
                <td style={{ color: 'var(--danger)', fontWeight: 600 }}>KD {Number(c.remaining_from_customer).toFixed(3)}</td>
                <td>KD {Number(c.case_amount).toFixed(3)}</td>
                <td>KD {Number(c.received_from_customer).toFixed(3)}</td>
                <td>KD {Number(c.received_from_court).toFixed(3)}</td>
                <td style={{ color: Number(c.excess_amount) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>KD {Number(c.excess_amount).toFixed(3)}</td>
                <td><StatusBadge status={c.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`⚖️ ${t('addLegalCase')}`} size="modal-lg"
        footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button><button className="btn btn-danger" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button></>}
      >
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('customer')} ({t('legalOnly')})</label>
            <select value={form.customer_id} onChange={e => { f('customer_id', e.target.value); loadContracts(e.target.value); }}>
              <option value="">—</option>{customers.map(c => <option key={c.id} value={c.id}>{c.customer_no} — {c.full_name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('contractNo')}</label>
            <select value={form.contract_id} onChange={e => f('contract_id', e.target.value)}>
              <option value="">—</option>{contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('purchasePriceItem')} (KD)</label><input type="number" value={form.purchase_price} onChange={e => f('purchase_price', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('originalContractAmount')} (KD)</label><input type="number" value={form.original_contract_amount} onChange={e => f('original_contract_amount', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('remainingFromCustomer')} (KD)</label><input type="number" value={form.remaining_from_customer} onChange={e => f('remaining_from_customer', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('caseAmount')} (KD)</label><input type="number" value={form.case_amount} onChange={e => f('case_amount', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('receivedFromCustomer')} (KD)</label><input type="number" value={form.received_from_customer} onChange={e => f('received_from_customer', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('receivedFromCourt')} (KD)</label><input type="number" value={form.received_from_court} onChange={e => f('received_from_court', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('excessAmount')} (KD)</label><input readOnly value={excess.toFixed(3)} style={{ fontWeight: 700, color: excess >= 0 ? 'var(--success)' : 'var(--danger)' }} /></div>
          <div className="form-group"><label className="field-label">{t('status')}</label><select value={form.status} onChange={e => f('status', e.target.value)}><option value="active">Active</option><option value="settled">Settled</option><option value="closed">Closed</option></select></div>
        </div>
        <hr className="divider" />
        <div className="attach-grid-2">
          <AttachZone icon="📋" label="Case Documents" bucket="legal" path="case-docs" />
          <CameraZone label={t('takePhoto')} bucket="legal" path="photos" />
        </div>
      </Modal>
    </div>
  );
}

// ── EXPENSES ─────────────────────────────────────────────
export function Expenses() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ voucher_no:'', expense_date:'', expense_type_id:'', amount:0, case_no:'', customer_id:'', contract_id:'', payment_mode_id:'', description:'' });
  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('expenses').select('*, expense_types(name, requires_case), customers(full_name), contracts(contract_no), payment_modes(name)').order('expense_date', { ascending: false });
    setExpenses(data || []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('expense_types').select('*').then(({ data }) => setExpenseTypes(data || []));
    supabase.from('customers').select('id, full_name, customer_no').then(({ data }) => setCustomers(data || []));
    supabase.from('payment_modes').select('*').then(({ data }) => setPaymentModes(data || []));
  }, []);

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.expense_date || !form.amount) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      const { data: noData } = await supabase.rpc('next_expense_no');
      const { error } = await supabase.from('expenses').insert({ ...form, voucher_no: noData, created_by: profile.id });
      if (error) throw error;
      toast.success(t('expenseSaved')); setShowAdd(false); load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('expenses')}</div></div>
        <div className="action-btns">
          <DownloadButtons title="Expenses" columns={[t('voucherNo'), t('expenseDate'), t('expenseType'), t('amount'), t('customer')]} getRows={() => expenses.map(e => [e.voucher_no, e.expense_date, e.expense_types?.name, `KD ${e.amount}`, e.customers?.full_name || '—'])} />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('addExpense')}</button>
        </div>
      </div>
      <div className="card">
        {loading ? <Spinner /> : expenses.length === 0 ? <EmptyState icon="💸" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('voucherNo')}</th><th>{t('expenseDate')}</th><th>{t('expenseType')}</th><th>{t('amount')}</th><th>{t('customer')}</th><th>{t('relatedContract')}</th></tr></thead>
            <tbody>{expenses.map(e => (
              <tr key={e.id}>
                <td><span className="tag">{e.voucher_no}</span></td>
                <td>{e.expense_date}</td>
                <td><span className="pill">{e.expense_types?.name}</span></td>
                <td><strong>KD {Number(e.amount).toFixed(3)}</strong></td>
                <td>{e.customers?.full_name || '—'}</td>
                <td>{e.contracts?.contract_no ? <span className="tag">{e.contracts.contract_no}</span> : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`💸 ${t('addExpense')}`}
        footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button></>}
      >
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('expenseDate')} *</label><input type="date" value={form.expense_date} onChange={e => f('expense_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('expenseType')}</label>
            <select value={form.expense_type_id} onChange={e => { f('expense_type_id', e.target.value); setSelectedType(expenseTypes.find(et => et.id === e.target.value)); }}>
              <option value="">—</option>{expenseTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="field-label">{t('amount')} (KD) *</label><input type="number" value={form.amount} onChange={e => f('amount', e.target.value)} /></div>
          {selectedType?.requires_case && <div className="form-group"><label className="field-label">{t('caseReference')}</label><input value={form.case_no} onChange={e => f('case_no', e.target.value)} /></div>}
          <div className="form-group"><label className="field-label">{t('relatedCustomer')}</label><select value={form.customer_id} onChange={e => f('customer_id', e.target.value)}><option value="">—</option>{customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div>
          <div className="form-group"><label className="field-label">{t('paymentMode')}</label><select value={form.payment_mode_id} onChange={e => f('payment_mode_id', e.target.value)}><option value="">—</option>{paymentModes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="form-group full"><label className="field-label">Description</label><textarea value={form.description} onChange={e => f('description', e.target.value)} /></div>
        </div>
        <hr className="divider" />
        <div className="attach-grid-2"><AttachZone icon="📄" label="Receipt/Invoice" bucket="expenses" path="receipts" /><CameraZone label={t('takePhoto')} bucket="expenses" path="photos" /></div>
      </Modal>
    </div>
  );
}

// ── RECEIPTS ─────────────────────────────────────────────
export function Receipts() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ receipt_date:'', receipt_type:'installment', amount:0, customer_id:'', contract_id:'', legal_case_id:'', payment_mode_id:'', notes:'' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('receipts').select('*, customers(full_name), contracts(contract_no), legal_cases(case_no), payment_modes(name)').order('receipt_date', { ascending: false });
    setReceipts(data || []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from('customers').select('id, full_name, customer_no').then(({ data }) => setCustomers(data || []));
    supabase.from('payment_modes').select('*').then(({ data }) => setPaymentModes(data || []));
  }, []);

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.receipt_date || !form.amount) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      const { data: noData } = await supabase.rpc('next_receipt_no');
      const { error } = await supabase.from('receipts').insert({ ...form, receipt_no: noData, created_by: profile.id });
      if (error) throw error;
      toast.success(t('receiptSaved')); setShowAdd(false); load();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  const typeLabel = { file_opening: t('fileOpening'), installment: t('installmentReceipt'), court_money: t('courtMoney'), other: t('other') };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('receipts')}</div></div>
        <div className="action-btns">
          <DownloadButtons title="Receipts" columns={[t('receiptNo'), t('receiptDate'), t('receiptType'), t('receiptAmount'), t('customer')]} getRows={() => receipts.map(r => [r.receipt_no, r.receipt_date, r.receipt_type, `KD ${r.amount}`, r.customers?.full_name || '—'])} />
          <button className="btn btn-success" onClick={() => setShowAdd(true)}>+ {t('addReceipt')}</button>
        </div>
      </div>
      <div className="card">
        {loading ? <Spinner /> : receipts.length === 0 ? <EmptyState icon="🧾" /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t('receiptNo')}</th><th>{t('receiptDate')}</th><th>{t('receiptType')}</th><th>{t('receiptAmount')}</th><th>{t('customer')}</th><th>{t('contractNo')}</th><th>{t('courtCaseNo')}</th></tr></thead>
            <tbody>{receipts.map(r => (
              <tr key={r.id}>
                <td><span className="tag">{r.receipt_no}</span></td>
                <td>{r.receipt_date}</td>
                <td><span className="pill">{typeLabel[r.receipt_type] || r.receipt_type}</span></td>
                <td><strong>KD {Number(r.amount).toFixed(3)}</strong></td>
                <td>{r.customers?.full_name || '—'}</td>
                <td>{r.contracts?.contract_no ? <span className="tag">{r.contracts.contract_no}</span> : '—'}</td>
                <td>{r.legal_cases?.case_no ? <span className="tag">{r.legal_cases.case_no}</span> : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`🧾 ${t('addReceipt')}`}
        footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button><button className="btn btn-success" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button></>}
      >
        <div className="form-grid">
          <div className="form-group"><label className="field-label">{t('receiptDate')} *</label><input type="date" value={form.receipt_date} onChange={e => f('receipt_date', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('receiptType')}</label><select value={form.receipt_type} onChange={e => f('receipt_type', e.target.value)}><option value="file_opening">{t('fileOpening')}</option><option value="installment">{t('installmentReceipt')}</option><option value="court_money">{t('courtMoney')}</option><option value="other">{t('other')}</option></select></div>
          <div className="form-group"><label className="field-label">{t('receiptAmount')} (KD) *</label><input type="number" value={form.amount} onChange={e => f('amount', e.target.value)} /></div>
          <div className="form-group"><label className="field-label">{t('customer')}</label><select value={form.customer_id} onChange={e => f('customer_id', e.target.value)}><option value="">—</option>{customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div>
          <div className="form-group"><label className="field-label">{t('courtCaseNo')}</label><input value={form.legal_case_id} onChange={e => f('legal_case_id', e.target.value)} placeholder="LC-YYYY-XXX" /></div>
          <div className="form-group"><label className="field-label">{t('paymentMode')}</label><select value={form.payment_mode_id} onChange={e => f('payment_mode_id', e.target.value)}><option value="">—</option>{paymentModes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
        <hr className="divider" />
        <div className="attach-grid-2"><AttachZone icon="🧾" label="Payment Receipt" bucket="receipts" path="docs" /><CameraZone label={t('takePhoto')} bucket="receipts" path="photos" /></div>
      </Modal>
    </div>
  );
}

// ── ACCOUNTING ────────────────────────────────────────────
export function Accounting() {
  const { t } = useLang();
  const [monthlyData, setMonthlyData] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [sales, purchases, expenses, partnerData] = await Promise.all([
        supabase.from('contracts').select('sale_price, created_at'),
        supabase.from('purchases').select('purchase_price, purchase_date'),
        supabase.from('expenses').select('amount, expense_date'),
        supabase.from('partners').select('*, partner_transactions(amount, transaction_type)'),
      ]);

      // Group by month
      const months = {};
      (sales.data || []).forEach(r => {
        const m = r.created_at?.slice(0, 7);
        if (!months[m]) months[m] = { sales: 0, purchase: 0, expenses: 0 };
        months[m].sales += Number(r.sale_price);
      });
      (purchases.data || []).forEach(r => {
        const m = r.purchase_date?.slice(0, 7);
        if (!months[m]) months[m] = { sales: 0, purchase: 0, expenses: 0 };
        months[m].purchase += Number(r.purchase_price);
      });
      (expenses.data || []).forEach(r => {
        const m = r.expense_date?.slice(0, 7);
        if (!months[m]) months[m] = { sales: 0, purchase: 0, expenses: 0 };
        months[m].expenses += Number(r.amount);
      });

      setMonthlyData(Object.entries(months).sort().reverse().slice(0, 12).map(([m, v]) => ({ month: m, ...v, profit: v.sales - v.purchase - v.expenses })));
      setPartners(partnerData.data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{t('accounting')}</div></div>
        <div className="action-btns">
          <DownloadButtons title="Monthly_Report" columns={[t('month'), t('salesAmount'), t('purchaseAmount'), t('expenseAmount'), t('profit')]} getRows={() => monthlyData.map(m => [m.month, `KD ${m.sales.toFixed(3)}`, `KD ${m.purchase.toFixed(3)}`, `KD ${m.expenses.toFixed(3)}`, `KD ${m.profit.toFixed(3)}`])} />
        </div>
      </div>
      {loading ? <Spinner /> : (
        <>
          <div className="card">
            <div className="card-title">📊 {t('monthlyTrend')}</div>
            <div className="table-wrap"><table>
              <thead><tr><th>{t('month')}</th><th>{t('salesAmount')}</th><th>{t('purchaseAmount')}</th><th>{t('expenseAmount')}</th><th>{t('profit')}</th></tr></thead>
              <tbody>{monthlyData.map(m => (
                <tr key={m.month}>
                  <td><strong>{m.month}</strong></td>
                  <td style={{ color: 'var(--info)' }}>KD {m.sales.toFixed(3)}</td>
                  <td style={{ color: 'var(--warning)' }}>KD {m.purchase.toFixed(3)}</td>
                  <td style={{ color: 'var(--danger)' }}>KD {m.expenses.toFixed(3)}</td>
                  <td><strong style={{ color: m.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>KD {m.profit.toFixed(3)}</strong></td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
          <div className="card">
            <div className="card-title">🤝 {t('partnerContributions')}</div>
            <div className="table-wrap"><table>
              <thead><tr><th>{t('partnerName')}</th><th>{t('contribution')}</th><th>{t('withdrawn')}</th><th>{t('shareBalance')}</th></tr></thead>
              <tbody>{partners.length === 0 ? <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20, color: 'var(--text2)' }}>No partners added yet</td></tr> : partners.map(p => {
                const contrib = (p.partner_transactions || []).filter(t => t.transaction_type === 'contribution').reduce((s, t) => s + Number(t.amount), 0);
                const withdrawn = (p.partner_transactions || []).filter(t => t.transaction_type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0);
                return (<tr key={p.id}><td><strong>{p.name}</strong></td><td>KD {contrib.toFixed(3)}</td><td>KD {withdrawn.toFixed(3)}</td><td><strong style={{ color: 'var(--success)' }}>KD {(contrib - withdrawn).toFixed(3)}</strong></td></tr>);
              })}</tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}

// ── SETTINGS ─────────────────────────────────────────────
export function Settings() {
  const { t } = useLang();
  const [categories, setCategories] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [newMode, setNewMode] = useState('');

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []));
    supabase.from('payment_modes').select('*').then(({ data }) => setPaymentModes(data || []));
  }, []);

  async function addCategory() {
    if (!newCat.trim()) return;
    await supabase.from('categories').insert({ name: newCat });
    setNewCat('');
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []));
  }

  async function addMode() {
    if (!newMode.trim()) return;
    await supabase.from('payment_modes').insert({ name: newMode });
    setNewMode('');
    supabase.from('payment_modes').select('*').then(({ data }) => setPaymentModes(data || []));
  }

  return (
    <div>
      <div className="page-header"><div><div className="page-title">{t('settings')}</div></div></div>
      <div className="card">
        <div className="card-title">🏷️ Categories</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {categories.map(c => <span key={c.id} className="pill">{c.name}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category..." style={{ width: 220 }} />
          <button className="btn btn-primary btn-sm" onClick={addCategory}>+ Add</button>
        </div>
      </div>
      <div className="card">
        <div className="card-title">💳 Payment Modes</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {paymentModes.map(p => <span key={p.id} className="pill">{p.name}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newMode} onChange={e => setNewMode(e.target.value)} placeholder="New payment mode..." style={{ width: 220 }} />
          <button className="btn btn-primary btn-sm" onClick={addMode}>+ Add</button>
        </div>
      </div>
    </div>
  );
}
