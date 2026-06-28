import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/contexts/LangContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FileAttachment } from '@/components/shared/FileAttachment';
import { DataExport } from '@/components/shared/DataExport';
import { Plus, Search, Pencil, Trash2, ShoppingCart, X, Clock, Printer } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { format, addMonths, isBefore } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { Pagination } from '@/components/ui/pagination';

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
interface Purchase { id: string; item_name: string; model_type: string; category: string; purchase_price: number; quantity: number; quantity_available: number; status: string; }

interface ContractItem { purchase_id: string; item_name: string; model_type: string; category: string; purchase_price: number; profit_percentage: number; sale_price: number; quantity: number; }

const emptyItem: ContractItem = { purchase_id: '', item_name: '', model_type: '', category: '', purchase_price: 0, profit_percentage: 0, sale_price: 0, quantity: 1 };

const defaultForm = {
  customer_id: '', items: [{ ...emptyItem }] as ContractItem[],
  file_opening_charges: 0, duration_months: 12,
  start_date: format(new Date(), 'yyyy-MM-dd'),
  first_installment_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
  payment_mode: 'cash', status: 'ongoing', attachments: [] as string[],
};

const defaultPaymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

export default function SalesPage() {
  const { t } = useLang();
  const { profile } = useAuth();
  const canTogglePayment = profile?.role === 'accountant' || profile?.role === 'owner' || profile?.role === 'superadmin';
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showSchedule, setShowSchedule] = useState<Contract | null>(null);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paymentModes, setPaymentModes] = useState<string[]>(defaultPaymentModes);
  const [showForm, setShowForm] = useState<Contract | null>(null);

  useEffect(() => { loadData(); loadPaymentModes(); }, [fromDate, toDate]);

  async function toggleInstallmentPayment(contract: Contract, instIdx: number, markPaid: boolean) {
    // Fetch fresh contract data from DB to avoid stale state overwrites
    const { data: freshContract } = await supabase.from('contracts')
      .select('id, sale_price, installment_schedule, status, contract_no, customer_id, customer_name')
      .eq('id', contract.id).single();
    if (!freshContract) return;

    const inst = freshContract.installment_schedule?.[instIdx];
    if (!inst) return;

    const schedule = [...(freshContract.installment_schedule || [])];

    if (markPaid) {
      // Check → mark as paid, create receipt voucher
      if (inst.status === 'paid') return; // already paid
      const today = format(new Date(), 'yyyy-MM-dd');
      schedule[instIdx] = { ...schedule[instIdx], status: 'paid', paid_amount: inst.amount || 0, paid_date: today };

      // Create receipt voucher
      const { data: lastRv } = await supabase.from('receipt_vouchers')
        .select('receipt_voucher_no').order('created_at', { ascending: false }).limit(1);
      const nextNo = lastRv && lastRv.length > 0
        ? 'RV-' + String(parseInt(lastRv[0].receipt_voucher_no?.replace('RV-', '') || '0') + 1).padStart(6, '0')
        : 'RV-000001';

      // Insert receipt, progressively stripping optional columns if they don't exist in DB
      const optionalCols = ['installment_no', 'discount_amount', 'net_amount', 'created_by', 'updated_by'];
      let payload: Record<string, any> = {
        receipt_voucher_no: nextNo,
        receipt_date: today,
        receipt_type: 'installment',
        customer_id: freshContract.customer_id,
        customer_name: freshContract.customer_name,
        contract_id: freshContract.id,
        contract_no: freshContract.contract_no,
        installment_no: instIdx,
        received_amount: inst.amount || 0,
        discount_amount: 0,
        net_amount: inst.amount || 0,
      };
      for (let attempt = 0; attempt <= optionalCols.length; attempt++) {
        const { error } = await supabase.from('receipt_vouchers').insert(payload);
        if (!error) break;
        if (error.code === '42703' || (error.message || '').includes('column')) {
          const badCol = optionalCols.find(col => (error.message || '').includes(col));
          if (badCol) { delete payload[badCol]; continue; }
          for (const col of optionalCols) delete payload[col];
          continue;
        }
        console.error('Receipt insert error:', error);
        break;
      }
    } else {
      // Uncheck → mark as pending, delete receipt voucher
      if (inst.status !== 'paid' && inst.status !== 'partially_paid') return; // not paid
      if (!window.confirm(t('confirmReversePayment') || 'Are you sure you want to reverse this payment? The receipt will be deleted and installment set to pending.')) return;

      schedule[instIdx] = { ...schedule[instIdx], status: 'pending', paid_amount: 0, paid_date: null };

      // Delete receipt voucher(s) for this installment
      const { data: receipts } = await supabase.from('receipt_vouchers')
        .select('id')
        .eq('contract_id', contract.id)
        .eq('installment_no', instIdx);
      if (receipts && receipts.length > 0) {
        for (const r of receipts) {
          await supabase.from('receipt_vouchers').delete().eq('id', r.id);
        }
      }
    }

    // Recalculate contract totals
    const totalPaid = schedule.reduce((sum: number, s: any) => sum + (s.status === 'paid' ? (s.amount || 0) : (s.paid_amount || 0)), 0);
    const remaining = (freshContract.sale_price || 0) - totalPaid;
    const newStatus = totalPaid >= (freshContract.sale_price || 0) ? 'finished' : freshContract.status === 'finished' ? 'ongoing' : freshContract.status;

    await supabase.from('contracts').update({
      installment_schedule: schedule,
      paid_amount: totalPaid,
      remaining_amount: remaining,
      status: newStatus,
    }).eq('id', contract.id);

    // Refresh data
    loadData();
    const { data: fresh } = await supabase.from('contracts').select('*').eq('id', contract.id).single();
    if (fresh) setShowSchedule(fresh);
  }

  async function loadPaymentModes() {
    const { data } = await supabase.from('payment_modes').select('name').order('name');
    if (data && data.length > 0) {
      const dbModes = data.map((d: any) => d.name);
      const merged = [...new Set([...defaultPaymentModes, ...dbModes])];
      setPaymentModes(merged);
    }
  }


  async function loadData() {
    setLoading(true);
    let contQuery = supabase.from('contracts').select('*').order('created_at', { ascending: false });
    if (fromDate) contQuery = contQuery.gte('start_date', fromDate);
    if (toDate) contQuery = contQuery.lte('start_date', toDate);
    const [contRes, custRes, purRes] = await Promise.all([
      contQuery,
      supabase.from('customers').select('id, customer_no, name'),
      supabase.from('purchases').select('id, item_name, model_type, category, purchase_price, quantity, quantity_available, status').eq('status', 'in_stock'),
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
        newItems[index] = { ...newItems[index], item_name: purchase.item_name, model_type: purchase.model_type, category: purchase.category, purchase_price: purchase.purchase_price, quantity: 1 };
      }
    }
    if (field === 'quantity') {
      const purchase = purchases.find(p => p.id === newItems[index].purchase_id);
      const maxQty = purchase ? (purchase.quantity_available ?? purchase.quantity ?? 1) : 9999;
      newItems[index] = { ...newItems[index], quantity: Math.min(Math.max(1, Number(value)), maxQty) };
    }
    // Auto-calculate sale price when purchase price or profit percentage changes
    if (field === 'purchase_price' || field === 'profit_percentage') {
      const item = newItems[index];
      const pp = field === 'purchase_price' ? Number(value) : item.purchase_price;
      const pct = field === 'profit_percentage' ? Number(value) : item.profit_percentage;
      if (pp > 0 && pct > 0) {
        newItems[index] = { ...newItems[index], sale_price: Math.round(pp * (1 + pct / 100) * 1000) / 1000 };
      }
    }
    setForm({ ...form, items: newItems });
  }

  function getTotalSalePrice() {
    return form.items.reduce((sum, item) => sum + (item.sale_price || 0) * (item.quantity || 1), 0);
  }

  function calculateInstallment() {
    return form.duration_months > 0 ? getTotalSalePrice() / form.duration_months : 0;
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

  async function generateContractNo(): Promise<string> {
    const year = new Date().getFullYear();
    const { data } = await supabase.from('contracts').select('contract_no').order('created_at', { ascending: false }).limit(100);
    let maxNum = 0;
    (data || []).forEach((c: any) => {
      const no = c.contract_no || '';
      // Handle CON-YYYY-NNNN format
      const match = no.match(/CON-\d{4}-(\d+)/);
      if (match) { maxNum = Math.max(maxNum, parseInt(match[1], 10)); }
      // Handle CON-NNNNN format
      const match2 = no.match(/^CON-(\d+)$/);
      if (match2) { maxNum = Math.max(maxNum, parseInt(match2[1], 10)); }
    });
    return `CON-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  async function handleSave() {
    // Validate mandatory fields
    if (!form.customer_id) { alert(t('selectCustomer') || 'Please select a customer'); return; }
    const hasValidItem = form.items.some(i => i.purchase_id || (i.item_name && i.sale_price > 0));
    if (!hasValidItem) { alert(t('selectProduct') || 'Please select at least one item'); return; }
    if (form.first_installment_date && form.start_date && form.first_installment_date < form.start_date) {
      alert(t('firstInstallmentBeforeStart') || 'First installment date cannot be before start date');
      return;
    }
    const customer = customers.find(c => c.id === form.customer_id);
    const totalSalePrice = getTotalSalePrice();
    const instAmount = calculateInstallment();
    const newSchedule = generateSchedule();

    // When editing, preserve existing installment payment data if financial terms unchanged
    let schedule = newSchedule;
    if (editing && editing.installment_schedule && editing.installment_schedule.length > 0) {
      const termsChanged = editing.sale_price !== totalSalePrice ||
        editing.duration_months !== form.duration_months ||
        editing.first_installment_date !== form.first_installment_date;
      if (!termsChanged) {
        schedule = editing.installment_schedule;
      } else {
        // Terms changed: regenerate but carry over payment data by month number
        const oldByMonth = new Map(editing.installment_schedule.map((inst: any) => [inst.month, inst]));
        schedule = newSchedule.map((inst: any) => {
          const old = oldByMonth.get(inst.month);
          if (old && (old.status === 'paid' || old.status === 'partially_paid')) {
            return { ...inst, status: old.status, paid_amount: old.paid_amount || 0 };
          }
          return inst;
        });
      }
    }

    const lastDate = schedule.length > 0 ? schedule[schedule.length - 1].due_date : form.start_date;
    const data: any = {
      customer_id: form.customer_id, customer_name: customer?.name || '',
      items: form.items,
      item_name: form.items.map(i => i.item_name).join(', '),
      category: form.items.map(i => i.category).join(', '),
      model_type: form.items.map(i => i.model_type).join(', '),
      purchase_price: form.items.reduce((s, i) => s + (i.purchase_price || 0) * (i.quantity || 1), 0),
      sale_price: totalSalePrice,
      file_opening_charges: form.file_opening_charges,
      duration_months: form.duration_months,
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
      const { error } = await supabase.from('contracts').update(data).eq('id', editing.id);
      if (error) { console.error('Contract update error:', error); alert(`Failed to update contract: ${error.message}`); return; }
    } else {
      data.contract_no = await generateContractNo();
      const { error } = await supabase.from('contracts').insert(data);
      if (error) { console.error('Contract insert error:', error); alert(`Failed to create contract: ${error.message}`); return; }
      // Deduct quantity from inventory
      for (const item of form.items) {
        if (item.purchase_id) {
          const purchase = purchases.find(p => p.id === item.purchase_id);
          if (purchase) {
            const newAvail = Math.max(0, (purchase.quantity_available ?? purchase.quantity ?? 1) - (item.quantity || 1));
            await supabase.from('purchases').update({
              quantity_available: newAvail,
              status: newAvail <= 0 ? 'sold' : 'in_stock'
            }).eq('id', item.purchase_id);
          }
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
      items: c.items && c.items.length > 0 ? c.items.map((i: any) => ({ ...emptyItem, ...i })) : [{ purchase_id: '', item_name: c.item_name || '', model_type: c.model_type || '', category: c.category || '', purchase_price: c.purchase_price || 0, profit_percentage: 0, sale_price: c.sale_price || 0 }],
      file_opening_charges: c.file_opening_charges,
      duration_months: c.duration_months, start_date: c.start_date,
      first_installment_date: c.first_installment_date, payment_mode: c.payment_mode,
      status: c.status, attachments: c.attachments || [],
    });
    setShowDialog(true);
  }

  const filtered = contracts.filter(c => {
    const matchesSearch = c.contract_no?.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.item_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'functional' && (c.status === 'functional' || c.status === 'ongoing')) ||
      (statusFilter === 'closed' && (c.status === 'finished' || c.status === 'closed')) ||
      (statusFilter === 'legal_case' && c.status === 'legal_case') ||
      (statusFilter === 'case_closed' && c.status === 'case_closed');
    return matchesSearch && matchesStatus;
  });
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusColor = (s: string) => {
    if (s === 'ongoing' || s === 'functional') return 'bg-blue-100 text-blue-700';
    if (s === 'finished') return 'bg-green-100 text-green-700';
    if (s === 'case_closed' || s === 'legal_case') return 'bg-purple-100 text-purple-700';
    return 'bg-red-100 text-red-700';
  };

  const getContractPaid = (c: Contract) => {
    const schedule = c.installment_schedule || [];
    if (schedule.length === 0) return c.paid_amount || 0;
    return schedule.reduce((sum: number, s: any) => sum + (s.status === 'paid' ? (s.amount || 0) : (s.paid_amount || 0)), 0);
  };
  const getContractRemaining = (c: Contract) => (c.sale_price || 0) - getContractPaid(c);

  const exportHeaders = [t('contractNo'), t('customerName'), t('itemName'), t('salePrice'), t('paidAmount'), t('remainingAmount'), t('status')];
  const exportRows = filtered.map(c => [c.contract_no, c.customer_name, c.item_name, c.sale_price, getContractPaid(c), getContractRemaining(c), c.status]);

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

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder={t('search')} value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="ps-9" />
          </div>
          <div className="flex items-center gap-2">
            <DatePicker value={fromDate} onChange={setFromDate} placeholder={t('from')} />
            <span className="text-slate-400">-</span>
            <DatePicker value={toDate} onChange={setToDate} placeholder={t('to')} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: t('all') || 'All' },
            { key: 'functional', label: t('functional') },
            { key: 'closed', label: t('closed') },
            { key: 'legal_case', label: t('legalCase') },
            { key: 'case_closed', label: t('caseClosed') },
          ].map(opt => (
            <Button
              key={opt.key}
              variant={statusFilter === opt.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(opt.key); setCurrentPage(1); }}
              className={statusFilter === opt.key ? 'bg-blue-600 text-white' : ''}
            >
              {opt.label}
            </Button>
          ))}
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
            <>
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
                  {paginated.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-blue-600 cursor-pointer" onClick={() => setShowSchedule(c)}>{c.contract_no}</td>
                      <td className="py-3 px-4">{c.customer_name}</td>
                      <td className="py-3 px-4">{c.item_name}</td>
                      <td className="py-3 px-4">{c.sale_price?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-green-600">{getContractPaid(c).toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-red-600">{getContractRemaining(c).toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4"><Badge className={statusColor(c.status)} variant="secondary">{t(c.status as any)}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setShowForm(c)}><Printer className="h-4 w-4 text-blue-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

      {/* Printable Contract Form */}
      <Dialog open={!!showForm} onOpenChange={() => setShowForm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{t('contractForm')}</span>
              <Button size="sm" variant="outline" onClick={() => { const el = document.getElementById('contract-print-form'); if (el) { const w = window.open('', '_blank'); if (w) { w.document.write('<html><head><title>' + (showForm?.contract_no || '') + '</title><style>body{font-family:Arial,sans-serif;padding:30px;direction:ltr}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}th{background:#f5f5f5;font-weight:600}.header{text-align:center;margin-bottom:20px}.header h1{font-size:20px;margin:5px 0}.header h2{font-size:16px;color:#555;margin:5px 0}.section{margin:15px 0}.section-title{font-size:14px;font-weight:bold;background:#f0f0f0;padding:8px;margin-bottom:5px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.info-item{font-size:13px}.info-label{color:#666;font-weight:600}.footer{margin-top:40px;display:flex;justify-content:space-between}.sig-block{text-align:center;width:200px}.sig-line{border-top:1px solid #333;margin-top:60px;padding-top:5px;font-size:12px}@media print{body{padding:20px}}</style></head><body>' + el.innerHTML + '</body></html>'); w.document.close(); w.print(); } } }}>
                <Printer className="h-4 w-4 me-1" /> {t('print')}
              </Button>
            </DialogTitle>
          </DialogHeader>
          {showForm && (
            <div id="contract-print-form">
              <div className="text-center border-b pb-4 mb-4">
                <h1 className="text-xl font-bold">{t('appName')}</h1>
                <h2 className="text-lg text-slate-600">{t('contractForm')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div><span className="text-slate-500 font-medium">{t('contractNo')}:</span> <span className="font-bold">{showForm.contract_no}</span></div>
                <div><span className="text-slate-500 font-medium">{t('startDate')}:</span> <span>{showForm.start_date}</span></div>
                <div><span className="text-slate-500 font-medium">{t('customerName')}:</span> <span className="font-bold">{showForm.customer_name}</span></div>
                <div><span className="text-slate-500 font-medium">{t('endDate')}:</span> <span>{showForm.end_date || showForm.last_installment_date}</span></div>
                <div><span className="text-slate-500 font-medium">{t('paymentMode')}:</span> <span>{t(showForm.payment_mode as any) || showForm.payment_mode}</span></div>
                <div><span className="text-slate-500 font-medium">{t('status')}:</span> <span>{t(showForm.status as any) || showForm.status}</span></div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm bg-slate-100 p-2 rounded mb-2">{t('items')}</h3>
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border p-2 text-start">#</th>
                      <th className="border p-2 text-start">{t('itemName')}</th>
                      <th className="border p-2 text-start">{t('modelType')}</th>
                      <th className="border p-2 text-start">{t('category')}</th>
                      <th className="border p-2 text-end">{t('purchasePrice')}</th>
                      <th className="border p-2 text-end">{t('salePrice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showForm.items && showForm.items.length > 0 ? showForm.items : [{ item_name: showForm.item_name, model_type: showForm.model_type, category: showForm.category, purchase_price: showForm.purchase_price, sale_price: showForm.sale_price }]).map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="border p-2">{i + 1}</td>
                        <td className="border p-2">{item.item_name}</td>
                        <td className="border p-2">{item.model_type}</td>
                        <td className="border p-2">{item.category}</td>
                        <td className="border p-2 text-end">{(item.purchase_price || 0).toLocaleString()} {t('kd')}</td>
                        <td className="border p-2 text-end">{(item.sale_price || 0).toLocaleString()} {t('kd')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm bg-slate-100 p-2 rounded mb-2">{t('installmentSummary')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-blue-50 rounded p-3"><p className="text-blue-600 text-xs">{t('salePrice')}</p><p className="font-bold">{showForm.sale_price?.toLocaleString()} {t('kd')}</p></div>
                  <div className="bg-slate-50 rounded p-3"><p className="text-slate-500 text-xs">{t('fileOpeningCharges')}</p><p className="font-bold">{showForm.file_opening_charges?.toLocaleString()} {t('kd')}</p></div>
                  <div className="bg-green-50 rounded p-3"><p className="text-green-600 text-xs">{t('paidAmount')}</p><p className="font-bold text-green-700">{getContractPaid(showForm).toLocaleString()} {t('kd')}</p></div>
                  <div className="bg-red-50 rounded p-3"><p className="text-red-600 text-xs">{t('remainingAmount')}</p><p className="font-bold text-red-700">{getContractRemaining(showForm).toLocaleString()} {t('kd')}</p></div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mt-3">
                  <div><span className="text-slate-500">{t('duration')}:</span> <span className="font-medium">{showForm.duration_months} {t('months')}</span></div>
                  <div><span className="text-slate-500">{t('installmentValue')}:</span> <span className="font-medium">{showForm.installment_amount?.toFixed(3)} {t('kd')}</span></div>
                  <div><span className="text-slate-500">{t('firstInstallmentDate')}:</span> <span className="font-medium">{showForm.first_installment_date}</span></div>
                </div>
              </div>

              {showForm.installment_schedule && showForm.installment_schedule.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-bold text-sm bg-slate-100 p-2 rounded mb-2">{t('installmentSchedule')}</h3>
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border p-2 text-start">#</th>
                        <th className="border p-2 text-start">{t('dueDate')}</th>
                        <th className="border p-2 text-end">{t('amount')}</th>
                        <th className="border p-2 text-start">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showForm.installment_schedule.map((inst: any, i: number) => (
                        <tr key={i} className={inst.status === 'paid' ? 'bg-green-50' : inst.status === 'partially_paid' ? 'bg-amber-50' : ''}>
                          <td className="border p-2">{inst.month || i + 1}</td>
                          <td className="border p-2">{inst.due_date}</td>
                          <td className="border p-2 text-end">{inst.amount?.toLocaleString()} {t('kd')}</td>
                          <td className="border p-2">{inst.status === 'paid' ? t('paid') : inst.status === 'partially_paid' ? `${t('partiallyPaid')} (${(inst.paid_amount || 0).toLocaleString()})` : t('pending')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-8 flex justify-between text-sm">
                <div className="text-center"><div className="border-t border-slate-400 mt-16 pt-2 w-48">{t('signature')} / {t('customerName')}</div></div>
                <div className="text-center"><div className="border-t border-slate-400 mt-16 pt-2 w-48">{t('signature')} / {t('appName')}</div></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Installment Schedule Modal */}
      <Dialog open={!!showSchedule} onOpenChange={() => setShowSchedule(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showSchedule?.contract_no} - {t('installmentPlan')}</DialogTitle>
          </DialogHeader>
          {showSchedule && (() => {
            const schedule = showSchedule.installment_schedule || [];
            const paidCount = schedule.filter((inst: any) => inst.status === 'paid').length;
            const partialCount = schedule.filter((inst: any) => inst.status === 'partially_paid').length;
            const pendingCount = schedule.length - paidCount - partialCount;
            const getEffectivePaid = (inst: any) => inst.status === 'paid' ? (inst.amount || 0) : (inst.paid_amount || 0);
            const totalPaidAmt = schedule.reduce((s: number, inst: any) => s + getEffectivePaid(inst), 0);
            const totalPendingAmt = schedule.reduce((s: number, inst: any) => s + ((inst.amount || 0) - getEffectivePaid(inst)), 0);
            const today = new Date();
            const overdueCount = schedule.filter((inst: any) => inst.status !== 'paid' && isBefore(new Date(inst.due_date), today)).length;
            return (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">{t('customerName')}</p>
                  <p className="font-semibold text-sm mt-1">{showSchedule.customer_name}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600">{t('salePrice')}</p>
                  <p className="font-semibold text-sm mt-1">{showSchedule.sale_price?.toLocaleString()} {t('kd')}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600">{t('paidInstallments')}</p>
                  <p className="font-semibold text-sm mt-1 text-green-700">{paidCount} / {schedule.length}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-amber-600">{partialCount > 0 ? t('partiallyPaid') : t('pendingInstallments')}</p>
                  <p className="font-semibold text-sm mt-1 text-amber-700">{partialCount > 0 ? `${partialCount} / ${pendingCount}` : pendingCount}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600">{t('totalPaidAmount')}</p>
                  <p className="font-semibold text-sm mt-1 text-green-700">{totalPaidAmt.toLocaleString()} {t('kd')}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-600">{t('totalPendingAmount')}</p>
                  <p className="font-semibold text-sm mt-1 text-red-700">{totalPendingAmt.toLocaleString()} {t('kd')}</p>
                </div>
              </div>

              {overdueCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700 font-medium">{overdueCount} {t('overdue')} installment{overdueCount > 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{t('paid')}: {totalPaidAmt.toLocaleString()} / {showSchedule.sale_price?.toLocaleString()} {t('kd')}</span>
                  <span>{Math.round(totalPaidAmt / Math.max(1, showSchedule.sale_price || 1) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${totalPaidAmt / Math.max(1, showSchedule.sale_price || 1) * 100}%` }} />
                </div>
              </div>

              {/* Installment Table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-start py-2.5 px-3 font-medium text-slate-600">#</th>
                    <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('dueDate')}</th>
                    <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('amount')}</th>
                    <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('paid')}</th>
                    <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('remaining')}</th>
                    <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('status')}</th>
                    <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('paymentDate')}</th>
                    {canTogglePayment && <th className="text-center py-2.5 px-3 font-medium text-slate-600">{t('paid')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((inst: any, i: number) => {
                    const instPaid = inst.status === 'paid' ? (inst.amount || 0) : (inst.paid_amount || 0);
                    const instRemaining = (inst.amount || 0) - instPaid;
                    const isOverdue = inst.status !== 'paid' && isBefore(new Date(inst.due_date), today);
                    return (
                    <tr key={i} className={`border-b border-slate-100 ${inst.status === 'paid' ? 'bg-green-50/50' : inst.status === 'partially_paid' ? 'bg-amber-50/50' : isOverdue ? 'bg-red-50/50' : ''}`}>
                      <td className="py-2.5 px-3 font-medium">{inst.month || i + 1}</td>
                      <td className="py-2.5 px-3">{inst.due_date}</td>
                      <td className="py-2.5 px-3 font-medium">{inst.amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-2.5 px-3 text-green-600">{instPaid > 0 ? instPaid.toLocaleString() : '-'} {instPaid > 0 && t('kd')}</td>
                      <td className="py-2.5 px-3 text-red-600">{instRemaining > 0 ? instRemaining.toLocaleString() : '0'} {t('kd')}</td>
                      <td className="py-2.5 px-3">
                        <Badge className={inst.status === 'paid' ? 'bg-green-100 text-green-700' : inst.status === 'partially_paid' ? 'bg-amber-100 text-amber-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'} variant="secondary">
                          {inst.status === 'paid' ? t('paid') : inst.status === 'partially_paid' ? t('partiallyPaid') : isOverdue ? t('overdue') : t('pending')}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{inst.paid_date || '-'}</td>
                      {canTogglePayment && (
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={inst.status === 'paid' || inst.status === 'partially_paid'}
                            onChange={(e) => toggleInstallmentPayment(showSchedule!, i, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                      )}
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

      {/* Add/Edit Contract Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('editContract') : t('addContract')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('customer')} *</Label>
              <SearchableSelect
                options={customers.map(c => ({ value: c.id, label: `${c.customer_no} - ${c.name}` }))}
                value={form.customer_id}
                onChange={(v) => setForm({ ...form, customer_id: v })}
                placeholder={t('selectCustomer') || 'Select Customer'}
              />
            </div>

            {/* Multiple Items Section */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t('items')} *</h3>
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
                    <div className="md:col-span-3">
                      <Label className="text-xs">{t('selectProduct')}</Label>
                      <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={item.purchase_id} onChange={e => updateItem(idx, 'purchase_id', e.target.value)}>
                        <option value="">Select from inventory</option>
                        {purchases.map(p => <option key={p.id} value={p.id}>{p.item_name} - {p.model_type} ({p.category}) [{t('available')}: {p.quantity_available ?? p.quantity ?? 1}]</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('purchasePrice')}</Label>
                      <Input className="h-9" type="number" value={item.purchase_price} onChange={e => updateItem(idx, 'purchase_price', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('profitPercentage')}</Label>
                      <Input className="h-9" type="number" value={item.profit_percentage} onChange={e => updateItem(idx, 'profit_percentage', Number(e.target.value))} placeholder="e.g. 20" />
                    </div>
                    <div>
                      <Label className="text-xs">{t('salePrice')} *</Label>
                      <Input className="h-9" type="number" value={item.sale_price} onChange={e => updateItem(idx, 'sale_price', Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('quantity')} *</Label>
                      <Input className="h-9" type="number" min={1} max={item.purchase_id ? (purchases.find(p => p.id === item.purchase_id)?.quantity_available ?? 1) : 9999} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                      {item.purchase_id && <p className="text-xs text-slate-500 mt-0.5">{t('available')}: {purchases.find(p => p.id === item.purchase_id)?.quantity_available ?? '?'}</p>}
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
                <Label>{t('duration')}</Label>
                <Input type="number" value={form.duration_months} onChange={e => setForm({ ...form, duration_months: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('startDate')}</Label>
                <DatePicker value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} placeholder={t('startDate')} className="w-full" />
              </div>
              <div>
                <Label>{t('firstInstallmentDate')}</Label>
                <DatePicker value={form.first_installment_date} onChange={(v) => {
                  if (v < form.start_date) { alert(t('firstInstallmentBeforeStart') || 'First installment date cannot be before start date'); return; }
                  setForm({ ...form, first_installment_date: v });
                }} placeholder={t('firstInstallmentDate')} className="w-full" />
              </div>
              <div>
                <Label>{t('paymentMode')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                  {paymentModes.map(m => <option key={m} value={m}>{t(m as any) || m}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('status')} *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => {
                  if (form.status && e.target.value !== form.status) {
                    if (!window.confirm(t('confirmStatusChange'))) return;
                  }
                  setForm({ ...form, status: e.target.value });
                }}>
                  <option value="ongoing">{t('functional')}</option>
                  <option value="finished">{t('closed')}</option>
                  <option value="legal_case">{t('legalCase')}</option>
                  <option value="case_closed">{t('caseClosed')}</option>
                </select>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900">{t('installmentSummary')}</h4>
              <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
                <div><p className="text-blue-600">{t('totalSalePrice')}</p><p className="font-bold">{getTotalSalePrice().toLocaleString()} {t('kd')}</p></div>
                <div><p className="text-blue-600">{t('fileOpeningCharges')}</p><p className="font-bold">{form.file_opening_charges.toLocaleString()} {t('kd')}</p></div>
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
