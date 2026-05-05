// src/components/modules/customers/Customers.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Modal, StatusBadge, DownloadButtons, AttachZone, CameraZone,
  EmptyState, Spinner, InfoRow, useConfirm
} from '../../layout/SharedComponents';

const EMPTY = {
  full_name: '', full_name_ar: '', civil_id: '', mobile: '',
  passport_no: '', email: '', area_name: '', block_no: '',
  street_no: '', house_no: '', status: 'active'
};

export default function Customers() {
  const { t } = useLang();
  const { profile, user } = useAuth();
  const { confirm, Dialog } = useConfirm();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (search) q = q.or(`full_name.ilike.%${search}%,customer_no.ilike.%${search}%,civil_id.ilike.%${search}%`);
    const { data, error } = await q;
    if (!error) setCustomers(data || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function validate() {
    const e = {};
    if (!form.full_name.trim()) e.full_name = t('required');
    if (form.civil_id && !/^\d{12}$/.test(form.civil_id)) e.civil_id = t('invalidCivilId');
    if (form.mobile && !/^\d{8}$/.test(form.mobile)) e.mobile = t('invalidMobile');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('invalidEmail');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, created_by: profile?.id || user?.id };
      if (editItem) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editItem.id);
        if (error) throw error;
      } else {
        // Auto-generate customer_no via DB function
        const { data: noData } = await supabase.rpc('next_customer_no');
        const { error } = await supabase.from('customers').insert({ ...payload, customer_no: noData });
        if (error) throw error;
      }
      toast.success(t('customerSaved'));
      setShowAdd(false); setEditItem(null); setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm(t('delete') + '?');
    if (!ok) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); load(); }
  }

  function openEdit(c) {
    setForm({ ...c });
    setEditItem(c);
    setShowAdd(true);
  }

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); }

  const getRows = () => customers.map(c => [c.customer_no, c.full_name, c.civil_id, c.mobile, c.email, c.area_name, c.status]);

  return (
    <div>
      <Dialog />
      <div className="page-header">
        <div>
          <div className="page-title">{t('customers')}</div>
          <div className="page-subtitle">{customers.length} {t('customers').toLowerCase()}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons title="Customers" columns={[t('customerNo'), t('fullName'), t('civilId'), t('mobileNo'), t('emailAddress'), t('areaName'), t('status')]} getRows={getRows} />
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setEditItem(null); setShowAdd(true); }}>
            + {t('addCustomer')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        <select value={form.status_filter || ''} onChange={e => setSearch('')} style={{ width: 160 }}>
          <option value="">{t('filter')} — {t('status')}</option>
          <option value="active">{t('active')}</option>
          <option value="legal">{t('legalCase')}</option>
          <option value="inactive">{t('inactive')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <Spinner /> : customers.length === 0 ? <EmptyState icon="👤" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('customerNo')}</th>
                  <th>{t('fullName')}</th>
                  <th>{t('civilId')}</th>
                  <th>{t('mobileNo')}</th>
                  <th>{t('emailAddress')}</th>
                  <th>{t('areaName')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td><span className="tag">{c.customer_no}</span></td>
                    <td><strong>{c.full_name}</strong></td>
                    <td style={{ fontFamily: 'monospace' }}>{c.civil_id || '—'}</td>
                    <td>{c.mobile || '—'}</td>
                    <td style={{ color: 'var(--info)' }}>{c.email || '—'}</td>
                    <td>{c.area_name || '—'}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-outline btn-sm" onClick={() => setViewItem(c)}>👁 {t('view')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>✏️ {t('edit')}</button>
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditItem(null); setErrors({}); }}
        title={`${editItem ? '✏️ ' + t('edit') : '+'} ${t('addCustomer')}`}
        size="modal-lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setShowAdd(false); setEditItem(null); setErrors({}); }}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '...' : t('save')}
            </button>
          </>
        }
      >
        <div className="section-label">🧑 {t('personalInfo')}</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('fullName')} *</label>
            <input value={form.full_name} onChange={e => f('full_name', e.target.value)} className={errors.full_name ? 'error' : ''} />
            {errors.full_name && <span className="error-msg">{errors.full_name}</span>}
          </div>
          <div className="form-group">
            <label className="field-label">الاسم بالعربي</label>
            <input value={form.full_name_ar || ''} onChange={e => f('full_name_ar', e.target.value)} dir="rtl" />
          </div>
          <div className="form-group">
            <label className="field-label">{t('civilId')} ({t('civilIdHint')})</label>
            <input value={form.civil_id || ''} onChange={e => f('civil_id', e.target.value)} maxLength={12} className={errors.civil_id ? 'error' : ''} />
            {errors.civil_id && <span className="error-msg">{errors.civil_id}</span>}
          </div>
          <div className="form-group">
            <label className="field-label">{t('mobileNo')} ({t('mobileHint')})</label>
            <input value={form.mobile || ''} onChange={e => f('mobile', e.target.value)} maxLength={8} className={errors.mobile ? 'error' : ''} />
            {errors.mobile && <span className="error-msg">{errors.mobile}</span>}
          </div>
          <div className="form-group">
            <label className="field-label">{t('passportNo')}</label>
            <input value={form.passport_no || ''} onChange={e => f('passport_no', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('emailAddress')}</label>
            <input type="email" value={form.email || ''} onChange={e => f('email', e.target.value)} className={errors.email ? 'error' : ''} />
            {errors.email && <span className="error-msg">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label className="field-label">{t('status')}</label>
            <select value={form.status} onChange={e => f('status', e.target.value)}>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
              <option value="legal">{t('legalCase')}</option>
            </select>
          </div>
        </div>

        <hr className="divider" />
        <div className="section-label">🏠 {t('addressInfo')}</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('areaName')}</label>
            <input value={form.area_name || ''} onChange={e => f('area_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('blockNo')}</label>
            <input value={form.block_no || ''} onChange={e => f('block_no', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('streetNo')}</label>
            <input value={form.street_no || ''} onChange={e => f('street_no', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('houseNo')}</label>
            <input value={form.house_no || ''} onChange={e => f('house_no', e.target.value)} />
          </div>
        </div>

        <hr className="divider" />
        <div className="section-label">📎 {t('documents')}</div>
        <div className="attach-grid-2">
          <AttachZone icon="🪪" label={t('attachCivilId')} bucket="customer-docs" path={`civil-id/${form.civil_id || 'new'}`} />
          <AttachZone icon="📘" label={t('attachPassport')} bucket="customer-docs" path={`passport/${form.passport_no || 'new'}`} />
          <CameraZone label={t('takePhoto')} bucket="customer-docs" path="photos" />
        </div>
      </Modal>

      {/* View Modal */}
      {viewItem && (
        <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={`👤 ${viewItem.full_name}`}
          footer={<button className="btn btn-outline" onClick={() => setViewItem(null)}>{t('cancel')}</button>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { l: t('customerNo'), v: viewItem.customer_no },
              { l: t('status'), v: <StatusBadge status={viewItem.status} /> },
              { l: t('areaName'), v: viewItem.area_name },
            ].map((x, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{x.l}</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{x.v}</div>
              </div>
            ))}
          </div>
          <InfoRow label={t('civilId')} value={viewItem.civil_id} mono />
          <InfoRow label={t('mobileNo')} value={viewItem.mobile} />
          <InfoRow label={t('passportNo')} value={viewItem.passport_no} />
          <InfoRow label={t('emailAddress')} value={viewItem.email} />
          <InfoRow label={t('addressInfo')} value={[viewItem.area_name, viewItem.block_no && `Block ${viewItem.block_no}`, viewItem.street_no && `St ${viewItem.street_no}`, viewItem.house_no && `House ${viewItem.house_no}`].filter(Boolean).join(', ')} />
        </Modal>
      )}
    </div>
  );
}
