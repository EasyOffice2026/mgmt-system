import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { FileAttachment } from '@/components/shared/FileAttachment';
import { DataExport } from '@/components/shared/DataExport';
import { Plus, Search, Pencil, Trash2, Package, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Purchase {
  id: string; purchase_date: string; supplier_name: string; invoice_no: string;
  shop_location: string; category: string; item_name: string; model_type: string;
  purchase_price: number; quantity: number; quantity_available: number; payment_mode: string; status: string; attachments: string[]; created_at: string;
}

const defaultCategories = ['Mobile', 'Car', 'Furniture', 'Electronics', 'Jewelry', 'Other'];
const paymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

const defaultForm = {
  purchase_date: format(new Date(), 'yyyy-MM-dd'),
  supplier_name: '', invoice_no: '', shop_location: '', category: '',
  item_name: '', model_type: '', purchase_price: 0, quantity: 1, quantity_available: 1,
  payment_mode: 'cash', status: 'in_stock', attachments: [] as string[],
};

export default function PurchasePage() {
  const { t } = useLang();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  useEffect(() => { loadPurchases(); loadSuppliers(); }, [fromDate, toDate]);

  async function loadPurchases() {
    setLoading(true);
    let query = supabase.from('purchases').select('*').order('created_at', { ascending: false });
    if (fromDate) query = query.gte('purchase_date', fromDate);
    if (toDate) query = query.lte('purchase_date', toDate);
    const { data } = await query;
    setPurchases(data || []);
    const cats = new Set(defaultCategories);
    (data || []).forEach((p: any) => { if (p.category) cats.add(p.category); });
    setCategories([...cats]);
    setLoading(false);
  }

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('name').order('name');
    if (data) {
      const dbSuppliers = data.map((d: any) => d.name);
      // Also include suppliers from existing purchases that may not be in the table yet
      const allSups = new Set(dbSuppliers);
      purchases.forEach((p: any) => { if (p.supplier_name) allSups.add(p.supplier_name); });
      setSupplierNames([...allSups]);
    }
  }

  function addNewCategory() {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setForm({ ...form, category: newCategory.trim() });
    }
    setNewCategory(''); setShowNewCategory(false);
  }

  async function addNewSupplier() {
    const name = newSupplier.trim();
    if (!name) return;
    if (supplierNames.includes(name)) { setForm({ ...form, supplier_name: name }); setNewSupplier(''); setShowNewSupplier(false); return; }
    await supabase.from('suppliers').upsert({ name }, { onConflict: 'name' });
    setSupplierNames([...supplierNames, name]);
    setForm({ ...form, supplier_name: name });
    setNewSupplier(''); setShowNewSupplier(false);
  }

  async function handleSave() {
    if (!form.supplier_name || !form.supplier_name.trim()) {
      alert(t('supplierNameRequired') || 'Supplier name is required');
      return;
    }
    if (editing) {
      await supabase.from('purchases').update(form).eq('id', editing.id);
    } else {
      await supabase.from('purchases').insert(form);
    }
    setShowDialog(false); setForm(defaultForm); setEditing(null); loadPurchases();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('purchases').delete().eq('id', id);
    loadPurchases();
  }

  function openEdit(p: Purchase) {
    setEditing(p);
    setForm({
      purchase_date: p.purchase_date, supplier_name: p.supplier_name, invoice_no: p.invoice_no,
      shop_location: p.shop_location, category: p.category, item_name: p.item_name,
      model_type: p.model_type, purchase_price: p.purchase_price,
      quantity: p.quantity || 1, quantity_available: p.quantity_available ?? p.quantity ?? 1,
      payment_mode: p.payment_mode, status: p.status, attachments: p.attachments || [],
    });
    setShowDialog(true);
  }

  const filtered = purchases.filter(p =>
    p.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.invoice_no?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPurchaseAmount = filtered.reduce((s, p) => s + (p.purchase_price || 0) * (p.quantity || 1), 0);

  const exportHeaders = [t('purchaseDate'), t('supplierName'), t('invoiceNo'), t('category'), t('itemName'), t('modelType'), t('purchasePrice'), t('quantity'), t('totalAmount'), t('paymentMode')];
  const exportRows = filtered.map(p => [p.purchase_date, p.supplier_name, p.invoice_no, p.category, p.item_name, p.model_type, p.purchase_price, p.quantity || 1, (p.purchase_price || 0) * (p.quantity || 1), p.payment_mode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('purchase')}</h1>
          <p className="text-slate-500 text-sm">{filtered.length} items</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('purchase')} headers={exportHeaders} rows={exportRows} filename="purchases" />
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addPurchase')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
        </div>
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
              <Package className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('purchaseDate')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('supplierName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('invoiceNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('category')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('itemName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('purchasePrice')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('quantity')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('totalAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('available')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('status')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4">{p.purchase_date}</td>
                      <td className="py-3 px-4 font-medium">{p.supplier_name}</td>
                      <td className="py-3 px-4">{p.invoice_no}</td>
                      <td className="py-3 px-4">{p.category}</td>
                      <td className="py-3 px-4">{p.item_name} {p.model_type}</td>
                      <td className="py-3 px-4">{p.purchase_price?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">{p.quantity || 1}</td>
                      <td className="py-3 px-4 font-semibold text-blue-600">{((p.purchase_price || 0) * (p.quantity || 1)).toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">{p.quantity_available ?? p.quantity ?? 1}</td>
                      <td className="py-3 px-4">
                        <Badge className={p.status === 'in_stock' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'} variant="secondary">
                          {p.status === 'in_stock' ? t('inStock') : t('sold')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                    <td colSpan={5} className="py-3 px-4 text-end">{t('totalPurchaseAmount')}:</td>
                    <td colSpan={2} />
                    <td className="py-3 px-4 text-blue-700 text-base">{totalPurchaseAmount.toLocaleString()} {t('kd')}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('editPurchase') : t('addPurchase')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('purchaseDate')}</Label>
                <Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div>
                <Label>{t('supplierName')} *</Label>
                <div className="flex gap-2">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })}>
                    <option value="">Select or type</option>
                    {supplierNames.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowNewSupplier(true)}><Plus className="h-3 w-3" /></Button>
                </div>
                {showNewSupplier && (
                  <div className="flex gap-2 mt-2">
                    <Input placeholder={t('newSupplierName')} value={newSupplier} onChange={e => setNewSupplier(e.target.value)} className="h-8 text-sm" />
                    <Button size="sm" onClick={addNewSupplier} className="h-8">{t('add')}</Button>
                  </div>
                )}
              </div>
              <div>
                <Label>{t('invoiceNo')}</Label>
                <Input value={form.invoice_no} onChange={e => setForm({ ...form, invoice_no: e.target.value })} />
              </div>
              <div>
                <Label>{t('shopLocation')}</Label>
                <Input value={form.shop_location} onChange={e => setForm({ ...form, shop_location: e.target.value })} />
              </div>
              <div>
                <Label>{t('category')}</Label>
                <div className="flex gap-2">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="">Select</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowNewCategory(true)}><Plus className="h-3 w-3" /></Button>
                </div>
                {showNewCategory && (
                  <div className="flex gap-2 mt-2">
                    <Input placeholder={t('newCategory')} value={newCategory} onChange={e => setNewCategory(e.target.value)} className="h-8 text-sm" />
                    <Button size="sm" onClick={addNewCategory} className="h-8">{t('add')}</Button>
                  </div>
                )}
              </div>
              <div>
                <Label>{t('itemName')} *</Label>
                <Input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
              </div>
              <div>
                <Label>{t('modelType')}</Label>
                <Input value={form.model_type} onChange={e => setForm({ ...form, model_type: e.target.value })} />
              </div>
              <div>
                <Label>{t('purchasePrice')} *</Label>
                <Input type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('quantity')} *</Label>
                <Input type="number" min={1} value={form.quantity} onChange={e => {
                  const qty = Math.max(1, Number(e.target.value));
                  setForm({ ...form, quantity: qty, quantity_available: editing ? form.quantity_available : qty });
                }} />
              </div>
              <div>
                <Label>{t('paymentMode')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                  {paymentModes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <FileAttachment bucket="purchases" folder={editing?.id || 'new'} files={form.attachments} onFilesChange={files => setForm({ ...form, attachments: files })} />
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
