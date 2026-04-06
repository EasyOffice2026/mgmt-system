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
import { Plus, Search, Pencil, Trash2, ShoppingCart, Calendar, X } from 'lucide-react';
import { format, addMonths } from 'date-fns';

interface Contract {
  id: string; contract_no: string; customer_id: string; customer_name: string;
  items: any[]; category: string; item_name: string; model_type: string;
  purchase_price: number; sale_price: number; file_opening_charges: number;
  client_type: string; duration_months: number; start_date: string;
  first_installment_date: string; last_installment_date: string;
  installment_amount: number; paid_amount: number; remaining_amount: number;
  payment_mode: string; status: string; installment_schedule: any[];
  attachments: string[]; created_at: string; end_date: string;
}

interface Customer { id: string; customer_no: string; name: string; }
interface Purchase { id: string; item_name: string; model_type: string; category: string; purchase_price: number; status: string; }

interface ContractItem { purchase_id: string; item_name: string; model_type: string; category: string; purchase_price: number; sale_price: number; }

const emptyItem: ContractItem = { purchase_id: '', item_name: '', model_type: '', category: '', purchase_price: 0, sale_price: 0 };

const defaultForm = {
  customer_id: '', items: [{ ...emptyItem }] as ContractItem[],
  file_opening_charges: 0, client_type: 'new', duration_months: 12,
  start_date: format(new Date(), 'yyyy-MM-dd'),
  first_installment_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
  payment_mode: 'cash', status: 'ongoing', attachments: [] as string[],
};

const paymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

