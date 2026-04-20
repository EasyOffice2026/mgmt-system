import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { DataExport } from '@/components/shared/DataExport';
import {
  Plus, Trash2, Calculator, TrendingUp, TrendingDown, DollarSign, Users,
  ShoppingCart, Receipt, FileText, BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  Briefcase, Gavel, Lock
} from 'lucide-react';

type AccountSection = 'overview' | 'sales' | 'purchases' | 'fileCharges' | 'expenses' | 'receipts' | 'operational' | 'legal' | 'caseClosed';

interface MonthlySummary {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalReceipts: number;
  totalFileCharges: number;
  dueFromCustomers: number;
  dueFromCourt: number;
  remainingFromCourt: number;
  netIncome: number;
  operationalCount: number;
  finishedCount: number;
  legalCount: number;
  caseClosedCount: number;
  operationalValue: number;
  finishedValue: number;
  legalValue: number;
  caseClosedValue: number;
  avgSalePrice: number;
  avgPurchasePrice: number;
  avgExpense: number;
  avgReceipt: number;
  salesCount: number;
  purchasesCount: number;
  expensesCount: number;
  receiptsCount: number;
}

interface Partner {
  id: string;
  partner_name: string;
  contribution: number;
  amount_received: number;
  share_percentage: number;
  created_at: string;
}

interface DetailRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  status?: string;
  customer?: string;
}

const defaultPartner = { partner_name: '', contribution: 0, amount_received: 0, share_percentage: 0 };

