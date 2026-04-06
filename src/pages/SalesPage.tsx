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
import { Plus, Search, Pencil, Trash2, ShoppingCart, Calendar } from 'lucide-react';
import { format, addMonths } from 'date-fns';

interface Contract {
  id: string;
  contract_no: string;
  customer_id: string;
  customer_name: string;
  category: string;
  product_id: string;
  product_name: string;
  client_type: string;
  file_opening_charges: number;
  sale_price: number;
  purchase_price: number;
  duration_months: number;
  start_date: string;
  first_installment_date: string;
  last_installment_date: string;
  installment_value: number;
  paid_amount: number;
  remaining_amount: number;
  payment_mode: string;
  status: string;
  attachments: string[];
  installments: Installment[];
  created_at: string;
}

interface Installment {
  no: number;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_date?: string;
}

interface Customer { id: string; customer_no: string; name: string; civil_id: string; }
interface Product { id: string; item_name: string; model_type: string; purchase_price: number; category: string; status: string; }

const defaultForm = {
  customer_id: '', category: '', product_id: '', client_type: 'new',
  file_opening_charges: 0, sale_price: 0, purchase_price: 0, duration_months: 12,
  start_date: format(new Date(), 'yyyy-MM-dd'),
  first_installment_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
  payment_mode: 'cash', status: 'ongoing', attachments: [] as string[],
};

const categories = ['Mobile', 'Car', 'Furniture', 'Electronics', 'Jewelry', 'Other'];
const paymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

