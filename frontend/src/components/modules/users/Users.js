// src/components/modules/users/Users.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Modal, StatusBadge, DownloadButtons,
  EmptyState, Spinner, InfoRow, useConfirm
} from '../../layout/SharedComponents';

export default function Users() {
  const { t } = useLang();
  const { profile, isOwner } = useAuth();
  const { Dialog } = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ full_name: '', full_name_ar: '', role: 'staff', is_active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSave() {
    if (!form.full_name.trim()) { toast.error(t('required')); return; }
    setSaving(true);
    try {
      if (editItem) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ full_name: form.full_name, full_name_ar: form.full_name_ar, role: form.role, is_active: form.is_active })
          .eq('id', editItem.id);
        if (error) throw error;
        toast.success(t('userSaved'));
      }
      setShowAdd(false);
      setEditItem(null);
      setForm({ full_name: '', full_name_ar: '', role: 'staff', is_active: true });
      load();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(user) {
    const newStatus = !user.is_active;
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: newStatus })
      .eq('id', user.id);
    if (error) toast.error(error.message);
    else { toast.success(newStatus ? 'User activated' : 'User deactivated'); load(); }
  }

  function openEdit(u) {
    setForm({ full_name: u.full_name, full_name_ar: u.full_name_ar || '', role: u.role, is_active: u.is_active });
    setEditItem(u);
    setShowAdd(true);
  }

  const roleBadge = (role) => {
    const colors = { owner: 'badge-info', admin: 'badge-warning', staff: 'badge-gray' };
    return <span className={`badge ${colors[role] || 'badge-gray'}`}>{t(role)}</span>;
  };

  if (!isOwner) {
    return (
      <div>
        <div className="page-header">
          <div><div className="page-title">{t('users')}</div></div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>🔒</div>
          <div style={{ fontSize: 14 }}>Only the Owner can manage users</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Dialog />
      <div className="page-header">
        <div>
          <div className="page-title">{t('users')}</div>
          <div className="page-subtitle">{users.length} {t('users').toLowerCase()}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons
            title="Users"
            columns={[t('fullName'), t('role'), t('status'), t('createdDate')]}
            getRows={() => users.map(u => [u.full_name, u.role, u.is_active ? 'Active' : 'Inactive', u.created_at?.slice(0, 10)])}
          />
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : users.length === 0 ? <EmptyState icon="👥" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('fullName')}</th>
                  <th>{t('role')}</th>
                  <th>{t('status')}</th>
                  <th>{t('createdDate')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.full_name}</strong>{u.full_name_ar ? <span style={{ color: 'var(--text2)', marginLeft: 8, fontSize: 12 }}>{u.full_name_ar}</span> : null}</td>
                    <td>{roleBadge(u.role)}</td>
                    <td><StatusBadge status={u.is_active ? 'active' : 'inactive'} /></td>
                    <td>{u.created_at?.slice(0, 10)}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-outline btn-sm" onClick={() => setViewItem(u)}>👁 {t('view')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>✏️ {t('edit')}</button>
                        {u.id !== profile?.id && (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ color: u.is_active ? 'var(--danger)' : 'var(--success)' }}
                            onClick={() => handleToggleActive(u)}
                          >
                            {u.is_active ? '🚫' : '✅'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditItem(null); }}
        title={`✏️ ${t('edit')} ${t('users')}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '...' : t('save')}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('fullName')} *</label>
            <input value={form.full_name} onChange={e => f('full_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">الاسم بالعربي</label>
            <input value={form.full_name_ar} onChange={e => f('full_name_ar', e.target.value)} dir="rtl" />
          </div>
          <div className="form-group">
            <label className="field-label">{t('role')}</label>
            <select value={form.role} onChange={e => f('role', e.target.value)}>
              <option value="owner">{t('owner')}</option>
              <option value="admin">{t('admin')}</option>
              <option value="staff">{t('staff')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('status')}</label>
            <select value={form.is_active} onChange={e => f('is_active', e.target.value === 'true')}>
              <option value="true">{t('active')}</option>
              <option value="false">{t('inactive')}</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      {viewItem && (
        <Modal
          open={!!viewItem}
          onClose={() => setViewItem(null)}
          title={`👤 ${viewItem.full_name}`}
          footer={<button className="btn btn-outline" onClick={() => setViewItem(null)}>{t('cancel')}</button>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { l: t('role'), v: roleBadge(viewItem.role) },
              { l: t('status'), v: <StatusBadge status={viewItem.is_active ? 'active' : 'inactive'} /> },
            ].map((x, i) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{x.l}</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{x.v}</div>
              </div>
            ))}
          </div>
          <InfoRow label={t('fullName')} value={viewItem.full_name} />
          <InfoRow label="Arabic Name" value={viewItem.full_name_ar} />
          <InfoRow label={t('createdDate')} value={viewItem.created_at?.slice(0, 10)} />
          <InfoRow label="Last Updated" value={viewItem.updated_at?.slice(0, 10)} />
        </Modal>
      )}
    </div>
  );
}