export default function AccountingPage() {
  const { t } = useLang();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summary, setSummary] = useState<MonthlySummary>({
    totalSales: 0, totalPurchases: 0, totalExpenses: 0, totalReceipts: 0, totalFileCharges: 0,
    dueFromCustomers: 0, dueFromCourt: 0, remainingFromCourt: 0, netIncome: 0,
    operationalCount: 0, finishedCount: 0, legalCount: 0, caseClosedCount: 0,
    operationalValue: 0, finishedValue: 0, legalValue: 0, caseClosedValue: 0,
    avgSalePrice: 0, avgPurchasePrice: 0, avgExpense: 0, avgReceipt: 0,
    salesCount: 0, purchasesCount: 0, expensesCount: 0, receiptsCount: 0,
  });
  const [partners, setPartners] = useState<Partner[]>([]);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [partnerForm, setPartnerForm] = useState(defaultPartner);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AccountSection>('overview');
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);

  useEffect(() => { loadData(); }, [selectedMonth]);

  async function loadData() {
    setLoading(true);
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const [contractsRes, allContractsRes, purchasesRes, expensesRes, receiptsRes, legalRes, partnersRes] = await Promise.all([
      supabase.from('contracts').select('*').gte('start_date', startDate).lte('start_date', endDate),
      supabase.from('contracts').select('*'),
      supabase.from('purchases').select('*').gte('purchase_date', startDate).lte('purchase_date', endDate),
      supabase.from('expenses').select('*').gte('expense_date', startDate).lte('expense_date', endDate),
      supabase.from('receipt_vouchers').select('*').gte('receipt_date', startDate).lte('receipt_date', endDate),
      supabase.from('legal_cases').select('*'),
      supabase.from('partners').select('*').order('created_at', { ascending: true }),
    ]);

    const contracts = contractsRes.data || [];
    const allContracts = allContractsRes.data || [];
    const purchases = purchasesRes.data || [];
    const expenses = expensesRes.data || [];
    const receipts = receiptsRes.data || [];
    const legalCases = legalRes.data || [];

    const totalSales = contracts.reduce((sum: number, c: any) => sum + (c.sale_price || 0), 0);
    const totalPurchases = purchases.reduce((sum: number, p: any) => sum + (p.purchase_price || 0), 0);
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const totalReceipts = receipts.reduce((sum: number, r: any) => sum + (r.received_amount || 0), 0);
    const totalFileCharges = contracts.reduce((sum: number, c: any) => sum + (c.file_opening_charges || 0), 0);
    const dueFromCustomers = allContracts.reduce((sum: number, c: any) => sum + (c.remaining_amount || 0), 0);
    const dueFromCourt = legalCases.reduce((sum: number, lc: any) => sum + (lc.case_amount || 0), 0);
    const remainingFromCourt = dueFromCourt - legalCases.reduce((sum: number, lc: any) => sum + (lc.rcvd_from_court || 0), 0);

    const operationalCount = allContracts.filter((c: any) => c.status === 'functional' || c.status === 'ongoing').length;
    const finishedCount = allContracts.filter((c: any) => c.status === 'finished').length;
    const legalCount = allContracts.filter((c: any) => c.status === 'legal_case').length;
    const caseClosedCount = allContracts.filter((c: any) => c.status === 'case_closed').length;

    const operationalValue = allContracts.filter((c: any) => c.status === 'functional' || c.status === 'ongoing').reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const finishedValue = allContracts.filter((c: any) => c.status === 'finished').reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const legalValue = allContracts.filter((c: any) => c.status === 'legal_case').reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const caseClosedValue = allContracts.filter((c: any) => c.status === 'case_closed').reduce((s: number, c: any) => s + (c.sale_price || 0), 0);

    setSummary({
      totalSales, totalPurchases, totalExpenses, totalReceipts, totalFileCharges,
      dueFromCustomers, dueFromCourt, remainingFromCourt,
      netIncome: totalReceipts - totalExpenses - totalPurchases,
      operationalCount, finishedCount, legalCount, caseClosedCount,
      operationalValue, finishedValue, legalValue, caseClosedValue,
      avgSalePrice: contracts.length > 0 ? totalSales / contracts.length : 0,
      avgPurchasePrice: purchases.length > 0 ? totalPurchases / purchases.length : 0,
      avgExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0,
      avgReceipt: receipts.length > 0 ? totalReceipts / receipts.length : 0,
      salesCount: contracts.length,
      purchasesCount: purchases.length,
      expensesCount: expenses.length,
      receiptsCount: receipts.length,
    });
    setPartners(partnersRes.data || []);
    setLoading(false);
  }

  async function loadSectionDetail(section: AccountSection) {
    setActiveSection(section);
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;
    let rows: DetailRow[] = [];

    if (section === 'sales') {
      const res = await supabase.from('contracts').select('*').gte('start_date', startDate).lte('start_date', endDate);
      rows = (res.data || []).map((c: any) => ({
        id: c.id, date: c.start_date || '', description: `${c.contract_no} - ${c.customer_name || ''}`,
        amount: c.sale_price || 0, category: c.item_name || '', customer: c.customer_name || '', status: c.status || '',
      }));
    } else if (section === 'purchases') {
      const res = await supabase.from('purchases').select('*').gte('purchase_date', startDate).lte('purchase_date', endDate);
      rows = (res.data || []).map((p: any) => ({
        id: p.id, date: p.purchase_date || '', description: `${p.invoice_no || ''} - ${p.item_name || ''}`,
        amount: p.purchase_price || 0, category: p.supplier_name || '',
      }));
    } else if (section === 'fileCharges') {
      const res = await supabase.from('contracts').select('*').gte('start_date', startDate).lte('start_date', endDate);
      rows = (res.data || []).filter((c: any) => (c.file_opening_charges || 0) > 0).map((c: any) => ({
        id: c.id, date: c.start_date || '', description: `${c.contract_no} - ${c.customer_name || ''}`,
        amount: c.file_opening_charges || 0, customer: c.customer_name || '',
      }));
    } else if (section === 'expenses') {
      const res = await supabase.from('expenses').select('*').gte('expense_date', startDate).lte('expense_date', endDate);
      rows = (res.data || []).map((e: any) => ({
        id: e.id, date: e.expense_date || '', description: `${e.expense_voucher_no || ''} - ${e.expense_type || ''}`,
        amount: e.amount || 0, category: e.expense_type || '',
      }));
    } else if (section === 'receipts') {
      const res = await supabase.from('receipt_vouchers').select('*').gte('receipt_date', startDate).lte('receipt_date', endDate);
      rows = (res.data || []).map((r: any) => ({
        id: r.id, date: r.receipt_date || '', description: `${r.receipt_voucher_no || ''} - ${r.receipt_type || ''}`,
        amount: r.received_amount || 0, category: r.receipt_type || '', customer: r.customer_name || '',
      }));
    } else if (section === 'operational') {
      const res = await supabase.from('contracts').select('*');
      rows = (res.data || []).filter((c: any) => c.status === 'functional' || c.status === 'ongoing').map((c: any) => ({
        id: c.id, date: c.start_date || '', description: `${c.contract_no} - ${c.customer_name || ''}`,
        amount: c.sale_price || 0, customer: c.customer_name || '', status: c.status || '',
      }));
    } else if (section === 'legal') {
      const res = await supabase.from('legal_cases').select('*');
      rows = (res.data || []).map((lc: any) => ({
        id: lc.id, date: lc.case_date || '', description: `${lc.case_no || ''} - ${lc.customer_name || ''}`,
        amount: lc.case_amount || 0, customer: lc.customer_name || '',
      }));
    } else if (section === 'caseClosed') {
      const res = await supabase.from('contracts').select('*');
      rows = (res.data || []).filter((c: any) => c.status === 'case_closed').map((c: any) => ({
        id: c.id, date: c.start_date || '', description: `${c.contract_no} - ${c.customer_name || ''}`,
        amount: c.sale_price || 0, customer: c.customer_name || '', status: c.status || '',
      }));
    }
    setDetailRows(rows);
  }

  async function handleSavePartner() {
    await supabase.from('partners').insert(partnerForm);
    setShowPartnerDialog(false);
    setPartnerForm(defaultPartner);
    loadData();
  }

  async function handleDeletePartner(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('partners').delete().eq('id', id);
    loadData();
  }

  const chartData = useMemo(() => {
    const totalCases = summary.operationalCount + summary.finishedCount + summary.legalCount + summary.caseClosedCount;
    return [
      { label: t('operationalCases'), count: summary.operationalCount, value: summary.operationalValue, color: 'bg-blue-500', pct: totalCases > 0 ? (summary.operationalCount / totalCases * 100) : 0 },
      { label: t('finishedCases'), count: summary.finishedCount, value: summary.finishedValue, color: 'bg-green-500', pct: totalCases > 0 ? (summary.finishedCount / totalCases * 100) : 0 },
      { label: t('legalCase'), count: summary.legalCount, value: summary.legalValue, color: 'bg-red-500', pct: totalCases > 0 ? (summary.legalCount / totalCases * 100) : 0 },
      { label: t('caseClosed'), count: summary.caseClosedCount, value: summary.caseClosedValue, color: 'bg-purple-500', pct: totalCases > 0 ? (summary.caseClosedCount / totalCases * 100) : 0 },
    ];
  }, [summary, t]);

  const revenueExpenseData = useMemo(() => {
    const maxVal = Math.max(summary.totalReceipts, summary.totalExpenses, summary.totalPurchases, summary.totalSales, 1);
    return [
      { label: t('totalSales'), value: summary.totalSales, color: 'bg-blue-500', pct: (summary.totalSales / maxVal * 100) },
      { label: t('totalReceived'), value: summary.totalReceipts, color: 'bg-green-500', pct: (summary.totalReceipts / maxVal * 100) },
      { label: t('totalPurchases'), value: summary.totalPurchases, color: 'bg-amber-500', pct: (summary.totalPurchases / maxVal * 100) },
      { label: t('totalExpenses'), value: summary.totalExpenses, color: 'bg-red-500', pct: (summary.totalExpenses / maxVal * 100) },
    ];
  }, [summary, t]);

  const sectionButtons: { key: AccountSection; label: string; icon: any; color: string }[] = [
    { key: 'overview', label: t('accounting'), icon: BarChart3, color: 'bg-slate-600' },
    { key: 'sales', label: t('totalSales'), icon: ShoppingCart, color: 'bg-blue-600' },
    { key: 'purchases', label: t('totalPurchases'), icon: DollarSign, color: 'bg-amber-600' },
    { key: 'fileCharges', label: t('fileOpeningCharges') || 'File Charges', icon: FileText, color: 'bg-teal-600' },
    { key: 'expenses', label: t('totalExpenses'), icon: TrendingDown, color: 'bg-red-600' },
    { key: 'receipts', label: t('receiptVouchers') || 'Receipts', icon: Receipt, color: 'bg-green-600' },
    { key: 'operational', label: t('operationalCases'), icon: Briefcase, color: 'bg-blue-500' },
    { key: 'legal', label: t('legalCase'), icon: Gavel, color: 'bg-red-500' },
    { key: 'caseClosed', label: t('caseClosed'), icon: Lock, color: 'bg-purple-500' },
  ];

  const detailTotal = detailRows.reduce((s, r) => s + r.amount, 0);
  const detailAvg = detailRows.length > 0 ? detailTotal / detailRows.length : 0;

  const exportHeaders = [t('totalSales'), t('totalPurchases'), t('totalExpenses'), t('dueFromCustomers'), t('remainingFromCourt'), t('netIncome')];
  const exportRows = [[summary.totalSales, summary.totalPurchases, summary.totalExpenses, summary.dueFromCustomers, summary.remainingFromCourt, summary.netIncome]];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('accounting')}</h1>
          <p className="text-slate-500 text-sm">{t('monthlySummary')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-44" />
          <DataExport title={`${t('accounting')} - ${selectedMonth}`} headers={exportHeaders} rows={exportRows} filename={`accounting-${selectedMonth}`} />
        </div>
      </div>

      {/* Section Selector */}
      <div className="flex flex-wrap gap-2">
        {sectionButtons.map(btn => (
          <Button
            key={btn.key}
            variant={activeSection === btn.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => btn.key === 'overview' ? setActiveSection('overview') : loadSectionDetail(btn.key)}
            className={activeSection === btn.key ? `${btn.color} text-white` : ''}
          >
            <btn.icon className="h-4 w-4 me-1" />
            {btn.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">{t('loading')}</div>
      ) : activeSection === 'overview' ? (
        <>
          {/* KPI Summary Cards Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => loadSectionDetail('sales')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('totalSales')}</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">{summary.totalSales.toLocaleString()} {t('kd')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{summary.salesCount} {t('contracts')}</span>
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs text-slate-400">{t('average')}: {summary.avgSalePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('kd')}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => loadSectionDetail('purchases')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('totalPurchases')}</p>
                    <p className="text-xl font-bold text-amber-600 mt-1">{summary.totalPurchases.toLocaleString()} {t('kd')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{summary.purchasesCount} items</span>
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs text-slate-400">{t('average')}: {summary.avgPurchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('kd')}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
                    <ShoppingCart className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => loadSectionDetail('expenses')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('totalExpenses')}</p>
                    <p className="text-xl font-bold text-red-600 mt-1">{summary.totalExpenses.toLocaleString()} {t('kd')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{summary.expensesCount} items</span>
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs text-slate-400">{t('average')}: {summary.avgExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('kd')}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                    <TrendingDown className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => loadSectionDetail('receipts')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('receiptVouchers') || 'Receipt Vouchers'}</p>
                    <p className="text-xl font-bold text-green-600 mt-1">{summary.totalReceipts.toLocaleString()} {t('kd')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{summary.receiptsCount} items</span>
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs text-slate-400">{t('average')}: {summary.avgReceipt.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('kd')}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                    <Receipt className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: File Charges + Due + Court + Net Income */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => loadSectionDetail('fileCharges')}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('fileOpeningCharges') || 'File Opening Charges'}</p>
                    <p className="text-xl font-bold text-teal-600 mt-1">{summary.totalFileCharges.toLocaleString()} {t('kd')}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('dueFromCustomers')}</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">{summary.dueFromCustomers.toLocaleString()} {t('kd')}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('remainingFromCourt')}</p>
                    <p className="text-xl font-bold text-indigo-600 mt-1">{summary.remainingFromCourt.toLocaleString()} {t('kd')}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Calculator className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('netIncome')}</p>
                    <p className={`text-xl font-bold mt-1 ${summary.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {summary.netIncome.toLocaleString()} {t('kd')}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {summary.netIncome >= 0 ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                      <span className={`text-xs ${summary.netIncome >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {summary.netIncome >= 0 ? t('profit') : t('loss')}
                      </span>
                    </div>
                  </div>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${summary.netIncome >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} flex items-center justify-center shadow-lg`}>
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses Bar Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  {t('monthlySummary')} - {selectedMonth}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {revenueExpenseData.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-semibold">{item.value.toLocaleString()} {t('kd')}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-5">
                      <div className={`${item.color} h-5 rounded-full transition-all duration-700 flex items-center justify-end pe-2`} style={{ width: `${Math.max(item.pct, 2)}%` }}>
                        {item.pct > 15 && <span className="text-[10px] text-white font-medium">{item.pct.toFixed(0)}%</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Case Status Distribution */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-600" />
                  {t('contractsByStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center mb-6">
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                      {(() => {
                        const total = summary.operationalCount + summary.finishedCount + summary.legalCount + summary.caseClosedCount;
                        if (total === 0) return <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />;
                        const segments = [
                          { pct: summary.operationalCount / total * 100, color: '#3b82f6' },
                          { pct: summary.finishedCount / total * 100, color: '#22c55e' },
                          { pct: summary.legalCount / total * 100, color: '#ef4444' },
                          { pct: summary.caseClosedCount / total * 100, color: '#a855f7' },
                        ];
                        let offset = 0;
                        return segments.map((seg, i) => {
                          const el = (
                            <circle key={i} cx="18" cy="18" r="15.5" fill="none" stroke={seg.color} strokeWidth="3"
                              strokeDasharray={`${seg.pct} ${100 - seg.pct}`} strokeDashoffset={-offset} transform="rotate(-90 18 18)" />
                          );
                          offset += seg.pct;
                          return el;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-slate-800">{summary.operationalCount + summary.finishedCount + summary.legalCount + summary.caseClosedCount}</span>
                      <span className="text-xs text-slate-500">{t('contracts')}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {chartData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1 -mx-2"
                      onClick={() => {
                        if (i === 0) loadSectionDetail('operational');
                        else if (i === 2) loadSectionDetail('legal');
                        else if (i === 3) loadSectionDetail('caseClosed');
                      }}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="text-sm text-slate-600">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold">{item.count}</span>
                        <span className="text-xs text-slate-400 ms-2">{item.value.toLocaleString()} {t('kd')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Partners Section */}
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('partnerContributions')}</CardTitle>
              <Button size="sm" onClick={() => setShowPartnerDialog(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className="h-4 w-4 me-1" /> {t('add')}
              </Button>
            </CardHeader>
            <CardContent>
              {partners.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <Users className="h-10 w-10 mx-auto mb-2" />
                  <p>{t('noData')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('partnerName')}</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('contribution')} ({t('kd')})</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('amountReceived')} ({t('kd')})</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('share')} (%)</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('profit')} ({t('kd')})</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map(p => {
                        const profitShare = (summary.netIncome * (p.share_percentage / 100));
                        return (
                          <tr key={p.id} className="border-b border-slate-100 hover:bg-blue-50/50">
                            <td className="py-3 px-4 font-medium">{p.partner_name}</td>
                            <td className="py-3 px-4">{p.contribution.toLocaleString()}</td>
                            <td className="py-3 px-4">{p.amount_received.toLocaleString()}</td>
                            <td className="py-3 px-4">{p.share_percentage}%</td>
                            <td className={`py-3 px-4 font-medium ${profitShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {profitShare.toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <Button variant="ghost" size="sm" onClick={() => handleDeletePartner(p.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* Detail View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 text-center">
                <p className="text-xs text-slate-500 font-medium">{t('totalReceived')}</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{detailTotal.toLocaleString()} {t('kd')}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 text-center">
                <p className="text-xs text-slate-500 font-medium">{t('average')}</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{detailAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('kd')}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5 text-center">
                <p className="text-xs text-slate-500 font-medium">{t('totalInstallments') || 'Count'}</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{detailRows.length}</p>
              </CardContent>
            </Card>
          </div>

          {detailRows.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {sectionButtons.find(b => b.key === activeSection)?.label || ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {detailRows.slice(0, 10).map((row, i) => {
                  const maxAmt = Math.max(...detailRows.map(r => r.amount), 1);
                  const pct = (row.amount / maxAmt) * 100;
                  return (
                    <div key={row.id || i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600 truncate max-w-[60%]">{row.description}</span>
                        <span className="font-semibold">{row.amount.toLocaleString()} {t('kd')}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-4">
                        <div className="bg-blue-500 h-4 rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-start py-3 px-4 font-medium text-slate-600">#</th>
                      <th className="text-start py-3 px-4 font-medium text-slate-600">{t('date') || 'Date'}</th>
                      <th className="text-start py-3 px-4 font-medium text-slate-600">{t('description') || 'Description'}</th>
                      {detailRows.some(r => r.customer) && <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customer') || 'Customer'}</th>}
                      {detailRows.some(r => r.category) && <th className="text-start py-3 px-4 font-medium text-slate-600">{t('category') || 'Category'}</th>}
                      <th className="text-start py-3 px-4 font-medium text-slate-600">{t('amount') || 'Amount'} ({t('kd')})</th>
                      {detailRows.some(r => r.status) && <th className="text-start py-3 px-4 font-medium text-slate-600">{t('status')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, i) => (
                      <tr key={row.id || i} className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="py-3 px-4 text-slate-400">{i + 1}</td>
                        <td className="py-3 px-4">{row.date}</td>
                        <td className="py-3 px-4 font-medium">{row.description}</td>
                        {detailRows.some(r => r.customer) && <td className="py-3 px-4">{row.customer || '-'}</td>}
                        {detailRows.some(r => r.category) && <td className="py-3 px-4">{row.category || '-'}</td>}
                        <td className="py-3 px-4 font-semibold text-blue-600">{row.amount.toLocaleString()}</td>
                        {detailRows.some(r => r.status) && (
                          <td className="py-3 px-4">
                            {row.status && (
                              <Badge className={
                                row.status === 'functional' || row.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                                row.status === 'finished' ? 'bg-green-100 text-green-700' :
                                row.status === 'case_closed' ? 'bg-purple-100 text-purple-700' :
                                'bg-red-100 text-red-700'
                              } variant="secondary">
                                {t(row.status as any)}
                              </Badge>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {detailRows.length === 0 && (
                      <tr><td colSpan={7} className="py-10 text-center text-slate-400">{t('noData')}</td></tr>
                    )}
                  </tbody>
                  {detailRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan={detailRows.some(r => r.customer) && detailRows.some(r => r.category) ? 5 : detailRows.some(r => r.customer) || detailRows.some(r => r.category) ? 4 : 3} className="py-3 px-4 text-end">
                          {t('totalReceived')}:
                        </td>
                        <td className="py-3 px-4 text-blue-600">{detailTotal.toLocaleString()} {t('kd')}</td>
                        {detailRows.some(r => r.status) && <td />}
                      </tr>
                      <tr className="bg-slate-50">
                        <td colSpan={detailRows.some(r => r.customer) && detailRows.some(r => r.category) ? 5 : detailRows.some(r => r.customer) || detailRows.some(r => r.category) ? 4 : 3} className="py-3 px-4 text-end text-slate-500">
                          {t('average')}:
                        </td>
                        <td className="py-3 px-4 text-amber-600 font-medium">{detailAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('kd')}</td>
                        {detailRows.some(r => r.status) && <td />}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={() => setActiveSection('overview')} className="mt-2">
            &larr; {t('accounting')}
          </Button>
        </div>
      )}

      {/* Add Partner Dialog */}
      <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('add')} {t('partnerContributions')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('partnerName')} *</Label>
              <Input value={partnerForm.partner_name} onChange={e => setPartnerForm({ ...partnerForm, partner_name: e.target.value })} />
            </div>
            <div>
              <Label>{t('contribution')} ({t('kd')})</Label>
              <Input type="number" value={partnerForm.contribution} onChange={e => setPartnerForm({ ...partnerForm, contribution: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t('amountReceived')} ({t('kd')})</Label>
              <Input type="number" value={partnerForm.amount_received} onChange={e => setPartnerForm({ ...partnerForm, amount_received: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t('share')} (%)</Label>
              <Input type="number" value={partnerForm.share_percentage} onChange={e => setPartnerForm({ ...partnerForm, share_percentage: Number(e.target.value) })} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPartnerDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleSavePartner} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