export default function SalesPage() {
  const { t } = useLang();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showSchedule, setShowSchedule] = useState<Contract | null>(null);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [contractsRes, custRes, prodRes] = await Promise.all([
      supabase.from('contracts').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, customer_no, name, civil_id'),
      supabase.from('purchases').select('id, item_name, model_type, purchase_price, category, status'),
    ]);
    setContracts(contractsRes.data || []);
    setCustomers(custRes.data || []);
    setProducts((prodRes.data || []).filter((p: Product) => p.status !== 'sold'));
    setLoading(false);
  }

  function calculateSchedule(): Installment[] {
    if (!form.duration_months || !form.sale_price) return [];
    const totalFinanced = form.sale_price - form.file_opening_charges;
    const instValue = Math.round((totalFinanced / form.duration_months) * 100) / 100;
    const schedule: Installment[] = [];
    for (let i = 0; i < form.duration_months; i++) {
      const dueDate = addMonths(new Date(form.first_installment_date), i);
      schedule.push({
        no: i + 1,
        due_date: format(dueDate, 'yyyy-MM-dd'),
        amount: i === form.duration_months - 1 ? totalFinanced - instValue * (form.duration_months - 1) : instValue,
        paid: false,
      });
    }
    return schedule;
  }

  async function handleSave() {
    const selectedCustomer = customers.find(c => c.id === form.customer_id);
    const selectedProduct = products.find(p => p.id === form.product_id);
    const installments = calculateSchedule();
    const lastDate = installments.length > 0 ? installments[installments.length - 1].due_date : form.first_installment_date;
    const instValue = installments.length > 0 ? installments[0].amount : 0;

    const data = {
      customer_id: form.customer_id,
      customer_name: selectedCustomer?.name || '',
      category: form.category || selectedProduct?.category || '',
      product_id: form.product_id || null,
      product_name: selectedProduct ? `${selectedProduct.item_name} ${selectedProduct.model_type}` : '',
      client_type: form.client_type,
      file_opening_charges: form.file_opening_charges,
      sale_price: form.sale_price,
      purchase_price: form.purchase_price || selectedProduct?.purchase_price || 0,
      duration_months: form.duration_months,
      start_date: form.start_date,
      first_installment_date: form.first_installment_date,
      last_installment_date: lastDate,
      installment_value: instValue,
      paid_amount: 0,
      remaining_amount: form.sale_price,
      payment_mode: form.payment_mode,
      status: form.status,
      attachments: form.attachments,
      installments,
    };

    if (editing) {
      await supabase.from('contracts').update(data).eq('id', editing.id);
    } else {
      await supabase.from('contracts').insert(data);
      if (form.product_id) {
        await supabase.from('purchases').update({ status: 'sold' }).eq('id', form.product_id);
      }
    }
    setShowDialog(false);
    setForm(defaultForm);
    setEditing(null);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('contracts').delete().eq('id', id);
    loadData();
  }

  async function toggleInstallmentPaid(contract: Contract, instNo: number) {
    const updatedInstallments = (contract.installments || []).map(inst =>
      inst.no === instNo ? { ...inst, paid: !inst.paid, paid_date: !inst.paid ? format(new Date(), 'yyyy-MM-dd') : undefined } : inst
    );
    const paidAmount = updatedInstallments.filter(i => i.paid).reduce((sum, i) => sum + i.amount, 0) + (contract.file_opening_charges || 0);
    const remainingAmount = contract.sale_price - paidAmount;
    await supabase.from('contracts').update({
      installments: updatedInstallments, paid_amount: paidAmount, remaining_amount: remainingAmount,
    }).eq('id', contract.id);
    loadData();
    if (showSchedule?.id === contract.id) {
      setShowSchedule({ ...contract, installments: updatedInstallments, paid_amount: paidAmount, remaining_amount: remainingAmount });
    }
  }

  function openEdit(c: Contract) {
    setEditing(c);
    setForm({
      customer_id: c.customer_id, category: c.category, product_id: c.product_id || '',
      client_type: c.client_type, file_opening_charges: c.file_opening_charges,
      sale_price: c.sale_price, purchase_price: c.purchase_price, duration_months: c.duration_months,
      start_date: c.start_date, first_installment_date: c.first_installment_date,
      payment_mode: c.payment_mode, status: c.status, attachments: c.attachments || [],
    });
    setShowDialog(true);
  }

  const filtered = contracts.filter(c =>
    c.contract_no?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const exportHeaders = [t('contractNo'), t('customerName'), t('category'), t('salePrice'), t('paidAmount'), t('remainingAmount'), t('status')];
  const exportRows = filtered.map(c => [c.contract_no, c.customer_name, c.category, c.sale_price, c.paid_amount, c.remaining_amount, c.status]);

  const statusColor = (s: string) => s === 'ongoing' ? 'bg-blue-100 text-blue-700' : s === 'finished' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('sales')}</h1>
          <p className="text-slate-500 text-sm">{filtered.length} {t('sales').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('sales')} headers={exportHeaders} rows={exportRows} filename="contracts" />
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addContract')}
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
              <ShoppingCart className="h-12 w-12 mx-auto mb-3" />
              <p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('contractNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('category')}</th>
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
                      <td className="py-3 px-4 font-medium text-blue-600">{c.contract_no}</td>
                      <td className="py-3 px-4">{c.customer_name}</td>
                      <td className="py-3 px-4">{c.category}</td>
                      <td className="py-3 px-4">{c.sale_price?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-green-600">{c.paid_amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-red-600">{c.remaining_amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4"><Badge className={statusColor(c.status)} variant="secondary">{c.status}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setShowSchedule(c)} title={t('installmentSchedule')}>
                            <Calendar className="h-4 w-4 text-indigo-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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
                  <option value="">{t('selectCustomer')}</option>
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
              <div>
                <Label>{t('product')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.product_id} onChange={e => {
                  const prod = products.find(p => p.id === e.target.value);
                  setForm({ ...form, product_id: e.target.value, category: prod?.category || form.category, purchase_price: prod?.purchase_price || form.purchase_price });
                }}>
                  <option value="">{t('selectProduct')}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.item_name} - {p.model_type} ({p.category})</option>)}
                </select>
              </div>
              <div>
                <Label>{t('category')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">Select</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('fileOpeningCharges')}</Label>
                <Input type="number" value={form.file_opening_charges} onChange={e => setForm({ ...form, file_opening_charges: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('salePrice')} *</Label>
                <Input type="number" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('duration')}</Label>
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
                  {paymentModes.map(m => <option key={m} value={m}>{t(m as keyof typeof t)}</option>)}
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

            {form.sale_price > 0 && form.duration_months > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">{t('installmentSchedule')} Preview</h4>
                <p className="text-sm text-blue-700">
                  {t('installmentValue')}: {((form.sale_price - form.file_opening_charges) / form.duration_months).toFixed(3)} {t('kd')} x {form.duration_months} months
                </p>
              </div>
            )}

            <FileAttachment bucket="contracts" folder={editing?.id || 'new'} files={form.attachments} onFilesChange={files => setForm({ ...form, attachments: files })} />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Installment Schedule Dialog */}
      <Dialog open={!!showSchedule} onOpenChange={() => setShowSchedule(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('installmentSchedule')} - {showSchedule?.contract_no}</DialogTitle>
          </DialogHeader>
          {showSchedule && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4">
                <div><span className="text-xs text-slate-500">{t('salePrice')}</span><p className="font-bold">{showSchedule.sale_price?.toLocaleString()} {t('kd')}</p></div>
                <div><span className="text-xs text-slate-500">{t('paidAmount')}</span><p className="font-bold text-green-600">{showSchedule.paid_amount?.toLocaleString()} {t('kd')}</p></div>
                <div><span className="text-xs text-slate-500">{t('remainingAmount')}</span><p className="font-bold text-red-600">{showSchedule.remaining_amount?.toLocaleString()} {t('kd')}</p></div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-start py-2 px-3">{t('installmentNo')}</th>
                    <th className="text-start py-2 px-3">{t('dueDate')}</th>
                    <th className="text-start py-2 px-3">{t('amount')}</th>
                    <th className="text-start py-2 px-3">{t('status')}</th>
                    <th className="text-start py-2 px-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(showSchedule.installments || []).map(inst => (
                    <tr key={inst.no} className={`border-b ${inst.paid ? 'bg-green-50' : ''}`}>
                      <td className="py-2 px-3">{inst.no}</td>
                      <td className="py-2 px-3">{inst.due_date}</td>
                      <td className="py-2 px-3">{inst.amount?.toFixed(3)} {t('kd')}</td>
                      <td className="py-2 px-3">
                        <Badge className={inst.paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'} variant="secondary">
                          {inst.paid ? t('paid') : t('unpaid')}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Button size="sm" variant={inst.paid ? 'outline' : 'default'} onClick={() => toggleInstallmentPaid(showSchedule, inst.no)}>
                          {inst.paid ? t('unpaid') : t('paid')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
