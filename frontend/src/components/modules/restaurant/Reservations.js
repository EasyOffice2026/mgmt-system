import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Modal, StatusBadge, EmptyState, Spinner, DownloadButtons } from '../../layout/SharedComponents';

const EMPTY = {
  guest_id: '',
  table_id: '',
  reservation_time: '',
  party_size: 2,
  status: 'booked',
  notes: ''
};

export default function Reservations() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [guests, setGuests] = useState([]);
  const [tables, setTables] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('reservations')
      .select('*, guests(full_name), restaurant_tables(table_no, table_name)')
      .order('reservation_time', { ascending: true });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('guests').select('id, full_name').order('full_name').then(({ data }) => setGuests(data || []));
    supabase.from('restaurant_tables').select('id, table_no, table_name, capacity').order('table_no').then(({ data }) => setTables(data || []));
  }, []);

  function f(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function save() {
    if (!form.guest_id || !form.table_id || !form.reservation_time) {
      toast.error(t('required'));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('reservations').insert({
      ...form,
      party_size: Number(form.party_size),
      created_by: profile?.id || null
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm(EMPTY);
    setShowAdd(false);
    toast.success(t('reservationSaved'));
    load();
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('reservations')}</div>
          <div className="page-subtitle">{items.length} reservations</div>
        </div>
        <div className="action-btns">
          <DownloadButtons
            title="Reservations"
            columns={[t('guestName'), t('table'), t('reservationTime'), t('partySize'), t('status')]}
            getRows={() => items.map(i => [i.guests?.full_name, i.restaurant_tables?.table_name || i.restaurant_tables?.table_no, i.reservation_time, i.party_size, t(i.status)])}
          />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('newReservation')}</button>
        </div>
      </div>

      <div className="search-bar">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">{t('allStatus')}</option>
          <option value="booked">{t('booked')}</option>
          <option value="seated">{t('seated')}</option>
          <option value="completed">{t('completed')}</option>
          <option value="cancelled">{t('cancelled')}</option>
        </select>
      </div>

      <div className="card">
        {loading ? <Spinner /> : items.length === 0 ? <EmptyState icon="📅" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('guestName')}</th>
                  <th>{t('table')}</th>
                  <th>{t('reservationTime')}</th>
                  <th>{t('partySize')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>{item.guests?.full_name || '—'}</td>
                    <td><span className="tag">{item.restaurant_tables?.table_name || item.restaurant_tables?.table_no || '—'}</span></td>
                    <td>{item.reservation_time ? new Date(item.reservation_time).toLocaleString() : '—'}</td>
                    <td>{item.party_size}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-outline btn-sm" onClick={() => updateStatus(item.id, 'seated')}>{t('seatGuest')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => updateStatus(item.id, 'completed')}>{t('complete')}</button>
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
        title={t('newReservation')}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '...' : t('save')}</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('guestName')} *</label>
            <select value={form.guest_id} onChange={e => f('guest_id', e.target.value)}>
              <option value="">—</option>
              {guests.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('table')} *</label>
            <select value={form.table_id} onChange={e => f('table_id', e.target.value)}>
              <option value="">—</option>
              {tables.map(ti => <option key={ti.id} value={ti.id}>{ti.table_name || ti.table_no} ({ti.capacity} seats)</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('reservationTime')} *</label>
            <input type="datetime-local" value={form.reservation_time} onChange={e => f('reservation_time', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('partySize')}</label>
            <input type="number" min={1} value={form.party_size} onChange={e => f('party_size', e.target.value)} />
          </div>
          <div className="form-group full">
            <label className="field-label">{t('notes')}</label>
            <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
