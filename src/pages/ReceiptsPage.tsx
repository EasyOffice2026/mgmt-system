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
import { Plus, Search, Pencil, Trash2, FileText, Printer } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { format } from 'date-fns';
import { approvLogoBase64 } from '@/lib/fonts/logo';
import { DatePicker } from '@/components/ui/date-picker';
import { Pagination } from '@/components/ui/pagination';

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
const defaultPaymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

export default function ReceiptsPage() {
  const { t, lang } = useLang();
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
  const [installmentAmounts, setInstallmentAmounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState<ReceiptVoucher | null>(null);
  const [paymentModes, setPaymentModes] = useState<string[]>(defaultPaymentModes);

  useEffect(() => { loadData(); loadPaymentModes(); }, [fromDate, toDate]);

  async function loadPaymentModes() {
    const { data } = await supabase.from('payment_modes').select('name').order('name');
    if (data && data.length > 0) {
      setPaymentModes(data.map((d: any) => d.name));
    }
  }

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

  // Filter contracts by selected customer; for Court Money, show only contracts with legal_case status
  const filteredContracts = form.customer_id
    ? allContracts.filter(c => c.customer_id === form.customer_id && (form.receipt_type === 'courtMoney' ? c.status === 'legal_case' : true))
    : allContracts;

  // Filter legal cases by selected customer AND contract
  const filteredCases = form.contract_id
    ? legalCases.filter(lc => lc.contract_id === form.contract_id)
    : form.customer_id
      ? legalCases.filter(lc => lc.customer_id === form.customer_id)
      : legalCases;

  // Get pending/partially_paid installments for selected contract
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
            const prevPaid = schedule[instIdx].paid_amount || 0;
            const newPaid = prevPaid + (formData.received_amount || 0);
            const instTotal = schedule[instIdx].amount || 0;
            const newStatus = newPaid >= instTotal ? 'paid' : newPaid > 0 ? 'partially_paid' : 'pending';
            schedule[instIdx] = {
              ...schedule[instIdx],
              paid_amount: newPaid,
              status: newStatus,
              paid_date: newStatus === 'paid' ? (formData.receipt_date || format(new Date(), 'yyyy-MM-dd')) : schedule[instIdx].paid_date || null,
            };
          }
        }
        const schedulePaidTotal = schedule.reduce((sum: number, s: any) => sum + (s.status === 'paid' ? (s.amount || 0) : (s.paid_amount || 0)), 0);
        const finalRemaining = (contractData.sale_price || 0) - schedulePaidTotal;
        const newStatus = schedulePaidTotal >= (contractData.sale_price || 0) ? 'finished' : contractData.status === 'finished' ? 'ongoing' : contractData.status;
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
          if (schedule[instIdx]) {
            const prevPaid = schedule[instIdx].paid_amount || 0;
            const newPaid = Math.max(0, prevPaid - (receipt.received_amount || 0));
            const newStatus = newPaid <= 0 ? 'pending' : newPaid >= (schedule[instIdx].amount || 0) ? 'paid' : 'partially_paid';
            schedule[instIdx] = {
              ...schedule[instIdx],
              paid_amount: newPaid,
              status: newStatus,
              paid_date: newStatus === 'paid' ? schedule[instIdx].paid_date : null,
            };
          }
        }
        const schedulePaidTotal = schedule.reduce((sum: number, s: any) => sum + (s.status === 'paid' ? (s.amount || 0) : (s.paid_amount || 0)), 0);
        const finalRemaining = (contractData.sale_price || 0) - schedulePaidTotal;
        const newStatus = schedulePaidTotal >= (contractData.sale_price || 0) ? 'finished' : contractData.status === 'finished' ? 'ongoing' : contractData.status;
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
        const instTotal = inst?.amount || 0;
        const instPaid = inst?.paid_amount || 0;
        const instRemaining = instTotal - instPaid;
        // Use custom amount if user specified one for this installment, otherwise use remaining
        const payAmount = installmentAmounts[instIdx] !== undefined ? installmentAmounts[instIdx] : instRemaining;
        const data: any = {
          receipt_date: form.receipt_date, receipt_type: form.receipt_type,
          customer_id: form.customer_id || null, customer_name: customer?.name || '',
          contract_id: form.contract_id || null, contract_no: contract?.contract_no || '',
          court_case_no: '', received_amount: payAmount,
          discount_amount: 0, net_amount: payAmount,
          payment_mode: form.payment_mode, notes: form.notes, attachments: form.attachments,
          installment_no: instIdx,
        };
        const ok = await tryUpsert(data, false);
        if (ok) await applyReceiptEffects({ ...form, installment_no: instIdx, received_amount: payAmount });
      }
      setShowDialog(false); setForm(defaultForm); setSelectedInstallments([]); setInstallmentAmounts({}); setEditing(null); loadData();
      return;
    }

    // Single installment or edit mode or court money
    const data: any = {
      receipt_date: form.receipt_date, receipt_type: form.receipt_type,
      customer_id: form.customer_id || null, customer_name: customer?.name || '',
      contract_id: form.contract_id || null, contract_no: contract?.contract_no || '',
      court_case_no: form.court_case_no, received_amount: form.received_amount,
      discount_amount: form.discount_amount || 0,
      net_amount: (selectedContract?.remaining_amount || 0) - (form.received_amount || 0) - (form.discount_amount || 0),
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
    setShowDialog(false); setForm(defaultForm); setSelectedInstallments([]); setInstallmentAmounts({}); setEditing(null); loadData();
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
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalReceived = filtered.reduce((sum, r) => sum + (r.received_amount || 0), 0);

  // Group receipts by case for court installment schedule view
  function getCaseReceipts(caseNo: string) {
    return receipts.filter(r => r.court_case_no === caseNo).sort((a, b) => a.receipt_date.localeCompare(b.receipt_date));
  }

  function getCaseInfo(caseNo: string) {
    return legalCases.find(lc => lc.case_no === caseNo);
  }

  const exportHeaders = [t('receiptVoucherNo'), t('receiptDate'), t('receiptType'), t('contractNo'), t('installmentNo'), t('courtCaseNo'), t('netAmount'), t('paymentMode')];
  const exportRows = filtered.map(r => [r.receipt_voucher_no, r.receipt_date, r.receipt_type, r.contract_no, r.installment_no !== null && r.installment_no !== undefined ? `#${r.installment_no + 1}` : '', r.court_case_no, (r.received_amount || 0) - ((r as any).discount_amount || 0), r.payment_mode]);

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
          <Input placeholder={t('search')} value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="ps-9" />
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={fromDate} onChange={setFromDate} placeholder={t("from")} />
          <span className="text-slate-400">-</span>
          <DatePicker value={toDate} onChange={setToDate} placeholder={t("to")} />
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
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receiptVoucherNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receiptDate')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receiptType')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('contractNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('installmentNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('courtCaseNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('netAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-blue-600">{r.receipt_voucher_no}</td>
                      <td className="py-3 px-4">{r.receipt_date}</td>
                      <td className="py-3 px-4"><Badge className={typeColor(r.receipt_type)} variant="secondary">{r.receipt_type}</Badge></td>
                      <td className="py-3 px-4">{r.contract_no}</td>
                      <td className="py-3 px-4">{r.installment_no !== null && r.installment_no !== undefined ? `#${r.installment_no + 1}` : '-'}</td>
                      <td className="py-3 px-4">
                        {r.court_case_no && (
                          <span className="text-purple-600 cursor-pointer underline" onClick={() => setShowCaseReceipts(r.court_case_no)}>{r.court_case_no}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-blue-600">{((r.received_amount || 0) - ((r as any).discount_amount || 0)).toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setShowForm(r)}><Printer className="h-4 w-4 text-blue-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
            </>
          )}
        </CardContent>
      </Card>

      {/* Printable Receipt Voucher Form */}
      <Dialog open={!!showForm} onOpenChange={() => setShowForm(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{t('receiptVoucherForm')}</span>
              <Button size="sm" variant="outline" onClick={() => { const el = document.getElementById('receipt-print-form'); if (el) { const w = window.open('', '_blank'); if (w) { const d = lang === 'ar' ? 'rtl' : 'ltr'; const ta = lang === 'ar' ? 'right' : 'left'; w.document.write('<html><head><title>' + (showForm?.receipt_voucher_no || '') + '</title><style>body{font-family:Arial,sans-serif;padding:30px;direction:' + d + '}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:10px;text-align:' + ta + ';font-size:13px}th{background:#f5f5f5;font-weight:600}.header{text-align:center;margin-bottom:20px}.header h1{font-size:20px;margin:5px 0}.header h2{font-size:16px;color:#555;margin:5px 0}.footer{margin-top:40px;display:flex;justify-content:space-between}.sig-block{text-align:center;width:200px}.sig-line{border-top:1px solid #333;margin-top:60px;padding-top:5px;font-size:12px}@media print{body{padding:20px}}</style></head><body>' + el.innerHTML + '</body></html>'); w.document.close(); w.print(); } } }}>
                <Printer className="h-4 w-4 me-1" /> {t('print')}
              </Button>
            </DialogTitle>
          </DialogHeader>
          {showForm && (
            <div id="receipt-print-form" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="flex items-center gap-4 border-b pb-4 mb-4">
                <img src={'data:image/png;base64,' + approvLogoBase64} alt="Approv" className="h-16 w-auto" />
                <div className={lang === 'ar' ? 'text-right flex-1' : 'text-left flex-1'}>
                  <h1 className="text-xl font-bold">Approv</h1>
                  <p className="text-sm text-slate-500">شركة ابروف لتجارة الجمله والتجزئة</p>
                  <h2 className="text-lg text-slate-600 font-semibold mt-1">{t('receiptVoucherForm')}</h2>
                </div>
              </div>
              <table className="w-full text-sm border">
                <tbody>
                  <tr><td className="border p-3 bg-slate-50 font-medium w-1/3">{t('receiptVoucherNo')}</td><td className="border p-3 font-bold">{showForm.receipt_voucher_no}</td></tr>
                  <tr><td className="border p-3 bg-slate-50 font-medium">{t('receiptDate')}</td><td className="border p-3">{showForm.receipt_date}</td></tr>
                  <tr><td className="border p-3 bg-slate-50 font-medium">{t('receiptType')}</td><td className="border p-3">{t(showForm.receipt_type as any) || showForm.receipt_type}</td></tr>
                  <tr><td className="border p-3 bg-slate-50 font-medium">{t('customerName')}</td><td className="border p-3 font-bold">{showForm.customer_name}</td></tr>
                  {showForm.contract_no && <tr><td className="border p-3 bg-slate-50 font-medium">{t('contractNo')}</td><td className="border p-3">{showForm.contract_no}</td></tr>}
                  {showForm.installment_no !== null && showForm.installment_no !== undefined && <tr><td className="border p-3 bg-slate-50 font-medium">{t('installmentNo')}</td><td className="border p-3">#{showForm.installment_no + 1}</td></tr>}
                  {showForm.court_case_no && <tr><td className="border p-3 bg-slate-50 font-medium">{t('courtCaseNo')}</td><td className="border p-3">{showForm.court_case_no}</td></tr>}
                  <tr><td className="border p-3 bg-slate-50 font-medium">{t('receivedAmount')}</td><td className="border p-3 font-bold text-lg text-green-700">{showForm.received_amount?.toLocaleString()} {t('kd')}</td></tr>
                  {(showForm as any).discount_amount > 0 && <tr><td className="border p-3 bg-slate-50 font-medium">{t('discount')}</td><td className="border p-3 text-red-600">{(showForm as any).discount_amount?.toLocaleString()} {t('kd')}</td></tr>}
                  <tr><td className="border p-3 bg-slate-50 font-medium">{t('netAmount')}</td><td className="border p-3 font-bold text-lg">{(showForm.net_amount ?? ((showForm.received_amount || 0) - ((showForm as any).discount_amount || 0))).toLocaleString()} {t('kd')}</td></tr>
                  <tr><td className="border p-3 bg-slate-50 font-medium">{t('paymentMode')}</td><td className="border p-3">{t(showForm.payment_mode as any) || showForm.payment_mode}</td></tr>
                  {showForm.notes && <tr><td className="border p-3 bg-slate-50 font-medium">{t('notes')}</td><td className="border p-3">{showForm.notes}</td></tr>}
                </tbody>
              </table>

              <div className="mt-8 flex justify-between text-sm">
                <div className="text-center"><div className="border-t border-slate-400 mt-16 pt-2 w-48">{t('receivedBy')}</div></div>
                <div className="text-center"><div className="border-t border-slate-400 mt-16 pt-2 w-48">{t('signature')} / {t('customerName')}</div></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setSelectedInstallments([]); setInstallmentAmounts({}); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('editReceipt') : t('addReceipt')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('receiptDate')}</Label>
                <DatePicker value={form.receipt_date} onChange={(v) => setForm({ ...form, receipt_date: v })} placeholder={t("date")} className="w-full" />
              </div>
              <div>
                <Label>{t('receiptType')} *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.receipt_type} onChange={e => { setForm({ ...form, receipt_type: e.target.value, installment_no: null, court_case_no: '' }); setSelectedInstallments([]); }}>
                  {receiptTypes.map(rt => <option key={rt} value={rt}>{t(rt as any) || rt}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('customer')}</Label>
                <SearchableSelect
                  options={customers.map(c => ({ value: c.id, label: `${c.customer_no} - ${c.name}` }))}
                  value={form.customer_id}
                  onChange={(v) => { setForm({ ...form, customer_id: v, contract_id: '', court_case_no: '', installment_no: null }); setSelectedInstallments([]); }}
                  placeholder={t('selectCustomer') || 'Select Customer'}
                />
              </div>
              <div>
                <Label>{t('contractNo')}</Label>
                <SearchableSelect
                  options={filteredContracts.map(c => ({ value: c.id, label: `${c.contract_no} - ${c.customer_name}` }))}
                  value={form.contract_id}
                  onChange={(v) => { setForm({ ...form, contract_id: v, court_case_no: '', installment_no: null }); setSelectedInstallments([]); }}
                  placeholder={t('selectContract') || 'Select Contract'}
                />
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
                  <div className="mt-2 border rounded-lg max-h-80 overflow-y-auto">
                    <div className="p-2 border-b bg-slate-50 flex items-center justify-between">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => {
                          if (selectedInstallments.length === pendingInstallments.length) {
                            setSelectedInstallments([]);
                            setInstallmentAmounts({});
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
                      const instPaid = inst.paid_amount || 0;
                      const instRemaining = (inst.amount || 0) - instPaid;
                      return (
                        <div
                          key={inst.index}
                          className={`border-b last:border-b-0 transition-colors ${
                            isChecked ? 'bg-blue-50/70' : ''
                          }`}
                        >
                          <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedInstallments(prev =>
                                  isChecked ? prev.filter(i => i !== inst.index) : [...prev, inst.index]
                                );
                                if (isChecked) {
                                  setInstallmentAmounts(prev => { const n = { ...prev }; delete n[inst.index]; return n; });
                                }
                              }}
                            />
                            <div className="flex-1 flex items-center justify-between text-sm">
                              <span className="font-medium">#{inst.month || inst.index + 1}</span>
                              <span className="text-slate-500">{inst.due_date}</span>
                              <span className="font-medium">{inst.amount?.toLocaleString()} {t('kd')}</span>
                              {inst.status === 'partially_paid' && (
                                <Badge className="bg-amber-100 text-amber-700 text-[10px]" variant="secondary">{t('partiallyPaid')}</Badge>
                              )}
                            </div>
                          </label>
                          {/* Show remaining and amount input when checked */}
                          {isChecked && (
                            <div className="px-3 pb-2.5 flex items-center gap-2 ms-7">
                              <span className="text-xs text-slate-500 whitespace-nowrap">
                                {instPaid > 0 && <>{t('paid')}: {instPaid.toLocaleString()} | </>}{t('remaining')}: {instRemaining.toLocaleString()} {t('kd')}
                              </span>
                              <input
                                type="number"
                                className="h-7 w-28 rounded border border-slate-300 px-2 text-xs"
                                placeholder={instRemaining.toString()}
                                value={installmentAmounts[inst.index] ?? ''}
                                onChange={e => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  setInstallmentAmounts(prev => {
                                    if (val === undefined) { const n = { ...prev }; delete n[inst.index]; return n; }
                                    return { ...prev, [inst.index]: val };
                                  });
                                }}
                                max={instRemaining}
                                min={0}
                              />
                              <span className="text-[10px] text-slate-400">{t('kd')}</span>
                            </div>
                          )}
                        </div>
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
                          const instRemaining = (inst?.amount || 0) - (inst?.paid_amount || 0);
                          return sum + (installmentAmounts[idx] !== undefined ? installmentAmounts[idx] : instRemaining);
                        }, 0).toLocaleString()} {t('kd')}
                      </span>
                    </div>
                    <p className="text-xs text-blue-500 mt-1">{t('partialPaymentNote')}</p>
                  </div>
                )}
                {/* Summary for single select (edit mode) */}
                {editing && form.installment_no !== null && form.installment_no !== undefined && selectedContract?.installment_schedule?.[form.installment_no] && (() => {
                  const inst = selectedContract.installment_schedule[form.installment_no];
                  const instPaid = inst.paid_amount || 0;
                  const instRemaining = (inst.amount || 0) - instPaid;
                  return (
                  <div className="mt-2 bg-blue-50 rounded-lg p-3 text-sm">
                    <div className="grid grid-cols-4 gap-2">
                      <div><span className="text-blue-600 text-xs">{t('installmentNo')}</span><p className="font-medium">#{inst.month || form.installment_no + 1}</p></div>
                      <div><span className="text-blue-600 text-xs">{t('dueDate')}</span><p className="font-medium">{inst.due_date}</p></div>
                      <div><span className="text-blue-600 text-xs">{t('amount')}</span><p className="font-medium">{inst.amount?.toLocaleString()} {t('kd')}</p></div>
                      <div><span className="text-blue-600 text-xs">{t('remaining')}</span><p className="font-medium text-amber-600">{instRemaining.toLocaleString()} {t('kd')}</p></div>
                    </div>
                    {instPaid > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <span className="text-xs text-blue-500">{t('previouslyPaid')}: {instPaid.toLocaleString()} {t('kd')}</span>
                      </div>
                    )}
                  </div>
                  );
                })()}
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
                {!form.customer_id ? (
                  <p className="text-xs text-amber-600 mt-2">{t('selectCustomer')}</p>
                ) : !form.contract_id ? (
                  <p className="text-xs text-amber-600 mt-2">{t('selectContract')}</p>
                ) : filteredCases.length === 0 ? (
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
              {form.contract_id && (
                <div className="md:col-span-2">
                  <div className="bg-blue-50 rounded-lg p-3 text-sm flex items-center justify-between">
                    <span className="text-blue-600 font-medium">{t('netAmount')}:</span>
                    <span className="font-bold text-blue-700">{((selectedContract?.remaining_amount || 0) - (form.received_amount || 0) - (form.discount_amount || 0)).toLocaleString()} {t('kd')}</span>
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
