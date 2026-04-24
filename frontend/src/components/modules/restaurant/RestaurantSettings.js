import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { useLang } from '../../../contexts/LangContext';
import toast from 'react-hot-toast';

function useLookup(tableName) {
  const [items, setItems] = useState([]);

  async function load() {
    const { data, error } = await supabase.from(tableName).select('*').order('name');
    if (error) return;
    setItems(data || []);
  }

  async function addItem(name) {
    if (!name.trim()) return;
    const { error } = await supabase.from(tableName).insert({ name: name.trim() });
    if (error) throw error;
    await load();
  }

  async function toggleActive(item) {
    const { error } = await supabase.from(tableName).update({ is_active: !item.is_active }).eq('id', item.id);
    if (error) throw error;
    await load();
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, addItem, toggleActive };
}

function LookupCard({ title, placeholder, data, onAdd, onToggle }) {
  const [value, setValue] = useState('');

  async function handleAdd() {
    if (!value.trim()) return;
    await onAdd(value);
    setValue('');
  }

  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {data.map((item) => (
          <button
            key={item.id}
            className={`btn btn-xs ${item.is_active ? 'btn-outline' : 'btn-danger'}`}
            onClick={() => onToggle(item)}
          >
            {item.name} {item.is_active ? '✓' : '✕'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} style={{ width: 260 }} />
        <button className="btn btn-primary btn-sm" onClick={handleAdd}>+ Add</button>
      </div>
    </div>
  );
}

export default function RestaurantSettings() {
  const { t } = useLang();
  const courseTypes = useLookup('course_types');
  const tableZones = useLookup('table_zones');
  const paymentMethods = useLookup('payment_methods');

  async function safeRun(fn, successText) {
    try {
      await fn();
      toast.success(successText);
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('settings')}</div>
          <div className="page-subtitle">{t('restaurantSettingsSubtitle')}</div>
        </div>
      </div>

      <LookupCard
        title={t('courseTypes')}
        placeholder={t('newCourseType')}
        data={courseTypes.items}
        onAdd={(name) => safeRun(() => courseTypes.addItem(name), t('settingsSaved'))}
        onToggle={(item) => safeRun(() => courseTypes.toggleActive(item), t('settingsSaved'))}
      />
      <LookupCard
        title={t('tableZones')}
        placeholder={t('newTableZone')}
        data={tableZones.items}
        onAdd={(name) => safeRun(() => tableZones.addItem(name), t('settingsSaved'))}
        onToggle={(item) => safeRun(() => tableZones.toggleActive(item), t('settingsSaved'))}
      />
      <LookupCard
        title={t('paymentMethods')}
        placeholder={t('newPaymentMethod')}
        data={paymentMethods.items}
        onAdd={(name) => safeRun(() => paymentMethods.addItem(name), t('settingsSaved'))}
        onToggle={(item) => safeRun(() => paymentMethods.toggleActive(item), t('settingsSaved'))}
      />
    </div>
  );
}
