import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { DownloadButtons, EmptyState, Spinner } from '../../layout/SharedComponents';

export default function Orders() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [diningTables, setDiningTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState('dine_in');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [ordersRes, tablesRes, menuRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_no, order_type, status, total_amount, ordered_at, restaurant_tables(table_no, table_name)')
        .order('ordered_at', { ascending: false })
        .limit(20),
      supabase.from('restaurant_tables').select('id, table_no, table_name, status').order('table_no', { ascending: true }),
      supabase.from('menu_items').select('id, item_name, price, is_available').eq('is_available', true).order('item_name', { ascending: true }),
    ]);

    setOrders(ordersRes.data || []);
    setDiningTables(tablesRes.data || []);
    setMenuItems(menuRes.data || []);
    setLoading(false);
  }

  const selectedMenuItem = useMemo(
    () => menuItems.find((item) => item.id === selectedItem),
    [menuItems, selectedItem]
  );

  async function createQuickOrder() {
    if (!selectedItem || qty < 1) {
      toast.error(t('required'));
      return;
    }
    if (orderType === 'dine_in' && !selectedTable) {
      toast.error(t('required'));
      return;
    }

    setBusy(true);
    try {
      const { data: orderNo } = await supabase.rpc('next_order_no');
      const subtotal = Number(selectedMenuItem.price) * Number(qty);

      const { data: orderRow, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_no: orderNo,
          table_id: selectedTable || null,
          order_type: orderType,
          status: 'placed',
          subtotal,
          service_charge: 0,
          tax_amount: 0,
          total_amount: subtotal,
          created_by: profile?.id,
        })
        .select('id')
        .single();
      if (orderErr) throw orderErr;

      const { error: lineErr } = await supabase.from('order_items').insert({
        order_id: orderRow.id,
        menu_item_id: selectedItem,
        quantity: Number(qty),
        unit_price: Number(selectedMenuItem.price),
        line_total: subtotal,
      });
      if (lineErr) throw lineErr;

      if (selectedTable) await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', selectedTable);

      toast.success(t('orderSaved'));
      setSelectedItem('');
      setSelectedTable('');
      setQty(1);
      setOrderType('dine_in');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed to create order');
    } finally {
      setBusy(false);
    }
  }

  async function updateOrderStatus(orderId, nextStatus) {
    const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    if (error) toast.error(error.message);
    else {
      toast.success(t('statusUpdated'));
      load();
    }
  }

  const rows = orders.map((o) => [
    o.order_no,
    o.order_type,
    o.restaurant_tables?.table_name || o.restaurant_tables?.table_no || '-',
    o.status,
    Number(o.total_amount).toFixed(3),
    o.ordered_at?.slice(0, 16).replace('T', ' '),
  ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('orders')}</div>
          <div className="page-subtitle">{orders.length} recent orders</div>
        </div>
        <DownloadButtons
          title="Orders"
          columns={['Order No', 'Type', 'Table', 'Status', 'Total', 'Time']}
          getRows={() => rows}
        />
      </div>

      <div className="card">
        <div className="card-title">🧾 {t('createOrder')}</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('orderType')}</label>
            <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
              <option value="dine_in">{t('dineIn')}</option>
              <option value="takeaway">{t('takeaway')}</option>
              <option value="delivery">{t('delivery')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('table')}</label>
            <select
              value={selectedTable}
              disabled={orderType !== 'dine_in'}
              onChange={(e) => setSelectedTable(e.target.value)}
            >
              <option value="">{t('selectTable')}</option>
              {diningTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.table_name || table.table_no}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('menuItem')}</label>
            <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
              <option value="">{t('selectMenuItem')}</option>
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_name} - KD {Number(item.price).toFixed(3)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('quantity')}</label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={createQuickOrder} disabled={busy}>
            {busy ? '...' : t('save')}
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <EmptyState icon="🧾" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('orderNo')}</th>
                  <th>{t('orderType')}</th>
                  <th>{t('table')}</th>
                  <th>{t('status')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="tag">{order.order_no}</span>
                    </td>
                    <td>{t(order.order_type)}</td>
                    <td>{order.restaurant_tables?.table_name || order.restaurant_tables?.table_no || '-'}</td>
                    <td>{order.status}</td>
                    <td>KD {Number(order.total_amount).toFixed(3)}</td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                        >
                          {t('preparing')}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => updateOrderStatus(order.id, 'served')}
                        >
                          {t('served')}
                        </button>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => updateOrderStatus(order.id, 'paid')}
                        >
                          {t('paid')}
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
    </div>
  );
}
