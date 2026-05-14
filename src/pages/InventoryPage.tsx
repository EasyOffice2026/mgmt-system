import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { DataExport } from '@/components/shared/DataExport';
import { Search, Warehouse, Calendar } from 'lucide-react';

interface InventoryItem {
  id: string; item_name: string; model_type: string; category: string;
  purchase_price: number; quantity: number; quantity_available: number;
  supplier_name: string; purchase_date: string; status: string;
}

export default function InventoryPage() {
  const { t } = useLang();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadInventory(); }, [fromDate, toDate]);

  async function loadInventory() {
    setLoading(true);
    let query = supabase.from('purchases').select('*').order('created_at', { ascending: false });
    if (fromDate) query = query.gte('purchase_date', fromDate);
    if (toDate) query = query.lte('purchase_date', toDate);
    const { data } = await query;
    setItems(data || []);
    setLoading(false);
  }

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  const filtered = items.filter(i => {
    const matchSearch = i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.category?.toLowerCase().includes(search.toLowerCase()) ||
      i.supplier_name?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || i.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const totalQty = filtered.reduce((s, i) => s + (i.quantity || 1), 0);
  const totalAvailable = filtered.reduce((s, i) => s + (i.quantity_available ?? i.quantity ?? 1), 0);
  const totalSold = totalQty - totalAvailable;

  const exportHeaders = [t('itemName'), t('modelType'), t('category'), t('purchasePrice'), t('quantity'), t('available'), t('supplierName'), t('purchaseDate'), t('status')];
  const exportRows = filtered.map(i => [i.item_name, i.model_type, i.category, i.purchase_price, i.quantity || 1, i.quantity_available ?? i.quantity ?? 1, i.supplier_name, i.purchase_date, i.status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('inventory')}</h1>
          <p className="text-slate-500 text-sm">{totalAvailable} {t('inStock')} &middot; {totalSold} {t('sold')}</p>
        </div>
        <DataExport title={t('inventory')} headers={exportHeaders} rows={exportRows} filename="inventory" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">{t('totalQuantity')}</p><p className="text-2xl font-bold">{totalQty}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">{t('available')}</p><p className="text-2xl font-bold text-green-600">{totalAvailable}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">{t('sold')}</p><p className="text-2xl font-bold text-slate-500">{totalSold}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-40" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">{t('allCategories')}</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 h-9" />
          <span className="text-slate-400">-</span>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 h-9" />
        </div>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Warehouse className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('itemName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('modelType')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('category')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('purchasePrice')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('quantity')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('available')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('supplierName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('purchaseDate')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium">{item.item_name}</td>
                      <td className="py-3 px-4">{item.model_type}</td>
                      <td className="py-3 px-4">{item.category}</td>
                      <td className="py-3 px-4">{item.purchase_price?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">{item.quantity || 1}</td>
                      <td className="py-3 px-4">{item.quantity_available ?? item.quantity ?? 1}</td>
                      <td className="py-3 px-4">{item.supplier_name}</td>
                      <td className="py-3 px-4">{item.purchase_date}</td>
                      <td className="py-3 px-4">
                        <Badge className={item.status === 'in_stock' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'} variant="secondary">
                          {item.status === 'in_stock' ? t('inStock') : t('sold')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
