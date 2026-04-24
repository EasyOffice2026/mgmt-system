import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import toast from 'react-hot-toast';
import { Modal, EmptyState, Spinner, StatusBadge } from '../../layout/SharedComponents';

const EMPTY_TABLE = {
  table_no: '',
  section_name: '',
  capacity: 2,
  status: 'available',
  notes: ''
};

export default function Tables() {
  const { t } = useLang();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_TABLE);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .order('table_no', { ascending: true });
    if (error) toast.error(error.message);
    else setTables(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function f(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!form.table_no.trim() || !form.capacity) {
      toast.error(t('required'));
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('restaurant_tables').insert({
      ...form,
      capacity: Number(form.capacity)
    });
    if (error) toast.error(error.message);
    else {
      toast.success(t('tableSaved'));
      setShowAdd(false);
      setForm(EMPTY_TABLE);
      load();
    }
    setSaving(false);
  }

  async function updateStatus(table, nextStatus) {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ status: nextStatus })
      .eq('id', table.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t('statusUpdated'));
      load();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('tables')}</div>
          <div className="page-subtitle">{tables.length} {t('tables').toLowerCase()}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('addTable')}</button>
      </div>

      {loading ? <Spinner /> : tables.length === 0 ? <EmptyState icon="🪑" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {tables.map((table) => (
            <div key={table.id} className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{table.table_no}</div>
                <StatusBadge status={table.status} />
              </div>
              <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 10 }}>
                {t('section')}: <strong>{table.section_name || '—'}</strong><br />
                {t('capacity')}: <strong>{table.capacity} {t('guests')}</strong>
              </div>
              <div className="action-btns">
                <button className="btn btn-outline btn-sm" onClick={() => updateStatus(table, 'available')}>{t('available')}</button>
                <button className="btn btn-outline btn-sm" onClick={() => updateStatus(table, 'occupied')}>{t('occupied')}</button>
                <button className="btn btn-outline btn-sm" onClick={() => updateStatus(table, 'reserved')}>{t('reserved')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={`🪑 ${t('addTable')}`}
        footer={(
          <>
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button>
          </>
        )}
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('tableNumber')} *</label>
            <input value={form.table_no} onChange={(e) => f('table_no', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('section')}</label>
            <input value={form.section_name} onChange={(e) => f('section_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('capacity')} *</label>
            <input type="number" min="1" value={form.capacity} onChange={(e) => f('capacity', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('status')}</label>
            <select value={form.status} onChange={(e) => f('status', e.target.value)}>
              <option value="available">{t('available')}</option>
              <option value="occupied">{t('occupied')}</option>
              <option value="reserved">{t('reserved')}</option>
              <option value="maintenance">{t('maintenance')}</option>
            </select>
          </div>
          <div className="form-group full">
            <label className="field-label">{t('notes')}</label>
            <textarea value={form.notes} onChange={(e) => f('notes', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
