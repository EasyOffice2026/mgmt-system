import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import { Modal, DownloadButtons, EmptyState, Spinner, StatusBadge, KpiCard } from '../../layout/SharedComponents';

const EMPTY_FORM = {
  item_name: '',
  item_category: '',
  unit: 'pcs',
  current_stock: 0,
  reorder_level: 0,
  cost_per_unit: 0,
  supplier_name: ''
};

export default function InventoryControl() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('item_name', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const totalItems = items.length;
    const lowStock = items.filter(i => Number(i.current_stock) <= Number(i.reorder_level)).length;
    const totalStockValue = items.reduce((sum, i) => sum + (Number(i.current_stock) * Number(i.cost_per_unit)), 0);
    return { totalItems, lowStock, totalStockValue };
  }, [items]);

  function f(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.item_name.trim()) {
      toast.error(t('required'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        current_stock: Number(form.current_stock) || 0,
        reorder_level: Number(form.reorder_level) || 0,
        cost_per_unit: Number(form.cost_per_unit) || 0
      };
      const { error } = await supabase.from('inventory_items').insert(payload);
      if (error) throw error;
      toast.success(t('inventoryItemSaved'));
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock(item, delta) {
    const nextStock = Math.max(0, Number(item.current_stock) + delta);
    const { error } = await supabase
      .from('inventory_items')
      .update({ current_stock: nextStock })
      .eq('id', item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('inventory')}</div>
          <div className="page-subtitle">{items.length} {t('inventoryItems').toLowerCase()}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons
            title="Inventory"
            columns={[t('itemName'), t('category'), t('stock'), t('unit'), t('costPerUnit'), t('supplierName')]}
            getRows={() => items.map(i => [i.item_name, i.item_category, i.current_stock, i.unit, i.cost_per_unit, i.supplier_name || '—'])}
          />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ {t('addInventoryItem')}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label={t('inventoryItems')} value={kpis.totalItems} icon="📦" color="blue" />
        <KpiCard label={t('lowStockItems')} value={kpis.lowStock} icon="⚠️" color="amber" />
        <KpiCard label={t('inventoryValue')} value={`KD ${kpis.totalStockValue.toFixed(3)}`} icon="💰" color="green" />
      </div>

      <div className="card">
        {loading ? <Spinner /> : items.length === 0 ? <EmptyState icon="📦" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('itemName')}</th>
                  <th>{t('category')}</th>
                  <th>{t('stock')}</th>
                  <th>{t('reorderLevel')}</th>
                  <th>{t('unit')}</th>
                  <th>{t('costPerUnit')}</th>
                  <th>{t('supplierName')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const low = Number(item.current_stock) <= Number(item.reorder_level);
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.item_name}</strong></td>
                      <td>{item.item_category || '—'}</td>
                      <td>{item.current_stock}</td>
                      <td>{item.reorder_level}</td>
                      <td>{item.unit}</td>
                      <td>KD {Number(item.cost_per_unit).toFixed(3)}</td>
                      <td>{item.supplier_name || '—'}</td>
                      <td><StatusBadge status={low ? 'pending' : 'active'} /></td>
                      <td>
                        <div className="action-btns">
                          <button className="btn btn-outline btn-sm" onClick={() => adjustStock(item, 1)}>+1</button>
                          <button className="btn btn-outline btn-sm" onClick={() => adjustStock(item, -1)}>-1</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={`📦 ${t('addInventoryItem')}`}
        footer={(
          <>
            <button className="btn btn-outline" onClick={() => setShowAdd(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '...' : t('save')}</button>
          </>
        )}
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('itemName')}</label>
            <input value={form.item_name} onChange={e => f('item_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('category')}</label>
            <input value={form.item_category} onChange={e => f('item_category', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('stock')}</label>
            <input type="number" value={form.current_stock} onChange={e => f('current_stock', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('reorderLevel')}</label>
            <input type="number" value={form.reorder_level} onChange={e => f('reorder_level', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('unit')}</label>
            <input value={form.unit} onChange={e => f('unit', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('costPerUnit')}</label>
            <input type="number" step="0.001" value={form.cost_per_unit} onChange={e => f('cost_per_unit', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('supplierName')}</label>
            <input value={form.supplier_name} onChange={e => f('supplier_name', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
