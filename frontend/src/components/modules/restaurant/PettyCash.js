import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Modal, EmptyState, Spinner, KpiCard, DownloadButtons } from '../../layout/SharedComponents';

const INITIAL_FORM = {
  transaction_date: new Date().toISOString().split('T')[0],
  transaction_type: 'expense',
  category: '',
  amount: 0,
  payment_mode_id: '',
  description: '',
};

function toNum(v) {
  return Number(v) || 0;
}

export default function PettyCash() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [records, setRecords] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    const [txnsRes, modesRes] = await Promise.all([
      supabase
        .from('petty_cash_transactions')
        .select('*, payment_modes(name)')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(120),
      supabase.from('payment_modes').select('*'),
    ]);
    setRecords(txnsRes.data || []);
    setPaymentModes(modesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function f(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.transaction_date || toNum(form.amount) <= 0) {
      toast.error(t('required'));
      return;
    }

    setSaving(true);
    try {
      const { data: noData } = await supabase.rpc('next_petty_cash_no').catch(() => ({ data: `PC-${Date.now()}` }));
      const { error } = await supabase.from('petty_cash_transactions').insert({
        voucher_no: noData || `PC-${Date.now()}`,
        transaction_date: form.transaction_date,
        transaction_type: form.transaction_type,
        category: form.category,
        amount: toNum(form.amount),
        payment_mode_id: form.payment_mode_id || null,
        description: form.description,
        created_by: profile?.id || null,
      });
      if (error) throw error;
      toast.success(t('pettyCashSaved'));
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
      if (row.transaction_type === 'replenishment' || row.transaction_type === 'adjustment_add') {
        acc.inflow += toNum(row.amount);
      } else {
        acc.outflow += toNum(row.amount);
      }
      return acc;
    },
    { inflow: 0, outflow: 0 }
  );
  const balance = totals.inflow - totals.outflow;

  const getRows = () =>
    records.map(r => [
      r.voucher_no,
      r.transaction_date,
      t(r.transaction_type) || r.transaction_type,
      r.category || '—',
      `KD ${Number(r.amount).toFixed(3)}`,
      r.payment_modes?.name || '—',
    ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('pettyCash')}</div>
          <div className="page-subtitle">{records.length} {t('records')}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons
            title="Petty_Cash"
            columns={[t('voucherNo'), t('date'), t('transactionType'), t('category'), t('amount'), t('paymentMode')]}
            getRows={getRows}
          />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + {t('addPettyCash')}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label={t('pettyCashInflow')} value={`KD ${totals.inflow.toFixed(3)}`} icon="⬆️" color="green" />
        <KpiCard label={t('pettyCashOutflow')} value={`KD ${totals.outflow.toFixed(3)}`} icon="⬇️" color="red" />
        <KpiCard label={t('pettyCashBalance')} value={`KD ${balance.toFixed(3)}`} icon="💰" color="blue" />
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : records.length === 0 ? (
          <EmptyState icon="💵" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('voucherNo')}</th>
                  <th>{t('date')}</th>
                  <th>{t('transactionType')}</th>
                  <th>{t('category')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('paymentMode')}</th>
                  <th>{t('description')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><span className="tag">{r.voucher_no}</span></td>
                    <td>{r.transaction_date}</td>
                    <td><span className="pill">{t(r.transaction_type) || r.transaction_type}</span></td>
                    <td>{r.category || '—'}</td>
                    <td><strong>KD {Number(r.amount).toFixed(3)}</strong></td>
                    <td>{r.payment_modes?.name || '—'}</td>
                    <td>{r.description || '—'}</td>
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
        title={`💵 ${t('addPettyCash')}`}
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
            <input type="date" value={form.transaction_date} onChange={e => f('transaction_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('transactionType')}</label>
            <select value={form.transaction_type} onChange={e => f('transaction_type', e.target.value)}>
              <option value="expense">{t('expense')}</option>
              <option value="replenishment">{t('replenishment')}</option>
              <option value="adjustment_add">{t('adjustmentAdd')}</option>
              <option value="adjustment_less">{t('adjustmentLess')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('category')}</label>
            <input value={form.category} onChange={e => f('category', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('amount')} (KD) *</label>
            <input type="number" value={form.amount} onChange={e => f('amount', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('paymentMode')}</label>
            <select value={form.payment_mode_id} onChange={e => f('payment_mode_id', e.target.value)}>
              <option value="">—</option>
              {paymentModes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group full">
            <label className="field-label">{t('description')}</label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
