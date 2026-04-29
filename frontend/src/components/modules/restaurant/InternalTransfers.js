import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Modal, EmptyState, Spinner, KpiCard, DownloadButtons, StatusBadge } from '../../layout/SharedComponents';

const INITIAL_FORM = {
  transfer_date: new Date().toISOString().split('T')[0],
  from_branch: '',
  to_branch: '',
  item_name: '',
  quantity: 1,
  unit: 'pcs',
  transfer_value: 0,
  reason: '',
  status: 'in_transit',
};

function toNum(v) {
  return Number(v) || 0;
}

export default function InternalTransfers() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('internal_transfers')
      .select('*')
      .order('transfer_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(120);
    setRecords(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function f(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.transfer_date || !form.from_branch.trim() || !form.to_branch.trim() || !form.item_name.trim()) {
      toast.error(t('required'));
      return;
    }
    if (form.from_branch.trim().toLowerCase() === form.to_branch.trim().toLowerCase()) {
      toast.error(t('branchShouldDiffer'));
      return;
    }
    if (toNum(form.quantity) <= 0) {
      toast.error(t('quantityMustBePositive'));
      return;
    }

    setSaving(true);
    try {
      const { data: noData } = await supabase.rpc('next_internal_transfer_no').catch(() => ({ data: `TR-${Date.now()}` }));
      const { error } = await supabase.from('internal_transfers').insert({
        transfer_no: noData || `TR-${Date.now()}`,
        transfer_date: form.transfer_date,
        from_branch: form.from_branch.trim(),
        to_branch: form.to_branch.trim(),
        item_name: form.item_name.trim(),
        quantity: toNum(form.quantity),
        unit: form.unit,
        transfer_value: toNum(form.transfer_value),
        reason: form.reason,
        status: form.status,
        created_by: profile?.id || null,
      });
      if (error) throw error;
      toast.success(t('transferSaved'));
      setShowAdd(false);
      setForm(INITIAL_FORM);
      load();
    } catch (err) {
      toast.error(err.message || 'Unable to save');
    } finally {
      setSaving(false);
    }
  }

  const totals = records.reduce(
    (acc, row) => {
      acc.qty += toNum(row.quantity);
      acc.value += toNum(row.transfer_value);
      if (row.status === 'received') acc.received += 1;
      return acc;
    },
    { qty: 0, value: 0, received: 0 }
  );

  const getRows = () =>
    records.map(r => [
      r.transfer_no,
      r.transfer_date,
      r.from_branch,
      r.to_branch,
      r.item_name,
      `${r.quantity} ${r.unit || ''}`.trim(),
      `KD ${Number(r.transfer_value).toFixed(3)}`,
      r.status,
    ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('internalTransfers')}</div>
          <div className="page-subtitle">{records.length} {t('records')}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons
            title="Internal_Transfers"
            columns={[t('transferNo'), t('date'), t('fromBranch'), t('toBranch'), t('itemName'), t('quantity'), t('transferValue'), t('status')]}
            getRows={getRows}
          />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + {t('addTransfer')}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label={t('totalTransferQty')} value={totals.qty} icon="📦" color="blue" />
        <KpiCard label={t('totalTransferValue')} value={`KD ${totals.value.toFixed(3)}`} icon="🔁" color="teal" />
        <KpiCard label={t('receivedTransfers')} value={totals.received} icon="✅" color="green" />
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : records.length === 0 ? (
          <EmptyState icon="🔁" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('transferNo')}</th>
                  <th>{t('date')}</th>
                  <th>{t('fromBranch')}</th>
                  <th>{t('toBranch')}</th>
                  <th>{t('itemName')}</th>
                  <th>{t('quantity')}</th>
                  <th>{t('transferValue')}</th>
                  <th>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><span className="tag">{r.transfer_no}</span></td>
                    <td>{r.transfer_date}</td>
                    <td>{r.from_branch}</td>
                    <td>{r.to_branch}</td>
                    <td>{r.item_name}</td>
                    <td>{r.quantity} {r.unit}</td>
                    <td>KD {Number(r.transfer_value).toFixed(3)}</td>
                    <td><StatusBadge status={r.status} /></td>
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
        title={`🔁 ${t('addTransfer')}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('date')} *</label>
            <input type="date" value={form.transfer_date} onChange={e => f('transfer_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('fromBranch')} *</label>
            <input value={form.from_branch} onChange={e => f('from_branch', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('toBranch')} *</label>
            <input value={form.to_branch} onChange={e => f('to_branch', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('itemName')} *</label>
            <input value={form.item_name} onChange={e => f('item_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('quantity')} *</label>
            <input type="number" value={form.quantity} onChange={e => f('quantity', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('unit')}</label>
            <input value={form.unit} onChange={e => f('unit', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('transferValue')} (KD)</label>
            <input type="number" value={form.transfer_value} onChange={e => f('transfer_value', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('status')}</label>
            <select value={form.status} onChange={e => f('status', e.target.value)}>
              <option value="in_transit">{t('inTransit')}</option>
              <option value="received">{t('received')}</option>
              <option value="cancelled">{t('cancelled')}</option>
            </select>
          </div>
          <div className="form-group full">
            <label className="field-label">{t('reason')}</label>
            <textarea value={form.reason} onChange={e => f('reason', e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