export default function SalesPage() {
  const { t } = useLang();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showSchedule, setShowSchedule] = useState<Contract | null>(null);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    let contQuery = supabase.from('contracts').select('*').order('created_at', { ascending: false });
    if (fromDate) contQuery = contQuery.gte('start_date', fromDate);
    if (toDate) contQuery = contQuery.lte('start_date', toDate);
    const [contRes, custRes, purRes] = await Promise.all([
      contQuery,
      supabase.from('customers').select('id, customer_no, name'),
      supabase.from('purchases').select('id, item_name, model_type, category, purchase_price, status').eq('status', 'in_stock'),
    ]);
    setContracts(contRes.data || []);
    setCustomers(custRes.data || []);
    setPurchases(purRes.data || []);
    setLoading(false);
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  }

  function removeItem(index: number) {
    if (form.items.length <= 1) return;
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  }

  function updateItem(index: number, field: string, value: any) {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'purchase_id') {
      const purchase = purchases.find(p => p.id === value);
      if (purchase) {
        newItems[index] = { ...newItems[index], item_name: purchase.item_name, model_type: purchase.model_type, category: purchase.category, purchase_price: purchase.purchase_price };
      }
    }
    setForm({ ...form, items: newItems });
  }

  function getTotalSalePrice() {
    return form.items.reduce((sum, item) => sum + (item.sale_price || 0), 0);
  }

  function calculateInstallment() {
    const totalFinanced = getTotalSalePrice() - form.file_opening_charges;
    return form.duration_months > 0 ? totalFinanced / form.duration_months : 0;
  }

  function generateSchedule() {
    const schedule = [];
    const instAmount = calculateInstallment();
    const startDate = new Date(form.first_installment_date);
    for (let i = 0; i < form.duration_months; i++) {
      const dueDate = addMonths(startDate, i);
      schedule.push({ month: i + 1, due_date: format(dueDate, 'yyyy-MM-dd'), amount: Math.round(instAmount * 1000) / 1000, status: 'pending' });
    }
    return schedule;
  }

  async function handleSave() {
    const customer = customers.find(c => c.id === form.customer_id);
    const totalSalePrice = getTotalSalePrice();
    const instAmount = calculateInstallment();
    const schedule = generateSchedule();
    const lastDate = schedule.length > 0 ? schedule[schedule.length - 1].due_date : form.start_date;
    const data = {
      customer_id: form.customer_id, customer_name: customer?.name || '',
      items: form.items,
      item_name: form.items.map(i => i.item_name).join(', '),
      category: form.items.map(i => i.category).join(', '),
      model_type: form.items.map(i => i.model_type).join(', '),
      purchase_price: form.items.reduce((s, i) => s + (i.purchase_price || 0), 0),
      sale_price: totalSalePrice,
      file_opening_charges: form.file_opening_charges,
      client_type: form.client_type, duration_months: form.duration_months,
      start_date: form.start_date, first_installment_date: form.first_installment_date,
      last_installment_date: lastDate, end_date: lastDate,
      installment_amount: Math.round(instAmount * 1000) / 1000,
      paid_amount: 0, remaining_amount: totalSalePrice,
      payment_mode: form.payment_mode, status: form.status,
      installment_schedule: schedule, attachments: form.attachments,
    };
    if (editing) {
      data.paid_amount = editing.paid_amount;
      data.remaining_amount = totalSalePrice - editing.paid_amount;
      await supabase.from('contracts').update(data).eq('id', editing.id);
    } else {
      await supabase.from('contracts').insert(data);
      // Mark items as sold
      for (const item of form.items) {
        if (item.purchase_id) {
          await supabase.from('purchases').update({ status: 'sold' }).eq('id', item.purchase_id);
        }
      }
    }
    setShowDialog(false); setForm(defaultForm); setEditing(null); loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('contracts').delete().eq('id', id);
    loadData();
  }

  function openEdit(c: Contract) {
    setEditing(c);
    setForm({
      customer_id: c.customer_id,
      items: c.items && c.items.length > 0 ? c.items : [{ purchase_id: '', item_name: c.item_name || '', model_type: c.model_type || '', category: c.category || '', purchase_price: c.purchase_price || 0, sale_price: c.sale_price || 0 }],
      file_opening_charges: c.file_opening_charges, client_type: c.client_type,
      duration_months: c.duration_months, start_date: c.start_date,
      first_installment_date: c.first_installment_date, payment_mode: c.payment_mode,
      status: c.status, attachments: c.attachments || [],
    });
    setShowDialog(true);
  }

  const filtered = contracts.filter(c =>
    c.contract_no?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.item_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) => {
    if (s === 'ongoing') return 'bg-blue-100 text-blue-700';
    if (s === 'finished') return 'bg-green-100 text-green-700';
    return 'bg-red-100 text-red-700';
  };

  const exportHeaders = [t('contractNo'), t('customerName'), t('itemName'), t('salePrice'), t('paidAmount'), t('remainingAmount'), t('status')];
  const exportRows = filtered.map(c => [c.contract_no, c.customer_name, c.item_name, c.sale_price, c.paid_amount, c.remaining_amount, c.status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('sales')}</h1>
          <p className="text-slate-500 text-sm">{filtered.length} {t('contracts').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('sales')} headers={exportHeaders} rows={exportRows} filename="contracts" />
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addContract')}
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
              <ShoppingCart className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('contractNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('itemName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('salePrice')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('paidAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('remainingAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('status')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-blue-600 cursor-pointer" onClick={() => setShowSchedule(c)}>{c.contract_no}</td>
                      <td className="py-3 px-4">{c.customer_name}</td>
                      <td className="py-3 px-4">{c.item_name}</td>
                      <td className="py-3 px-4">{c.sale_price?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-green-600">{c.paid_amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-red-600">{c.remaining_amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4"><Badge className={statusColor(c.status)} variant="secondary">{t(c.status as any)}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

      {/* Installment Schedule Modal */}
      <Dialog open={!!showSchedule} onOpenChange={() => setShowSchedule(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showSchedule?.contract_no} - {t('installmentSchedule')}</DialogTitle>
          </DialogHeader>
          {showSchedule && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                <div><span className="text-slate-500">{t('customerName')}:</span><p className="font-medium">{showSchedule.customer_name}</p></div>
                <div><span className="text-slate-500">{t('salePrice')}:</span><p className="font-medium">{showSchedule.sale_price?.toLocaleString()} {t('kd')}</p></div>
                <div><span className="text-slate-500">{t('paidAmount')}:</span><p className="font-medium text-green-600">{showSchedule.paid_amount?.toLocaleString()} {t('kd')}</p></div>
                <div><span className="text-slate-500">{t('remainingAmount')}:</span><p className="font-medium text-red-600">{showSchedule.remaining_amount?.toLocaleString()} {t('kd')}</p></div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-start py-2 px-3">#</th>
                    <th className="text-start py-2 px-3">{t('dueDate')}</th>
                    <th className="text-start py-2 px-3">{t('amount')}</th>
                    <th className="text-start py-2 px-3">{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(showSchedule.installment_schedule || []).map((inst: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 px-3">{inst.month || i + 1}</td>
                      <td className="py-2 px-3">{inst.due_date}</td>
                      <td className="py-2 px-3">{inst.amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-2 px-3">
                        <Badge className={inst.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} variant="secondary">
                          {inst.status === 'paid' ? t('paid') : t('pending')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Contract Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('editContract') : t('addContract')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('customer')} *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customer_no} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('clientType')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.client_type} onChange={e => setForm({ ...form, client_type: e.target.value })}>
                  <option value="new">{t('newClient')}</option>
                  <option value="existing">{t('existingClient')}</option>
                </select>
              </div>
            </div>

            {/* Multiple Items Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t('items')}</h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 me-1" /> {t('addItem')}</Button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="border rounded-md p-3 space-y-2 bg-slate-50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">Item #{idx + 1}</span>
                    {form.items.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)}><X className="h-3 w-3 text-red-500" /></Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">{t('selectProduct')}</Label>
                      <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={item.purchase_id} onChange={e => updateItem(idx, 'purchase_id', e.target.value)}>
                        <option value="">Select from inventory</option>
                        {purchases.map(p => <option key={p.id} value={p.id}>{p.item_name} - {p.model_type} ({p.category})</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('itemName')}</Label>
                      <Input className="h-9" value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('category')}</Label>
                      <Input className="h-9" value={item.category} onChange={e => updateItem(idx, 'category', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('modelType')}</Label>
                      <Input className="h-9" value={item.model_type} onChange={e => updateItem(idx, 'model_type', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('purchasePrice')}</Label>
                      <Input className="h-9" type="number" value={item.purchase_price} onChange={e => updateItem(idx, 'purchase_price', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('salePrice')} *</Label>
                      <Input className="h-9" type="number" value={item.sale_price} onChange={e => updateItem(idx, 'sale_price', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-right text-sm font-medium text-blue-700">
                {t('totalSalePrice')}: {getTotalSalePrice().toLocaleString()} {t('kd')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{t('fileOpeningCharges')}</Label>
                <Input type="number" value={form.file_opening_charges} onChange={e => setForm({ ...form, file_opening_charges: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('duration')} ({t('months')})</Label>
                <Input type="number" value={form.duration_months} onChange={e => setForm({ ...form, duration_months: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('startDate')}</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>{t('firstInstallmentDate')}</Label>
                <Input type="date" value={form.first_installment_date} onChange={e => setForm({ ...form, first_installment_date: e.target.value })} />
              </div>
              <div>
                <Label>{t('paymentMode')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                  {paymentModes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('status')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="ongoing">{t('ongoing')}</option>
                  <option value="finished">{t('finished')}</option>
                  <option value="legal_case">{t('legalCase')}</option>
                </select>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900">{t('installmentSummary')}</h4>
              <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                <div><p className="text-blue-600">{t('totalFinanced')}</p><p className="font-bold">{(getTotalSalePrice() - form.file_opening_charges).toLocaleString()} {t('kd')}</p></div>
                <div><p className="text-blue-600">{t('installmentAmount')}</p><p className="font-bold">{calculateInstallment().toFixed(3)} {t('kd')}</p></div>
                <div><p className="text-blue-600">{t('totalInstallments')}</p><p className="font-bold">{form.duration_months}</p></div>
              </div>
            </div>

            <FileAttachment bucket="contracts" folder={editing?.id || 'new'} files={form.attachments} onFilesChange={files => setForm({ ...form, attachments: files })} />

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
