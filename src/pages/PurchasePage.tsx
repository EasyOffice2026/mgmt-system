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
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import { format } from 'date-fns';

interface Purchase {
  id: string;
  purchase_date: string;
  supplier_name: string;
  invoice_no: string;
  shop_location: string;
  category: string;
  item_name: string;
  model_type: string;
  purchase_price: number;
  payment_mode: string;
  status: string;
  attachments: string[];
  created_at: string;
}

const defaultForm = {
  purchase_date: format(new Date(), 'yyyy-MM-dd'),
  supplier_name: '', invoice_no: '', shop_location: '', category: '',
  item_name: '', model_type: '', purchase_price: 0, payment_mode: 'cash',
  status: 'in_stock', attachments: [] as string[],
};

const categories = ['Mobile', 'Car', 'Furniture', 'Electronics', 'Jewelry', 'Other'];
const paymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

export default function PurchasePage() {
  const { t } = useLang();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPurchases(); }, []);

  async function loadPurchases() {
    setLoading(true);
    const { data } = await supabase.from('purchases').select('*').order('created_at', { ascending: false });
    setPurchases(data || []);
    setLoading(false);
  }

  async function handleSave() {
    if (editing) {
      await supabase.from('purchases').update(form).eq('id', editing.id);
    } else {
      await supabase.from('purchases').insert(form);
    }
    setShowDialog(false);
    setForm(defaultForm);
    setEditing(null);
    loadPurchases();
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
      model_type: p.model_type, purchase_price: p.purchase_price, payment_mode: p.payment_mode,
      status: p.status, attachments: p.attachments || [],
    });
    setShowDialog(true);
  }

  const filtered = purchases.filter(p =>
    p.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.invoice_no?.toLowerCase().includes(search.toLowerCase())
  );

  const exportHeaders = [t('purchaseDate'), t('supplierName'), t('invoiceNo'), t('category'), t('itemName'), t('modelType'), t('purchasePrice'), t('paymentMode')];
  const exportRows = filtered.map(p => [p.purchase_date, p.supplier_name, p.invoice_no, p.category, p.item_name, p.model_type, p.purchase_price, p.payment_mode]);

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

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Package className="h-12 w-12 mx-auto mb-3" />
              <p className="text-lg font-medium">{t('noData')}</p>
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
                <Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} />
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
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">Select</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
