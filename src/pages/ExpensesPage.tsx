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
import { Plus, Search, Pencil, Trash2, Receipt, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Expense {
  id: string; expense_voucher_no: string; expense_date: string; expense_type: string;
  amount: number; description: string; case_no: string; customer_id: string;
  customer_name: string; contract_id: string; contract_no: string; attachments: string[]; created_at: string;
}

interface Customer { id: string; customer_no: string; name: string; }
interface Contract { id: string; contract_no: string; customer_name: string; customer_id: string; }
interface LegalCase { id: string; case_no: string; customer_id: string; customer_name: string; }

const defaultExpenseTypes = ['rent', 'salaries', 'courtFees', 'lawyerFees', 'utilities', 'office', 'transport', 'other'];

const defaultForm = {
  expense_date: format(new Date(), 'yyyy-MM-dd'),
  expense_type: 'rent', amount: 0, description: '',
  case_no: '', customer_id: '', contract_id: '', attachments: [] as string[],
};

export default function ExpensesPage() {
  const { t } = useLang();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [legalCases, setLegalCases] = useState<LegalCase[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [expenseTypes, setExpenseTypes] = useState<string[]>(defaultExpenseTypes);
  const [newExpenseType, setNewExpenseType] = useState('');
  const [showNewType, setShowNewType] = useState(false);

  useEffect(() => { loadData(); }, [fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    let expQuery = supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (fromDate) expQuery = expQuery.gte('expense_date', fromDate);
    if (toDate) expQuery = expQuery.lte('expense_date', toDate);
    const [expRes, custRes, contRes, legalRes] = await Promise.all([
      expQuery,
      supabase.from('customers').select('id, customer_no, name'),
      supabase.from('contracts').select('id, contract_no, customer_name, customer_id'),
      supabase.from('legal_cases').select('id, case_no, customer_id, customer_name'),
    ]);
    setExpenses(expRes.data || []);
    setCustomers(custRes.data || []);
    setAllContracts(contRes.data || []);
    setLegalCases(legalRes.data || []);
    // Collect unique expense types from existing data
    const existingTypes = new Set(defaultExpenseTypes);
    (expRes.data || []).forEach((e: any) => { if (e.expense_type) existingTypes.add(e.expense_type); });
    setExpenseTypes([...existingTypes]);
    setLoading(false);
  }

  // Filter contracts by selected customer
  const filteredContracts = form.customer_id
    ? allContracts.filter(c => c.customer_id === form.customer_id)
    : allContracts;

  // Filter legal cases by selected customer
  const filteredCases = form.customer_id
    ? legalCases.filter(lc => lc.customer_id === form.customer_id)
    : legalCases;

  function addNewExpenseType() {
    if (newExpenseType.trim() && !expenseTypes.includes(newExpenseType.trim())) {
      setExpenseTypes([...expenseTypes, newExpenseType.trim()]);
      setForm({ ...form, expense_type: newExpenseType.trim() });
    }
    setNewExpenseType(''); setShowNewType(false);
  }

  async function handleSave() {
    const customer = customers.find(c => c.id === form.customer_id);
    const contract = allContracts.find(c => c.id === form.contract_id);
    const data = {
      expense_date: form.expense_date, expense_type: form.expense_type,
      amount: form.amount, description: form.description, case_no: form.case_no,
      customer_id: form.customer_id || null, customer_name: customer?.name || '',
      contract_id: form.contract_id || null, contract_no: contract?.contract_no || '',
      attachments: form.attachments,
    };
    if (editing) {
      await supabase.from('expenses').update(data).eq('id', editing.id);
    } else {
      await supabase.from('expenses').insert(data);
    }
    setShowDialog(false); setForm(defaultForm); setEditing(null); loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    loadData();
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      expense_date: e.expense_date, expense_type: e.expense_type, amount: e.amount,
      description: e.description, case_no: e.case_no, customer_id: e.customer_id || '',
      contract_id: e.contract_id || '', attachments: e.attachments || [],
    });
    setShowDialog(true);
  }

  const filtered = expenses.filter(e =>
    e.expense_voucher_no?.toLowerCase().includes(search.toLowerCase()) ||
    e.expense_type?.toLowerCase().includes(search.toLowerCase()) ||
    e.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  const exportHeaders = [t('expenseVoucherNo'), t('expenseDate'), t('expenseType'), t('amount'), t('description'), t('customerName'), t('contractNo'), t('caseNo')];
  const exportRows = filtered.map(e => [e.expense_voucher_no, e.expense_date, e.expense_type, e.amount, e.description, e.customer_name, e.contract_no, e.case_no]);

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      rent: 'bg-blue-100 text-blue-700', salaries: 'bg-green-100 text-green-700',
      courtFees: 'bg-red-100 text-red-700', lawyerFees: 'bg-purple-100 text-purple-700',
      utilities: 'bg-yellow-100 text-yellow-700', office: 'bg-slate-100 text-slate-700',
      transport: 'bg-cyan-100 text-cyan-700', other: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('expenses')}</h1>
          <p className="text-slate-500 text-sm">{t('total')}: {totalExpenses.toLocaleString()} {t('kd')}</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('expenses')} headers={exportHeaders} rows={exportRows} filename="expenses" />
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addExpense')}
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
              <Receipt className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('expenseVoucherNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('expenseDate')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('expenseType')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('amount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('caseNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-blue-600">{e.expense_voucher_no}</td>
                      <td className="py-3 px-4">{e.expense_date}</td>
                      <td className="py-3 px-4"><Badge className={typeColor(e.expense_type)} variant="secondary">{e.expense_type}</Badge></td>
                      <td className="py-3 px-4 font-medium">{e.amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">{e.customer_name}</td>
                      <td className="py-3 px-4">{e.case_no}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
            <DialogTitle>{editing ? t('editExpense') : t('addExpense')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('expenseDate')}</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div>
                <Label>{t('expenseType')} *</Label>
                <div className="flex gap-2">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.expense_type} onChange={e => setForm({ ...form, expense_type: e.target.value })}>
                    {expenseTypes.map(et => <option key={et} value={et}>{et}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowNewType(true)}><Plus className="h-3 w-3" /></Button>
                </div>
                {showNewType && (
                  <div className="flex gap-2 mt-2">
                    <Input placeholder={t('newExpenseType')} value={newExpenseType} onChange={e => setNewExpenseType(e.target.value)} className="h-8 text-sm" />
                    <Button size="sm" onClick={addNewExpenseType} className="h-8">{t('add')}</Button>
                  </div>
                )}
              </div>
              <div>
                <Label>{t('amount')} *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('relatedCustomer')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value, contract_id: '', case_no: '' })}>
                  <option value="">None</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customer_no} - {c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('relatedContract')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.contract_id} onChange={e => setForm({ ...form, contract_id: e.target.value })}>
                  <option value="">None</option>
                  {filteredContracts.map(c => <option key={c.id} value={c.id}>{c.contract_no} - {c.customer_name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('caseNo')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.case_no} onChange={e => setForm({ ...form, case_no: e.target.value })}>
                  <option value="">None</option>
                  {filteredCases.map(lc => <option key={lc.id} value={lc.case_no}>{lc.case_no} - {lc.customer_name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>{t('description')}</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <FileAttachment bucket="expenses" folder={editing?.id || 'new'} files={form.attachments} onFilesChange={files => setForm({ ...form, attachments: files })} />
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
