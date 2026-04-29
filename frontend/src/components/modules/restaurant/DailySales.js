import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Modal, EmptyState, Spinner, KpiCard, DownloadButtons } from '../../layout/SharedComponents';

const INITIAL_FORM = {
  sale_date: new Date().toISOString().split('T')[0],
  shift: 'full_day',
  dine_in_orders: 0,
  takeaway_orders: 0,
  delivery_orders: 0,
  gross_sales: 0,
  discounts: 0,
  refunds: 0,
  cash_sales: 0,
  card_sales: 0,
  online_sales: 0,
  notes: '',
};

function toNum(v) {
  return Number(v) || 0;
}

export default function DailySales() {
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
      .from('daily_sales')
      .select('*')
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(90);
    setRecords(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function f(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function getComputedValues(input) {
    const totalOrders = toNum(input.dine_in_orders) + toNum(input.takeaway_orders) + toNum(input.delivery_orders);
    const netSales = toNum(input.gross_sales) - toNum(input.discounts) - toNum(input.refunds);
    const channelTotal = toNum(input.cash_sales) + toNum(input.card_sales) + toNum(input.online_sales);
    return { totalOrders, netSales, channelTotal };
  }

  async function handleSave() {
    if (!form.sale_date || toNum(form.gross_sales) <= 0) {
      toast.error(t('required'));
      return;
    }

    const { totalOrders, netSales } = getComputedValues(form);
    if (netSales < 0) {
      toast.error(t('netSalesNegative'));
      return;
    }

    setSaving(true);
    try {
      const { data: noData } = await supabase.rpc('next_daily_sale_no').catch(() => ({ data: `DS-${Date.now()}` }));
      const { error } = await supabase.from('daily_sales').insert({
        sale_no: noData || `DS-${Date.now()}`,
        sale_date: form.sale_date,
        shift: form.shift,
        dine_in_orders: toNum(form.dine_in_orders),
        takeaway_orders: toNum(form.takeaway_orders),
        delivery_orders: toNum(form.delivery_orders),
        total_orders: totalOrders,
        gross_sales: toNum(form.gross_sales),
        discounts: toNum(form.discounts),
        refunds: toNum(form.refunds),
        net_sales: netSales,
        cash_sales: toNum(form.cash_sales),
        card_sales: toNum(form.card_sales),
        online_sales: toNum(form.online_sales),
        notes: form.notes,
        created_by: profile?.id || null,
      });
      if (error) throw error;
      toast.success(t('dailySalesSaved'));
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
      acc.net += toNum(row.net_sales);
      acc.orders += toNum(row.total_orders);
      return acc;
    },
    { net: 0, orders: 0 }
  );
  const avgOrderValue = totals.orders > 0 ? totals.net / totals.orders : 0;

  const getRows = () =>
    records.map(r => [
      r.sale_no,
      r.sale_date,
      t(r.shift) || r.shift,
      r.total_orders,
      `KD ${Number(r.gross_sales).toFixed(3)}`,
      `KD ${Number(r.net_sales).toFixed(3)}`,
    ]);

  const computed = getComputedValues(form);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('dailySales')}</div>
          <div className="page-subtitle">{records.length} {t('records')}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons
            title="Daily_Sales"
            columns={[t('saleNo'), t('saleDate'), t('shift'), t('orders'), t('grossSales'), t('netSales')]}
            getRows={getRows}
          />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + {t('addDailySale')}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label={t('netSales')} value={`KD ${totals.net.toFixed(3)}`} icon="💵" color="green" />
        <KpiCard label={t('orders')} value={totals.orders} icon="🍽️" color="blue" />
        <KpiCard label={t('averageOrderValue')} value={`KD ${avgOrderValue.toFixed(3)}`} icon="🧮" color="teal" />
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : records.length === 0 ? (
          <EmptyState icon="🍽️" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('saleNo')}</th>
                  <th>{t('saleDate')}</th>
                  <th>{t('shift')}</th>
                  <th>{t('orders')}</th>
                  <th>{t('grossSales')}</th>
                  <th>{t('discounts')}</th>
                  <th>{t('refunds')}</th>
                  <th>{t('netSales')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><span className="tag">{r.sale_no}</span></td>
                    <td>{r.sale_date}</td>
                    <td><span className="pill">{t(r.shift) || r.shift}</span></td>
                    <td>{r.total_orders}</td>
                    <td>KD {Number(r.gross_sales).toFixed(3)}</td>
                    <td>KD {Number(r.discounts).toFixed(3)}</td>
                    <td>KD {Number(r.refunds).toFixed(3)}</td>
                    <td><strong style={{ color: 'var(--success)' }}>KD {Number(r.net_sales).toFixed(3)}</strong></td>
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
        title={`🍽️ ${t('addDailySale')}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t('save')}</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('saleDate')} *</label>
            <input type="date" value={form.sale_date} onChange={e => f('sale_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('shift')}</label>
            <select value={form.shift} onChange={e => f('shift', e.target.value)}>
              <option value="breakfast">{t('breakfast')}</option>
              <option value="lunch">{t('lunch')}</option>
              <option value="dinner">{t('dinner')}</option>
              <option value="full_day">{t('full_day')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('dineInOrders')}</label>
            <input type="number" value={form.dine_in_orders} onChange={e => f('dine_in_orders', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('takeawayOrders')}</label>
            <input type="number" value={form.takeaway_orders} onChange={e => f('takeaway_orders', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('deliveryOrders')}</label>
            <input type="number" value={form.delivery_orders} onChange={e => f('delivery_orders', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('orders')}</label>
            <input readOnly value={computed.totalOrders} style={{ fontWeight: 700 }} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('grossSales')} (KD) *</label>
            <input type="number" value={form.gross_sales} onChange={e => f('gross_sales', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('discounts')} (KD)</label>
            <input type="number" value={form.discounts} onChange={e => f('discounts', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('refunds')} (KD)</label>
            <input type="number" value={form.refunds} onChange={e => f('refunds', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('netSales')} (KD)</label>
            <input readOnly value={computed.netSales.toFixed(3)} style={{ fontWeight: 700, color: 'var(--success)' }} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('cashSales')} (KD)</label>
            <input type="number" value={form.cash_sales} onChange={e => f('cash_sales', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('cardSales')} (KD)</label>
            <input type="number" value={form.card_sales} onChange={e => f('card_sales', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('onlineSales')} (KD)</label>
            <input type="number" value={form.online_sales} onChange={e => f('online_sales', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('channelTotal')} (KD)</label>
            <input readOnly value={computed.channelTotal.toFixed(3)} />
          </div>
          <div className="form-group full">
            <label className="field-label">{t('notes')}</label>
            <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
