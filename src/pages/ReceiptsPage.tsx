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
import { Plus, Search, Pencil, Trash2, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ReceiptVoucher {
  id: string; receipt_voucher_no: string; receipt_date: string; receipt_type: string;
  customer_id: string; customer_name: string; contract_id: string; contract_no: string;
  court_case_no: string; received_amount: number; discount_amount: number; net_amount: number;
  payment_mode: string;
  installment_no: number | null;
  notes: string; attachments: string[]; created_at: string;
}

interface Customer { id: string; customer_no: string; name: string; }
interface FullContract {
  id: string; contract_no: string; customer_name: string; customer_id: string;
  sale_price: number; paid_amount: number; remaining_amount: number;
  installment_schedule: any[]; status: string;
}
interface LegalCase {
  id: string; case_no: string; customer_id: string; customer_name: string;
  contract_id: string; case_amount: number; rcvd_from_court: number; rcvd_from_customer: number;
  balance_amount: number; claimed_amount: number;
}

const defaultForm = {
  receipt_date: format(new Date(), 'yyyy-MM-dd'),
  receipt_type: 'installment', customer_id: '', contract_id: '',
  court_case_no: '', received_amount: 0, discount_amount: 0, payment_mode: 'cash',
  installment_no: null as number | null,
  notes: '', attachments: [] as string[],
};

const receiptTypes = ['installment', 'courtMoney'];
const paymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

export default function ReceiptsPage() {
  const { t } = useLang();
  const [receipts, setReceipts] = useState<ReceiptVoucher[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allContracts, setAllContracts] = useState<FullContract[]>([]);
  const [legalCases, setLegalCases] = useState<LegalCase[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showCaseReceipts, setShowCaseReceipts] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReceiptVoucher | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [selectedInstallments, setSelectedInstallments] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    let recQuery = supabase.from('receipt_vouchers').select('*').order('created_at', { ascending: false });
    if (fromDate) recQuery = recQuery.gte('receipt_date', fromDate);
    if (toDate) recQuery = recQuery.lte('receipt_date', toDate);
    const [recRes, custRes, contRes, legalRes] = await Promise.all([
      recQuery,
      supabase.from('customers').select('id, customer_no, name'),
      supabase.from('contracts').select('id, contract_no, customer_name, customer_id, sale_price, paid_amount, remaining_amount, installment_schedule, status'),
      supabase.from('legal_cases').select('id, case_no, customer_id, customer_name, contract_id, case_amount, rcvd_from_court, rcvd_from_customer, balance_amount, claimed_amount'),
    ]);
    setReceipts(recRes.data || []);
    setCustomers(custRes.data || []);
    setAllContracts(contRes.data || []);
    setLegalCases(legalRes.data || []);
    setLoading(false);
  }

  // Filter contracts by selected customer
  const filteredContracts = form.customer_id
    ? allContracts.filter(c => c.customer_id === form.customer_id)
    : allContracts;

  // Filter legal cases by selected customer AND contract
  const filteredCases = form.contract_id
    ? legalCases.filter(lc => lc.contract_id === form.contract_id)
    : form.customer_id
      ? legalCases.filter(lc => lc.customer_id === form.customer_id)
      : legalCases;

  // Get pending installments for selected contract
  const selectedContract = allContracts.find(c => c.id === form.contract_id);
  const pendingInstallments = selectedContract?.installment_schedule
    ? (selectedContract.installment_schedule || [])
        .map((inst: any, idx: number) => ({ ...inst, index: idx }))
        .filter((inst: any) => inst.status !== 'paid')
    : [];

  // Apply effects of a receipt on contracts/legal cases
  async function applyReceiptEffects(formData: typeof form) {
    if (formData.contract_id && formData.receipt_type === 'installment') {
      const { data: contractData } = await supabase.from('contracts')
        .select('paid_amount, sale_price, installment_schedule, status')
        .eq('id', formData.contract_id).single();
      if (contractData) {
        const schedule = [...(contractData.installment_schedule || [])];
        if (formData.installment_no !== null && formData.installment_no !== undefined) {
          const instIdx = formData.installment_no;
          if (schedule[instIdx] && schedule[instIdx].status !== 'paid') {
            schedule[instIdx] = { ...schedule[instIdx], status: 'paid', paid_date: formData.receipt_date || format(new Date(), 'yyyy-MM-dd') };
          }
        }
        const schedulePaidTotal = schedule.filter((s: any) => s.status === 'paid').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
        const finalRemaining = (contractData.sale_price || 0) - schedulePaidTotal;
        const defaultActive = contractData.status === 'ongoing' ? 'ongoing' : 'functional';
        const newStatus = schedulePaidTotal >= (contractData.sale_price || 0) ? 'finished' : contractData.status === 'finished' ? defaultActive : contractData.status;
        await supabase.from('contracts').update({ installment_schedule: schedule, paid_amount: schedulePaidTotal, remaining_amount: finalRemaining, status: newStatus }).eq('id', formData.contract_id);
      }
    }
    if (formData.court_case_no && formData.receipt_type === 'courtMoney') {
      // Fetch fresh legal case data from DB to avoid stale state issues
      const { data: freshLc } = await supabase.from('legal_cases')
        .select('id, rcvd_from_court, claimed_amount, case_amount')
        .eq('case_no', formData.court_case_no).single();
      if (freshLc) {
        const newRcvd = (freshLc.rcvd_from_court || 0) + formData.received_amount;
        const newBalance = (freshLc.claimed_amount || freshLc.case_amount || 0) - newRcvd;
        await supabase.from('legal_cases').update({ rcvd_from_court: newRcvd, balance_amount: newBalance }).eq('id', freshLc.id);
      }
    }
  }

  // Reverse effects of a receipt (for edit/delete)
  async function reverseReceiptEffects(receipt: ReceiptVoucher) {
    if (receipt.contract_id && receipt.receipt_type === 'installment') {
      const { data: contractData } = await supabase.from('contracts')
        .select('paid_amount, sale_price, installment_schedule, status')
        .eq('id', receipt.contract_id).single();
      if (contractData) {
        const schedule = [...(contractData.installment_schedule || [])];
        if (receipt.installment_no !== null && receipt.installment_no !== undefined) {
          const instIdx = receipt.installment_no;
          if (schedule[instIdx] && schedule[instIdx].status === 'paid') {
            schedule[instIdx] = { ...schedule[instIdx], status: 'pending', paid_date: null };
          }
        }
        const schedulePaidTotal = schedule.filter((s: any) => s.status === 'paid').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
        const finalRemaining = (contractData.sale_price || 0) - schedulePaidTotal;
        const revDefaultActive = contractData.status === 'ongoing' ? 'ongoing' : 'functional';
        const newStatus = schedulePaidTotal >= (contractData.sale_price || 0) ? 'finished' : contractData.status === 'finished' ? revDefaultActive : contractData.status;
        await supabase.from('contracts').update({ installment_schedule: schedule, paid_amount: schedulePaidTotal, remaining_amount: finalRemaining, status: newStatus }).eq('id', receipt.contract_id);
      }
    }
    if (receipt.court_case_no && receipt.receipt_type === 'courtMoney') {
      // Fetch fresh legal case data from DB to avoid stale state issues
      const { data: freshLc } = await supabase.from('legal_cases')
        .select('id, rcvd_from_court, claimed_amount, case_amount')
        .eq('case_no', receipt.court_case_no).single();
      if (freshLc) {
        const newRcvd = Math.max(0, (freshLc.rcvd_from_court || 0) - receipt.received_amount);
        const newBalance = (freshLc.claimed_amount || freshLc.case_amount || 0) - newRcvd;
        await supabase.from('legal_cases').update({ rcvd_from_court: newRcvd, balance_amount: newBalance }).eq('id', freshLc.id);
      }
    }
  }

  // Helper to try insert/update, progressively stripping optional columns if they don't exist in DB
  const optionalCols = ['installment_no', 'discount_amount', 'net_amount'];
  async function tryUpsert(data: any, isEdit: boolean, editId?: string): Promise<boolean> {
    let payload = { ...data };
    for (let attempt = 0; attempt <= optionalCols.length; attempt++) {
      const { error } = isEdit
        ? await supabase.from('receipt_vouchers').update(payload).eq('id', editId!)
        : await supabase.from('receipt_vouchers').insert(payload);
      if (!error) return true;
      const badCol = optionalCols.find(col => !!(error.message || error.details || '').includes(col) || (error.code === '42703' && (error.message || '').includes(col)));
      if (badCol) {
        const { [badCol]: _, ...rest } = payload;
        payload = rest;
        continue;
      }
      if (attempt === 0 && (error.code === '42703' || (error.message || '').includes('column'))) {
        for (const col of optionalCols) delete payload[col];
        continue;
      }
      console.error(isEdit ? 'Receipt update error:' : 'Receipt insert error:', error);
      alert(`Failed to ${isEdit ? 'update' : 'save'} receipt: ${error.message}`);
      return false;
    }
    return true;
  }

  async function handleSave() {
    const customer = customers.find(c => c.id === form.customer_id);
    const contract = allContracts.find(c => c.id === form.contract_id);

    // Multi-installment: create one receipt per selected installment
    if (form.receipt_type === 'installment' && !editing && selectedInstallments.length > 0) {
      for (const instIdx of selectedInstallments) {
        const inst = selectedContract?.installment_schedule?.[instIdx];
        const instAmount = inst?.amount || 0;
        const data: any = {
          receipt_date: form.receipt_date, receipt_type: form.receipt_type,
          customer_id: form.customer_id || null, customer_name: customer?.name || '',
          contract_id: form.contract_id || null, contract_no: contract?.contract_no || '',
          court_case_no: '', received_amount: instAmount,
          discount_amount: 0, net_amount: instAmount,
          payment_mode: form.payment_mode, notes: form.notes, attachments: form.attachments,
          installment_no: instIdx,
        };
        const ok = await tryUpsert(data, false);
        if (ok) await applyReceiptEffects({ ...form, installment_no: instIdx, received_amount: instAmount });
      }
      setShowDialog(false); setForm(defaultForm); setSelectedInstallments([]); setEditing(null); loadData();
      return;
    }

    // Single installment or edit mode or court money
    const data: any = {
      receipt_date: form.receipt_date, receipt_type: form.receipt_type,
      customer_id: form.customer_id || null, customer_name: customer?.name || '',
      contract_id: form.contract_id || null, contract_no: contract?.contract_no || '',
      court_case_no: form.court_case_no, received_amount: form.received_amount,
      discount_amount: form.discount_amount || 0,
      net_amount: (form.received_amount || 0) - (form.discount_amount || 0),
      payment_mode: form.payment_mode, notes: form.notes, attachments: form.attachments,
      installment_no: form.installment_no,
    };
    if (editing) {
      await reverseReceiptEffects(editing);
      const ok = await tryUpsert(data, true, editing.id);
      if (ok) await applyReceiptEffects(form);
    } else {
      const ok = await tryUpsert(data, false);
      if (ok) await applyReceiptEffects(form);
    }
    setShowDialog(false); setForm(defaultForm); setSelectedInstallments([]); setEditing(null); loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure?')) return;
    const receipt = receipts.find(r => r.id === id);
    if (receipt) { await reverseReceiptEffects(receipt); }
    await supabase.from('receipt_vouchers').delete().eq('id', id);
    loadData();
  }

  function openEdit(r: ReceiptVoucher) {
    setEditing(r);
    setForm({
      receipt_date: r.receipt_date, receipt_type: r.receipt_type,
      customer_id: r.customer_id || '', contract_id: r.contract_id || '',
      court_case_no: r.court_case_no || '', received_amount: r.received_amount,
      discount_amount: (r as any).discount_amount || 0,
      payment_mode: r.payment_mode, notes: r.notes || '', attachments: r.attachments || [],
      installment_no: r.installment_no ?? null,
    });
    setShowDialog(true);
  }

  const filtered = receipts.filter(r =>
    r.receipt_voucher_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.contract_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.court_case_no?.toLowerCase().includes(search.toLowerCase())
  );

  const totalReceived = filtered.reduce((sum, r) => sum + (r.received_amount || 0), 0);

  // Group receipts by case for court installment schedule view
  function getCaseReceipts(caseNo: string) {
    return receipts.filter(r => r.court_case_no === caseNo).sort((a, b) => a.receipt_date.localeCompare(b.receipt_date));
  }

  function getCaseInfo(caseNo: string) {
    return legalCases.find(lc => lc.case_no === caseNo);
  }

  const exportHeaders = [t('receiptVoucherNo'), t('receiptDate'), t('receiptType'), t('customerName'), t('contractNo'), t('installmentNo'), t('courtCaseNo'), t('receivedAmount'), t('paymentMode')];
  const exportRows = filtered.map(r => [r.receipt_voucher_no, r.receipt_date, r.receipt_type, r.customer_name, r.contract_no, r.installment_no !== null && r.installment_no !== undefined ? `#${r.installment_no + 1}` : '', r.court_case_no, r.received_amount, r.payment_mode]);

  const typeColor = (type: string) => {
    const colors: Record<string, string> = { fileOpening: 'bg-blue-100 text-blue-700', installment: 'bg-green-100 text-green-700', courtMoney: 'bg-purple-100 text-purple-700' };
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
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setSelectedInstallments([]); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addReceipt')}
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
              <FileText className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
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
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('installmentNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('courtCaseNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receivedAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('discount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('netAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-blue-600">{r.receipt_voucher_no}</td>
                      <td className="py-3 px-4">{r.receipt_date}</td>
                      <td className="py-3 px-4"><Badge className={typeColor(r.receipt_type)} variant="secondary">{r.receipt_type}</Badge></td>
                      <td className="py-3 px-4">{r.customer_name}</td>
                      <td className="py-3 px-4">{r.contract_no}</td>
                      <td className="py-3 px-4">{r.installment_no !== null && r.installment_no !== undefined ? `#${r.installment_no + 1}` : '-'}</td>
                      <td className="py-3 px-4">
                        {r.court_case_no && (
                          <span className="text-purple-600 cursor-pointer underline" onClick={() => setShowCaseReceipts(r.court_case_no)}>{r.court_case_no}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-green-600">{r.received_amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-orange-600">{(r as any).discount_amount ? `${(r as any).discount_amount.toLocaleString()} ${t('kd')}` : '-'}</td>
                      <td className="py-3 px-4 font-medium text-blue-600">{((r.received_amount || 0) - ((r as any).discount_amount || 0)).toLocaleString()} {t('kd')}</td>
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

      {/* Court Case Receipts / Installment Schedule */}
      <Dialog open={!!showCaseReceipts} onOpenChange={() => setShowCaseReceipts(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('courtInstallmentSchedule')} - {showCaseReceipts}</DialogTitle>
          </DialogHeader>
          {showCaseReceipts && (() => {
            const caseInfo = getCaseInfo(showCaseReceipts);
            const caseRcpts = getCaseReceipts(showCaseReceipts);
            const totalRcvd = caseRcpts.reduce((s, r) => s + (r.received_amount || 0), 0);
            const balance = (caseInfo?.case_amount || 0) - totalRcvd;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-blue-50 rounded-lg p-3"><p className="text-blue-600 text-xs">{t('caseAmount')}</p><p className="font-bold">{caseInfo?.case_amount?.toLocaleString()} {t('kd')}</p></div>
                  <div className="bg-green-50 rounded-lg p-3"><p className="text-green-600 text-xs">{t('totalReceived')}</p><p className="font-bold text-green-700">{totalRcvd.toLocaleString()} {t('kd')}</p></div>
                  <div className="bg-amber-50 rounded-lg p-3"><p className="text-amber-600 text-xs">{t('balanceAmount')}</p><p className="font-bold text-amber-700">{balance.toLocaleString()} {t('kd')}</p></div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-start py-2 px-3">#</th>
                      <th className="text-start py-2 px-3">{t('receiptDate')}</th>
                      <th className="text-start py-2 px-3">{t('receivedAmount')}</th>
                      <th className="text-start py-2 px-3">{t('balanceAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseRcpts.map((r, i) => {
                      const running = (caseInfo?.case_amount || 0) - caseRcpts.slice(0, i + 1).reduce((s, x) => s + (x.received_amount || 0), 0);
                      return (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-2 px-3">{i + 1}</td>
                          <td className="py-2 px-3">{r.receipt_date}</td>
                          <td className="py-2 px-3 text-green-600">{r.received_amount?.toLocaleString()} {t('kd')}</td>
                          <td className="py-2 px-3">{running.toLocaleString()} {t('kd')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Receipt Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setSelectedInstallments([]); }}>
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
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.receipt_type} onChange={e => { setForm({ ...form, receipt_type: e.target.value, installment_no: null, court_case_no: '' }); setSelectedInstallments([]); }}>
                  {receiptTypes.map(rt => <option key={rt} value={rt}>{t(rt as any) || rt}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('customer')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.customer_id} onChange={e => { setForm({ ...form, customer_id: e.target.value, contract_id: '', court_case_no: '', installment_no: null }); setSelectedInstallments([]); }}>
                  <option value="">Select</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customer_no} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('contractNo')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.contract_id} onChange={e => { setForm({ ...form, contract_id: e.target.value, court_case_no: '', installment_no: null }); setSelectedInstallments([]); }}>
                  <option value="">Select</option>
                  {filteredContracts.map(c => <option key={c.id} value={c.id}>{c.contract_no} - {c.customer_name}</option>)}
                </select>
              </div>
            </div>

            {/* Installment Selector - Multi-select with checkboxes */}
            {form.receipt_type === 'installment' && form.contract_id && (
              <div>
                <Label>{editing ? t('selectInstallment') + ' *' : t('selectInstallments') + ' *'}</Label>
                {pendingInstallments.length === 0 ? (
                  <p className="text-xs text-amber-600 mt-1">{t('allInstallmentsPaid')}</p>
                ) : editing ? (
                  // Single select mode for editing
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.installment_no ?? ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') { setForm({ ...form, installment_no: null }); }
                      else {
                        const idx = Number(val);
                        const inst = selectedContract?.installment_schedule?.[idx];
                        setForm({ ...form, installment_no: idx, received_amount: inst?.amount || form.received_amount });
                      }
                    }}
                  >
                    <option value="">{t('selectInstallment')}</option>
                    {pendingInstallments.map((inst: any) => (
                      <option key={inst.index} value={inst.index}>
                        #{inst.month || inst.index + 1} - {t('dueDate')}: {inst.due_date} - {inst.amount?.toLocaleString()} {t('kd')}
                      </option>
                    ))}
                  </select>
                ) : (
                  // Multi-select checkbox mode for new receipts
                  <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                    <div className="p-2 border-b bg-slate-50 flex items-center justify-between">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => {
                          if (selectedInstallments.length === pendingInstallments.length) {
                            setSelectedInstallments([]);
                          } else {
                            setSelectedInstallments(pendingInstallments.map((inst: any) => inst.index));
                          }
                        }}
                      >
                        {selectedInstallments.length === pendingInstallments.length ? t('deselectAll') : t('selectAll')}
                      </button>
                      <span className="text-xs text-slate-500">
                        {selectedInstallments.length} {t('selected')}
                      </span>
                    </div>
                    {pendingInstallments.map((inst: any) => {
                      const isChecked = selectedInstallments.includes(inst.index);
                      return (
                        <label
                          key={inst.index}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b last:border-b-0 transition-colors ${
                            isChecked ? 'bg-blue-50/70' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedInstallments(prev =>
                                isChecked ? prev.filter(i => i !== inst.index) : [...prev, inst.index]
                              );
                            }}
                          />
                          <div className="flex-1 flex items-center justify-between text-sm">
                            <span className="font-medium">#{inst.month || inst.index + 1}</span>
                            <span className="text-slate-500">{inst.due_date}</span>
                            <span className="font-medium text-green-700">{inst.amount?.toLocaleString()} {t('kd')}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {/* Summary for multi-select */}
                {!editing && selectedInstallments.length > 0 && (
                  <div className="mt-2 bg-blue-50 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 font-medium">{t('totalForSelected')}:</span>
                      <span className="font-bold text-blue-700">
                        {selectedInstallments.reduce((sum, idx) => {
                          const inst = selectedContract?.installment_schedule?.[idx];
                          return sum + (inst?.amount || 0);
                        }, 0).toLocaleString()} {t('kd')}
                      </span>
                    </div>
                    <p className="text-xs text-blue-500 mt-1">{t('multiInstallmentNote')}</p>
                  </div>
                )}
                {/* Summary for single select (edit mode) */}
                {editing && form.installment_no !== null && form.installment_no !== undefined && selectedContract?.installment_schedule?.[form.installment_no] && (
                  <div className="mt-2 bg-blue-50 rounded-lg p-3 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div><span className="text-blue-600 text-xs">{t('installmentNo')}</span><p className="font-medium">#{(selectedContract.installment_schedule[form.installment_no].month || form.installment_no + 1)}</p></div>
                      <div><span className="text-blue-600 text-xs">{t('dueDate')}</span><p className="font-medium">{selectedContract.installment_schedule[form.installment_no].due_date}</p></div>
                      <div><span className="text-blue-600 text-xs">{t('amount')}</span><p className="font-medium">{selectedContract.installment_schedule[form.installment_no].amount?.toLocaleString()} {t('kd')}</p></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Contract Summary */}
            {form.contract_id && selectedContract && (
              <div className="bg-slate-50 rounded-lg p-4 text-sm">
                <h4 className="font-medium mb-2">{t('contractDetails')}</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div><span className="text-slate-500 text-xs">{t('contractNo')}</span><p className="font-medium">{selectedContract.contract_no}</p></div>
                  <div><span className="text-slate-500 text-xs">{t('salePrice')}</span><p className="font-medium">{selectedContract.sale_price?.toLocaleString()} {t('kd')}</p></div>
                  <div><span className="text-slate-500 text-xs">{t('paidAmount')}</span><p className="font-medium text-green-600">{selectedContract.paid_amount?.toLocaleString()} {t('kd')}</p></div>
                  <div><span className="text-slate-500 text-xs">{t('remainingAmount')}</span><p className="font-medium text-red-600">{selectedContract.remaining_amount?.toLocaleString()} {t('kd')}</p></div>
                </div>
                <div className="mt-2"><div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(selectedContract.paid_amount || 0) / Math.max(1, selectedContract.sale_price) * 100}%` }} /></div></div>
              </div>
            )}

            {/* Court Money - Legal Cases List */}
            {form.receipt_type === 'courtMoney' && (
              <div>
                <Label>{t('selectLegalCase')} *</Label>
                {filteredCases.length === 0 ? (
                  <p className="text-xs text-amber-600 mt-2">{t('noLegalCases')}</p>
                ) : (
                  <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-xs">
                          <th className="text-start py-2 px-3 w-8"></th>
                          <th className="text-start py-2 px-3">{t('caseNo')}</th>
                          <th className="text-start py-2 px-3">{t('customerName')}</th>
                          <th className="text-start py-2 px-3">{t('caseAmount')}</th>
                          <th className="text-start py-2 px-3">{t('receivedAmount')}</th>
                          <th className="text-start py-2 px-3">{t('balanceAmount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCases.map(lc => {
                          const isSelected = form.court_case_no === lc.case_no;
                          const totalRcvd = (lc.rcvd_from_court || 0) + (lc.rcvd_from_customer || 0);
                          const balance = (lc.claimed_amount || lc.case_amount || 0) - totalRcvd;
                          return (
                            <tr
                              key={lc.id}
                              className={`border-b last:border-b-0 cursor-pointer transition-colors ${
                                isSelected ? 'bg-purple-50' : 'hover:bg-slate-50'
                              }`}
                              onClick={() => setForm({ ...form, court_case_no: lc.case_no })}
                            >
                              <td className="py-2 px-3">
                                <input type="radio" checked={isSelected} readOnly className="h-4 w-4 text-purple-600" />
                              </td>
                              <td className="py-2 px-3 font-medium text-purple-600">{lc.case_no}</td>
                              <td className="py-2 px-3">{lc.customer_name}</td>
                              <td className="py-2 px-3">{(lc.claimed_amount || lc.case_amount || 0).toLocaleString()} {t('kd')}</td>
                              <td className="py-2 px-3 text-green-600">{totalRcvd.toLocaleString()} {t('kd')}</td>
                              <td className={`py-2 px-3 font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{balance.toLocaleString()} {t('kd')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {form.court_case_no && (() => {
                  const lc = filteredCases.find(c => c.case_no === form.court_case_no);
                  if (!lc) return null;
                  const totalRcvd = (lc.rcvd_from_court || 0) + (lc.rcvd_from_customer || 0);
                  const balance = (lc.claimed_amount || lc.case_amount || 0) - totalRcvd;
                  return (
                    <div className="mt-2 bg-purple-50 rounded-lg p-3 text-sm">
                      <div className="grid grid-cols-3 gap-2">
                        <div><span className="text-purple-600 text-xs">{t('caseAmount')}</span><p className="font-bold">{(lc.claimed_amount || lc.case_amount || 0).toLocaleString()} {t('kd')}</p></div>
                        <div><span className="text-green-600 text-xs">{t('totalReceived')}</span><p className="font-bold text-green-700">{totalRcvd.toLocaleString()} {t('kd')}</p></div>
                        <div><span className="text-amber-600 text-xs">{t('balanceAmount')}</span><p className="font-bold text-amber-700">{balance.toLocaleString()} {t('kd')}</p></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('receivedAmount')} *</Label>
                <Input type="number" value={form.received_amount} onChange={e => setForm({ ...form, received_amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('discount')}</Label>
                <Input type="number" value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: Number(e.target.value) })} placeholder="0" />
              </div>
              {(form.received_amount > 0 && form.discount_amount > 0) && (
                <div className="md:col-span-2">
                  <div className="bg-blue-50 rounded-lg p-3 text-sm flex items-center justify-between">
                    <span className="text-blue-600 font-medium">{t('netAmount')}:</span>
                    <span className="font-bold text-blue-700">{((form.received_amount || 0) - (form.discount_amount || 0)).toLocaleString()} {t('kd')}</span>
                  </div>
                </div>
              )}
              <div>
                <Label>{t('paymentMode')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                  {paymentModes.map(m => <option key={m} value={m}>{t(m as any) || m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>{t('notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <FileAttachment bucket="receipts" folder={editing?.id || 'new'} files={form.attachments} onFilesChange={files => setForm({ ...form, attachments: files })} />
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowDialog(false); setSelectedInstallments([]); }}>{t('cancel')}</Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
