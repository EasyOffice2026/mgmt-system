import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { DownloadButtons, EmptyState, KpiCard, Spinner } from '../../layout/SharedComponents';

function currency(value) {
  return `KD ${Number(value || 0).toFixed(3)}`;
}

export default function Reports() {
  const { t } = useLang();
  const [daily, setDaily] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [salesData, inventoryData] = await Promise.all([
        supabase
          .from('order_items')
          .select('line_total, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('inventory_items')
          .select('item_name, current_stock, unit, reorder_level')
          .order('item_name', { ascending: true }),
      ]);

      const map = {};
      (salesData.data || []).forEach((row) => {
        const day = row.created_at?.slice(0, 10);
        if (!day) return;
        map[day] = (map[day] || 0) + Number(row.line_total || 0);
      });

      setDaily(
        Object.entries(map)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 14)
          .map(([day, revenue]) => ({ day, revenue }))
      );
      setInventory(inventoryData.data || []);
      setLoading(false);
    }

    load();
  }, []);

  const summary = useMemo(() => {
    const totalRevenue = daily.reduce((sum, row) => sum + row.revenue, 0);
    const avgRevenue = daily.length ? totalRevenue / daily.length : 0;
    const lowStock = inventory.filter((item) => Number(item.current_stock || 0) <= Number(item.reorder_level || 0)).length;

    return { totalRevenue, avgRevenue, lowStock };
  }, [daily, inventory]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('reports')}</div>
          <div className="page-subtitle">{t('restaurantPerformance')}</div>
        </div>
        <DownloadButtons
          title="Restaurant_Reports"
          columns={['Date', 'Revenue (KD)']}
          getRows={() => daily.map((row) => [row.day, row.revenue.toFixed(3)])}
        />
      </div>

      <div className="kpi-grid">
        <KpiCard label={t('totalSales')} value={currency(summary.totalRevenue)} icon="💰" color="green" />
        <KpiCard label={t('averageDailySales')} value={currency(summary.avgRevenue)} icon="📆" color="blue" />
        <KpiCard label={t('lowStockItems')} value={summary.lowStock} icon="⚠️" color="amber" />
      </div>

      <div className="card">
        <div className="card-title">{t('dailySales')}</div>
        {loading ? (
          <Spinner />
        ) : daily.length === 0 ? (
          <EmptyState icon="📉" message={t('noData')} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('salesAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((row) => (
                  <tr key={row.day}>
                    <td>{row.day}</td>
                    <td><strong>{currency(row.revenue)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">{t('inventoryHealth')}</div>
        {loading ? (
          <Spinner />
        ) : inventory.length === 0 ? (
          <EmptyState icon="📦" message={t('noData')} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('itemName')}</th>
                  <th>{t('currentStock')}</th>
                  <th>{t('reorderLevel')}</th>
                  <th>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => {
                  const low = Number(item.current_stock || 0) <= Number(item.reorder_level || 0);
                  return (
                    <tr key={item.item_name}>
                      <td><strong>{item.item_name}</strong></td>
                      <td>{item.current_stock} {item.unit}</td>
                      <td>{item.reorder_level} {item.unit}</td>
                      <td>
                        <span className={`badge ${low ? 'badge-danger' : 'badge-success'}`}>
                          {low ? t('lowStock') : t('inStock')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
