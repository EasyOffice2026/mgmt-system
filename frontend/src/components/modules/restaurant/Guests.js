import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Modal, DownloadButtons, EmptyState, Spinner, StatusBadge, useConfirm } from '../../layout/SharedComponents';

const EMPTY = { full_name: '', phone: '', email: '', loyalty_tier: 'regular', notes: '', status: 'active' };

export default function Guests() {
  const { t } = useLang();
  const { profile } = useAuth();
  const { confirm, Dialog } = useConfirm();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('guests').select('*').order('created_at', { ascending: false });
    if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,guest_no.ilike.%${search}%`);
    const { data } = await q;
    setGuests(data || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.full_name.trim()) {
      toast.error(t('required'));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, created_by: profile?.id || null };
      if (editItem) {
        const { error } = await supabase.from('guests').update(payload).eq('id', editItem.id);
        if (error) throw error;
      } else {
        const { data: nextNo } = await supabase.rpc('next_guest_no');
        const { error } = await supabase.from('guests').insert({ ...payload, guest_no: nextNo || `GST-${Date.now()}` });
        if (error) throw error;
      }
      toast.success(t('guestSaved'));
      setShowAdd(false);
      setEditItem(null);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm(`${t('delete')}?`);
    if (!ok) return;
    const { error } = await supabase.from('guests').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success(t('delete'));
      load();
    }
  }

  return (
    <div>
      <Dialog />
      <div className="page-header">
        <div>
          <div className="page-title">{t('guests')}</div>
          <div className="page-subtitle">{guests.length} {t('guests').toLowerCase()}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons
            title="Guests"
            columns={[t('guestNo'), t('fullName'), t('phone'), t('emailAddress'), t('loyaltyTier'), t('status')]}
            getRows={() => guests.map(g => [g.guest_no, g.full_name, g.phone || '', g.email || '', g.loyalty_tier, g.status])}
          />
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm(EMPTY); setShowAdd(true); }}>
            + {t('addGuest')}
          </button>
        </div>
      </div>

      <div className="search-bar">
        <input value={search} placeholder={t('searchGuests')} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        {loading ? <Spinner /> : guests.length === 0 ? <EmptyState icon="👥" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('guestNo')}</th>
                  <th>{t('fullName')}</th>
                  <th>{t('phone')}</th>
                  <th>{t('emailAddress')}</th>
                  <th>{t('loyaltyTier')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {guests.map(g => (
                  <tr key={g.id}>
                    <td><span className="tag">{g.guest_no}</span></td>
                    <td><strong>{g.full_name}</strong></td>
                    <td>{g.phone || '—'}</td>
                    <td>{g.email || '—'}</td>
                    <td><span className="pill">{g.loyalty_tier}</span></td>
                    <td><StatusBadge status={g.status} /></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditItem(g); setForm({ ...g }); setShowAdd(true); }}>
                          ✏️ {t('edit')}
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(g.id)}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editItem ? t('editGuest') : t('addGuest')}
        footer={(
          <>
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button>
          </>
        )}
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('fullName')} *</label>
            <input value={form.full_name || ''} onChange={e => f('full_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('phone')}</label>
            <input value={form.phone || ''} onChange={e => f('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('emailAddress')}</label>
            <input type="email" value={form.email || ''} onChange={e => f('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('loyaltyTier')}</label>
            <select value={form.loyalty_tier || 'regular'} onChange={e => f('loyalty_tier', e.target.value)}>
              <option value="regular">{t('regular')}</option>
              <option value="silver">{t('silver')}</option>
              <option value="gold">{t('gold')}</option>
              <option value="vip">{t('vip')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('status')}</label>
            <select value={form.status || 'active'} onChange={e => f('status', e.target.value)}>
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select>
          </div>
          <div className="form-group full">
            <label className="field-label">{t('notes')}</label>
            <textarea value={form.notes || ''} onChange={e => f('notes', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
