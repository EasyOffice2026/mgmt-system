import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabaseClient';
import { useLang } from '../../contexts/LangContext';

export default function Settings() {
  const { t } = useLang();
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [vat, setVat] = useState('10');
  const [serviceCharge, setServiceCharge] = useState('0');

  async function load() {
    const { data } = await supabase
      .from('menu_categories')
      .select('*')
      .order('name', { ascending: true });
    setCategories(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCategory() {
    if (!newName.trim()) return;
    const { error } = await supabase
      .from('menu_categories')
      .insert({ name: newName.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewName('');
    toast.success(t('categoryAdded'));
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('settings')}</div>
          <div className="page-subtitle">{t('restaurantConfig')}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📂 {t('menuCategories')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {categories.map((category) => (
            <span key={category.id} className="pill">
              {category.name}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t('newCategory')}
            style={{ width: 220 }}
          />
          <button className="btn btn-primary btn-sm" onClick={addCategory}>
            + {t('add')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">🧮 {t('billingDefaults')}</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">{t('vatPercent')}</label>
            <input type="number" value={vat} onChange={(event) => setVat(event.target.value)} />
          </div>
          <div className="form-group">
            <label className="field-label">{t('serviceChargePercent')}</label>
            <input
              type="number"
              value={serviceCharge}
              onChange={(event) => setServiceCharge(event.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
