import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLang } from '../../../contexts/LangContext';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../utils/supabaseClient';
import { DownloadButtons, EmptyState, Modal, Spinner, StatusBadge } from '../../layout/SharedComponents';

const EMPTY_FORM = {
  item_name: '',
  category: 'Main Course',
  price: '',
  prep_time_minutes: '',
  is_vegetarian: false,
  is_available: true
};

const CATEGORIES = ['Main Course', 'Appetizer', 'Soup', 'Dessert', 'Beverage', 'Combo'];

export default function Menu() {
  const { t } = useLang();
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('item_name', { ascending: true });
    if (search.trim()) {
      query = query.or(`item_name.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`);
    }
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setItems(data || []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      item_name: item.item_name || '',
      category: item.category || 'Main Course',
      price: item.price ?? '',
      prep_time_minutes: item.prep_time_minutes ?? '',
      is_vegetarian: Boolean(item.is_vegetarian),
      is_available: Boolean(item.is_available)
    });
    setShowModal(true);
  }

  async function saveItem() {
    if (!form.item_name.trim() || !form.price) {
      toast.error(t('required'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        item_name: form.item_name.trim(),
        category: form.category,
        price: Number(form.price),
        prep_time_minutes: form.prep_time_minutes ? Number(form.prep_time_minutes) : null,
        is_vegetarian: form.is_vegetarian,
        is_available: form.is_available,
        updated_by: profile?.id || null
      };

      if (editItem) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert({ ...payload, created_by: profile?.id || null });
        if (error) throw error;
      }

      toast.success(editItem ? t('menuItemUpdated') : t('menuItemAdded'));
      setShowModal(false);
      setEditItem(null);
      setForm(EMPTY_FORM);
      loadMenu();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item) {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available, updated_by: profile?.id || null })
      .eq('id', item.id);
    if (error) toast.error(error.message);
    else {
      toast.success(!item.is_available ? t('markedAvailable') : t('markedUnavailable'));
      loadMenu();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('menu')}</div>
          <div className="page-subtitle">{items.length} {t('menuItems').toLowerCase()}</div>
        </div>
        <div className="action-btns">
          <DownloadButtons
            title="Menu_Items"
            columns={[t('itemName'), t('category'), t('price'), t('prepTime'), t('vegetarian'), t('status')]}
            getRows={() => items.map((item) => [
              item.item_name,
              item.category,
              Number(item.price).toFixed(2),
              item.prep_time_minutes || '-',
              item.is_vegetarian ? t('yes') : t('no'),
              item.is_available ? t('available') : t('unavailable')
            ])}
          />
          <button className="btn btn-primary" onClick={openCreate}>+ {t('addMenuItem')}</button>
        </div>
      </div>

      <div className="search-bar">
        <input
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      <div className="card">
        {loading ? <Spinner /> : items.length === 0 ? <EmptyState icon="📖" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('itemName')}</th>
                  <th>{t('category')}</th>
                  <th>{t('price')}</th>
                  <th>{t('prepTime')}</th>
                  <th>{t('vegetarian')}</th>
                  <th>{t('status')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.item_name}</strong></td>
                    <td><span className="pill">{item.category}</span></td>
                    <td><strong>{Number(item.price).toFixed(2)} KD</strong></td>
                    <td>{item.prep_time_minutes ? `${item.prep_time_minutes} min` : '-'}</td>
                    <td>{item.is_vegetarian ? '🥗' : '🍖'}</td>
                    <td><StatusBadge status={item.is_available ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(item)}>✏️ {t('edit')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => toggleAvailability(item)}>
                          {item.is_available ? t('markUnavailable') : t('markAvailable')}
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

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? t('editMenuItem') : t('addMenuItem')}
        footer={(
          <>
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={saveItem} disabled={saving}>{saving ? '...' : t('save')}</button>
          </>
        )}
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('itemName')} *</label>
            <input value={form.item_name} onChange={(e) => updateField('item_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('category')}</label>
            <select value={form.category} onChange={(e) => updateField('category', e.target.value)}>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('price')} *</label>
            <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => updateField('price', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('prepTime')}</label>
            <input type="number" min="0" value={form.prep_time_minutes} onChange={(e) => updateField('prep_time_minutes', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('vegetarian')}</label>
            <select value={String(form.is_vegetarian)} onChange={(e) => updateField('is_vegetarian', e.target.value === 'true')}>
              <option value="false">{t('no')}</option>
              <option value="true">{t('yes')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="field-label">{t('status')}</label>
            <select value={String(form.is_available)} onChange={(e) => updateField('is_available', e.target.value === 'true')}>
              <option value="true">{t('available')}</option>
              <option value="false">{t('unavailable')}</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
