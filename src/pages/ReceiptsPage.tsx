import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { FileAttachment } from '@/components/shared/FileAttachment';
import { DataExport } from '@/components/shared/DataExport';
import { Plus, Search, Pencil, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface ReceiptVoucher {
  id: string;
  receipt_voucher_no: string;
  receipt_date: string;
  receipt_type: string;
  customer_id: string;
  customer_name: string;
  contract_id: string;
  contract_no: string;
  court_case_no: string;
  received_amount: number;
  payment_mode: string;
  notes: string;
  attachments: string[];
  created_at: string;
}

interface Customer { id: string; customer_no: string; name: string; }
interface Contract { id: string; contract_no: string; customer_name: string; customer_id: string; }

const defaultForm = {
  receipt_date: format(new Date(), 'yyyy-MM-dd'),
  receipt_type: 'installment', customer_id: '', contract_id: '',
  court_case_no: '', received_amount: 0, payment_mode: 'cash',
  notes: '', attachments: [] as string[],
};

const receiptTypes = ['fileOpening', 'installment', 'courtMoney'];
const paymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

export default function ReceiptsPage() {
  const { t } = useLang();
  const [receipts, setReceipts] = useState<ReceiptVoucher[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<ReceiptVoucher | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [recRes, custRes, contRes] = await Promise.all([
      supabase.from('receipt_vouchers').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, customer_no, name'),
      supabase.from('contracts').select('id, contract_no, customer_name, customer_id'),
    ]);
    setReceipts(recRes.data || []);
    setCustomers(custRes.data || []);
    setContracts(contRes.data || []);
    setLoading(false);
  }

  async function handleSave() {
    const customer = customers.find(c => c.id === form.customer_id);
    const contract = contracts.find(c => c.id === form.contract_id);
    const data = {
      receipt_date: form.receipt_date,
      receipt_type: form.receipt_type,
      customer_id: form.customer_id || null,
      customer_name: customer?.name || '',
      contract_id: form.contract_id || null,
      contract_no: contract?.contract_no || '',
      court_case_no: form.court_case_no,
      received_amount: form.received_amount,
      payment_mode: form.payment_mode,
      notes: form.notes,
      attachments: form.attachments,
    };

    if (editing) {
      await supabase.from('receipt_vouchers').update(data).eq('id', editing.id);
    } else {
      await supabase.from('receipt_vouchers').insert(data);
      // Update contract paid amount if linked to a contract
      if (form.contract_id && form.receipt_type === 'installment') {
        const { data: contractData } = await supabase.from('contracts').select('paid_amount, sale_price').eq('id', form.contract_id).single();
        if (contractData) {
          const newPaid = (contractData.paid_amount || 0) + form.received_amount;
          await supabase.from('contracts').update({
            paid_amount: newPaid,
            remaining_amount: contractData.sale_price - newPaid,
          }).eq('id', form.contract_id);
        }
      }
    }
    setShowDialog(false);
    setForm(defaultForm);
    setEditing(null);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('receipt_vouchers').delete().eq('id', id);
    loadData();
  }

  function openEdit(r: ReceiptVoucher) {
    setEditing(r);
    setForm({
      receipt_date: r.receipt_date, receipt_type: r.receipt_type,
      customer_id: r.customer_id || '', contract_id: r.contract_id || '',
      court_case_no: r.court_case_no || '', received_amount: r.received_amount,
      payment_mode: r.payment_mode, notes: r.notes || '', attachments: r.attachments || [],
    });
    setShowDialog(true);
  }

  const filtered = receipts.filter(r =>
    r.receipt_voucher_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.contract_no?.toLowerCase().includes(search.toLowerCase())
  );

  const totalReceived = filtered.reduce((sum, r) => sum + (r.received_amount || 0), 0);

  const exportHeaders = [t('receiptVoucherNo'), t('receiptDate'), t('receiptType'), t('customerName'), t('contractNo'), t('receivedAmount'), t('paymentMode')];
  const exportRows = filtered.map(r => [r.receipt_voucher_no, r.receipt_date, r.receipt_type, r.customer_name, r.contract_no, r.received_amount, r.payment_mode]);

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      fileOpening: 'bg-blue-100 text-blue-700',
      installment: 'bg-green-100 text-green-700',
      courtMoney: 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('receipts')}</h1>
          <p className="text-slate-500 text-sm">{t('total')}: {totalReceived.toLocaleString()} {t('kd')}</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('receipts')} headers={exportHeaders} rows={exportRows} filename="receipts" />
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addReceipt')}
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
              <FileText className="h-12 w-12 mx-auto mb-3" />
              <p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receiptVoucherNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receiptDate')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receiptType')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('contractNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receivedAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('paymentMode')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-blue-600">{r.receipt_voucher_no}</td>
                      <td className="py-3 px-4">{r.receipt_date}</td>
                      <td className="py-3 px-4">
                        <Badge className={typeColor(r.receipt_type)} variant="secondary">{t(r.receipt_type as keyof typeof t)}</Badge>
                      </td>
                      <td className="py-3 px-4">{r.customer_name}</td>
                      <td className="py-3 px-4">{r.contract_no}</td>
                      <td className="py-3 px-4 font-medium text-green-600">{r.received_amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">{r.payment_mode}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
            <DialogTitle>{editing ? t('editReceipt') : t('addReceipt')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('receiptDate')}</Label>
                <Input type="date" value={form.receipt_date} onChange={e => setForm({ ...form, receipt_date: e.target.value })} />
              </div>
              <div>
                <Label>{t('receiptType')} *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.receipt_type} onChange={e => setForm({ ...form, receipt_type: e.target.value })}>
                  {receiptTypes.map(rt => <option key={rt} value={rt}>{t(rt as keyof typeof t)}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('customer')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Select</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customer_no} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('contractNo')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.contract_id} onChange={e => {
                  const contract = contracts.find(c => c.id === e.target.value);
                  setForm({ ...form, contract_id: e.target.value, customer_id: contract?.customer_id || form.customer_id });
                }}>
                  <option value="">Select</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no} - {c.customer_name}</option>)}
                </select>
              </div>
              {form.receipt_type === 'courtMoney' && (
                <div>
                  <Label>{t('courtCaseNo')}</Label>
                  <Input value={form.court_case_no} onChange={e => setForm({ ...form, court_case_no: e.target.value })} />
                </div>
              )}
              <div>
                <Label>{t('receivedAmount')} *</Label>
                <Input type="number" value={form.received_amount} onChange={e => setForm({ ...form, received_amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('paymentMode')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                  {paymentModes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>{t('notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>

            <FileAttachment bucket="receipts" folder={editing?.id || 'new'} files={form.attachments} onFilesChange={files => setForm({ ...form, attachments: files })} />

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
