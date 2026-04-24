// src/components/modules/Dashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useLang } from '../../contexts/LangContext';
import { KpiCard, DownloadButtons, EmptyState, Spinner, StatusBadge } from '../layout/SharedComponents';

export default function Dashboard() {
  const { t } = useLang();
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      const [ordersRes, tablesRes, reservationsRes, staffRes] = await Promise.all([
        supabase.from('orders').select('id, status, total_amount, ordered_at').order('ordered_at', { ascending: false }).limit(200),
        supabase.from('restaurant_tables').select('id, status'),
        supabase.from('reservations').select('id, status, reservation_time').order('reservation_time', { ascending: false }).limit(100),
        supabase.from('staff_members').select('id, status')
      ]);
      setOrders(ordersRes.data || []);
      setTables(tablesRes.data || []);
      setReservations(reservationsRes.data || []);
      setStaff(staffRes.data || []);
      setLoading(false);
    }
    loadDashboard();
  }, []);

  const metrics = useMemo(() => {
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'completed');
    const today = new Date().toISOString().slice(0, 10);
    return {
      dailySales: paidOrders
        .filter(o => (o.ordered_at || '').slice(0, 10) === today)
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      totalSales: paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      activeOrders: orders.filter(o => ['placed', 'preparing', 'ready', 'served'].includes(o.status)).length,
      occupiedTables: tables.filter(t => t.status === 'occupied').length,
      pendingReservations: reservations.filter(r => r.status === 'booked').length,
      activeStaff: staff.filter(s => s.status === 'active').length
    };
  }, [orders, reservations, staff, tables]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('dashboard')}</div>
          <div className="page-subtitle">{t('restaurantPerformance')}</div>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label={t('dailySales')} value={`KD ${metrics.dailySales.toFixed(3)}`} icon="💵" color="green" />
        <KpiCard label={t('totalSales')} value={`KD ${metrics.totalSales.toFixed(3)}`} icon="💰" color="blue" />
        <KpiCard label={t('activeOrders')} value={metrics.activeOrders} icon="🧾" color="amber" />
        <KpiCard label={t('occupiedTables')} value={metrics.occupiedTables} icon="🪑" color="purple" />
        <KpiCard label={t('pendingReservations')} value={metrics.pendingReservations} icon="📅" color="teal" />
        <KpiCard label={t('activeStaff')} value={metrics.activeStaff} icon="👨‍🍳" color="red" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>{t('recentOrders')}</div>
            <DownloadButtons
              title="Recent_Orders"
              columns={[t('orderNo'), t('status'), t('amount'), t('date')]}
              getRows={() => orders.slice(0, 15).map(o => [o.order_no, o.status, Number(o.total_amount || 0).toFixed(3), o.ordered_at])}
            />
          </div>
          {loading ? <Spinner /> : orders.length === 0 ? <EmptyState icon="🧾" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('orderNo')}</th>
                    <th>{t('status')}</th>
                    <th>{t('amount')}</th>
                    <th>{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 8).map(order => (
                    <tr key={order.id}>
                      <td><span className="tag">{order.order_no}</span></td>
                      <td><StatusBadge status={order.status} /></td>
                      <td>KD {Number(order.total_amount || 0).toFixed(3)}</td>
                      <td>{order.ordered_at ? new Date(order.ordered_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">{t('upcomingReservations')}</div>
          {loading ? <Spinner /> : reservations.length === 0 ? <EmptyState icon="📅" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('reservationTime')}</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.slice(0, 8).map(item => (
                    <tr key={item.id}>
                      <td>{item.reservation_time ? new Date(item.reservation_time).toLocaleString() : '—'}</td>
                      <td><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
