import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/contexts/LangContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { canonicalPaymentMode, paymentModeLabel } from '@/lib/payment-modes';
import { DataExport } from '@/components/shared/DataExport';
import {
  Calculator, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Receipt, FileText, BarChart3, ArrowUpRight, ArrowDownRight,
  Briefcase, Gavel, Lock, Calendar, ChevronRight, Printer, Users,
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

// Supabase caps a single request at 1000 rows. Paginate to fetch every row so
// period totals (e.g. receipts) are not silently truncated.
async function fetchAllRows(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const pageSize = 1000;
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

type ReportType = 'sales' | 'purchases' | 'expenses' | 'fileCharges' | 'receipts' | 'operational' | 'finished' | 'legal' | 'caseClosed';
type ActiveView = 'overview' | 'report' | 'income' | 'customerReport' | 'incomeRecovery' | 'paymentMode';

interface PaymentModeRow {
  mode: string;
  receipts: number;
  fileCharges: number;
  expenses: number;
  balance: number;
}

interface CustomerOption { id: string; customer_no: string; name: string; }
interface CustomerReportData {
  saleAmount: number;
  receivedAmount: number;
  discountGiven: number;
  legalAmountReceived: number;
  balanceToReceive: number;
  contracts: { contract_no: string; sale_price: number; paid_amount: number; remaining_amount: number; status: string; }[];
  legalCases: { case_no: string; case_amount: number; rcvd_from_court: number; court_fees: number; }[];
  purchases: { id: string; item_name: string; model_type: string; purchase_price: number; quantity: number; supplier_name: string; purchase_date: string; }[];
  expenses: { id: string; expense_voucher_no: string; expense_type: string; amount: number; description: string; expense_date: string; }[];
  totalPurchases: number;
  totalExpenses: number;
}

interface DetailRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  received?: number;
  discount?: number;
  category?: string;
  status?: string;
  customer?: string;
}

type SortKey = 'date' | 'description' | 'customer' | 'category' | 'received' | 'discount' | 'amount' | 'status';

interface IncomeStatement {
  salesRevenue: number;
  salesCount: number;
  fileCharges: number;
  fileChargesCount: number;
  receiptVouchers: number;
  receiptsCount: number;
  courtRecovery: number;
  otherIncome: number;
  totalRevenue: number;
  discount: number;
  purchaseCost: number;
  purchaseCount: number;
  grossProfit: number;
  operatingExpenses: number;
  expenseCount: number;
  operatingIncome: number;
  dueFromCustomers: number;
  dueFromCourt: number;
  netIncome: number;
  operationalCases: number;
  finishedCases: number;
  legalCases: number;
  closedCases: number;
  operationalValue: number;
  finishedValue: number;
  legalValue: number;
  closedValue: number;
}

interface IncomeRecovery {
  salesRevenue: number;
  salesCount: number;
  fileCharges: number;
  totalBilled: number;
  installmentCash: number;
  courtCash: number;
  otherCash: number;
  discounts: number;
  netCash: number;
  receiptsCount: number;
  collectionRate: number;
  dueFromCustomers: number;
  badDebtInCourt: number;
  recoveredFromCourt: number;
  netBadDebt: number;
  legalCasesCount: number;
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function AccountingPage() {
  const { t } = useLang();
  const { profile } = useAuth();
  const canViewIncome = profile?.role === 'accountant' || profile?.role === 'superadmin';
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [selectedReport, setSelectedReport] = useState<ReportType>('sales');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(todayStr);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [receiptTypeFilter, setReceiptTypeFilter] = useState<'all' | 'installment' | 'courtMoney' | 'others'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [reportLoading, setReportLoading] = useState(false);
  const [income, setIncome] = useState<IncomeStatement | null>(null);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [recovery, setRecovery] = useState<IncomeRecovery | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [allCustomers, setAllCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerReportData, setCustomerReportData] = useState<CustomerReportData | null>(null);
  const [customerReportLoading, setCustomerReportLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [pmRows, setPmRows] = useState<PaymentModeRow[]>([]);
  const [pmLoading, setPmLoading] = useState(false);

  useEffect(() => {
    supabase.from('customers').select('id, customer_no, name').order('name').then(({ data }) => setAllCustomers(data || []));
  }, []);

  async function loadCustomerReport(customerId: string) {
    if (!customerId) return;
    setCustomerReportLoading(true);
    setSelectedCustomerId(customerId);
    setActiveView('customerReport');

    const [contractsRes, legalRes, expensesRes, courtFeesRes, receiptsRes] = await Promise.all([
      supabase.from('contracts').select('contract_no, sale_price, paid_amount, remaining_amount, status, items').eq('customer_id', customerId),
      supabase.from('legal_cases').select('case_no, case_amount, rcvd_from_court').eq('customer_id', customerId),
      supabase.from('expenses').select('id, expense_voucher_no, expense_type, amount, description, expense_date').eq('customer_id', customerId),
      supabase.from('expenses').select('amount, case_no').eq('customer_id', customerId).in('expense_type', ['courtFees', 'lawyerFees']),
      supabase.from('receipt_vouchers').select('discount_amount').eq('customer_id', customerId),
    ]);

    const contracts = contractsRes.data || [];
    const legalCases = legalRes.data || [];
    const expenses = expensesRes.data || [];
    const courtFeesData = courtFeesRes.data || [];
    const discountGiven = (receiptsRes.data || []).reduce((s: number, r: any) => s + (r.discount_amount || 0), 0);

    const courtFeesByCaseNo: Record<string, number> = {};
    for (const cf of courtFeesData) {
      courtFeesByCaseNo[cf.case_no] = (courtFeesByCaseNo[cf.case_no] || 0) + (cf.amount || 0);
    }

    // Get purchases through contract items (purchases don't have customer_id directly)
    const allPurchaseIds: string[] = [];
    const purchaseQtyMap: Record<string, number> = {};
    for (const c of contracts) {
      const items = (c as any).items || [];
      for (const item of items) {
        if (item.purchase_id) {
          allPurchaseIds.push(item.purchase_id);
          purchaseQtyMap[item.purchase_id] = (purchaseQtyMap[item.purchase_id] || 0) + (item.quantity || 1);
        }
      }
    }

    let purchases: any[] = [];
    if (allPurchaseIds.length > 0) {
      const uniqueIds = [...new Set(allPurchaseIds)];
      const { data } = await supabase.from('purchases').select('id, item_name, model_type, purchase_price, quantity, supplier_name, purchase_date').in('id', uniqueIds);
      purchases = data || [];
    }

    const saleAmount = contracts.reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const receivedAmount = contracts.reduce((s: number, c: any) => s + (c.paid_amount || 0), 0);
    const legalAmountReceived = legalCases.reduce((s: number, lc: any) => s + (lc.rcvd_from_court || 0), 0);
    const balanceToReceive = saleAmount - receivedAmount - legalAmountReceived;
    const totalPurchases = purchases.reduce((s: number, p: any) => s + ((p.purchase_price || 0) * (purchaseQtyMap[p.id] || p.quantity || 1)), 0);
    const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);

    setCustomerReportData({
      saleAmount, receivedAmount, discountGiven, legalAmountReceived, balanceToReceive,
      contracts: contracts.map((c: any) => ({ contract_no: c.contract_no, sale_price: c.sale_price || 0, paid_amount: c.paid_amount || 0, remaining_amount: c.remaining_amount || 0, status: c.status || '' })),
      legalCases: legalCases.map((lc: any) => ({ case_no: lc.case_no, case_amount: lc.case_amount || 0, rcvd_from_court: lc.rcvd_from_court || 0, court_fees: courtFeesByCaseNo[lc.case_no] || 0 })),
      purchases: purchases.map((p: any) => ({ id: p.id, item_name: p.item_name || '', model_type: p.model_type || '', purchase_price: p.purchase_price || 0, quantity: purchaseQtyMap[p.id] || p.quantity || 1, supplier_name: p.supplier_name || '', purchase_date: p.purchase_date || '' })),
      expenses: expenses.map((e: any) => ({ id: e.id, expense_voucher_no: e.expense_voucher_no || '', expense_type: e.expense_type || '', amount: e.amount || 0, description: e.description || '', expense_date: e.expense_date || '' })),
      totalPurchases, totalExpenses,
    });
    setCustomerReportLoading(false);
  }

  const reportTypes: { key: ReportType; label: string; icon: typeof BarChart3; color: string; gradient: string }[] = [
    { key: 'sales', label: t('totalSales'), icon: TrendingUp, color: 'text-blue-600', gradient: 'from-blue-500 to-blue-600' },
    { key: 'purchases', label: t('totalPurchases'), icon: ShoppingCart, color: 'text-amber-600', gradient: 'from-amber-500 to-amber-600' },
    { key: 'expenses', label: t('totalExpenses'), icon: TrendingDown, color: 'text-red-600', gradient: 'from-red-500 to-red-600' },
    { key: 'fileCharges', label: t('fileOpeningCharges'), icon: FileText, color: 'text-teal-600', gradient: 'from-teal-500 to-teal-600' },
    { key: 'receipts', label: t('receiptVouchers'), icon: Receipt, color: 'text-green-600', gradient: 'from-green-500 to-green-600' },
    { key: 'operational', label: t('operationalCases'), icon: Briefcase, color: 'text-blue-500', gradient: 'from-blue-400 to-blue-500' },
    { key: 'finished', label: t('closedCases'), icon: Calculator, color: 'text-emerald-600', gradient: 'from-emerald-500 to-emerald-600' },
    { key: 'legal', label: t('legalCase'), icon: Gavel, color: 'text-red-500', gradient: 'from-red-400 to-red-500' },
    { key: 'caseClosed', label: t('caseClosed'), icon: Lock, color: 'text-purple-600', gradient: 'from-purple-500 to-purple-600' },
  ];

  async function loadReport(type: ReportType) {
    setReportLoading(true);
    if (type !== selectedReport) setReceiptTypeFilter('all');
    setSelectedReport(type);
    setActiveView('report');
    let rows: DetailRow[] = [];

    if (type === 'sales') {
      const res = await supabase.from('contracts').select('*').gte('start_date', dateFrom).lte('start_date', dateTo);
      rows = (res.data || []).map((c: any) => ({
        id: c.id, date: c.start_date || '', description: `${c.contract_no || ''} - ${c.customer_name || ''}`,
        amount: c.sale_price || 0, category: c.item_name || '', customer: c.customer_name || '', status: c.status || '',
      }));
    } else if (type === 'purchases') {
      const res = await supabase.from('purchases').select('*').gte('purchase_date', dateFrom).lte('purchase_date', dateTo);
      rows = (res.data || []).map((p: any) => ({
        id: p.id, date: p.purchase_date || '', description: `${p.invoice_no || ''} - ${p.item_name || ''}`,
        amount: p.purchase_price || 0, category: p.supplier_name || '',
      }));
    } else if (type === 'expenses') {
      const res = await supabase.from('expenses').select('*').gte('expense_date', dateFrom).lte('expense_date', dateTo);
      rows = (res.data || []).map((e: any) => ({
        id: e.id, date: e.expense_date || '', description: `${e.expense_voucher_no || ''} - ${e.expense_type || ''}`,
        amount: e.amount || 0, category: e.expense_type || '',
      }));
    } else if (type === 'fileCharges') {
      const res = await supabase.from('contracts').select('*').gte('start_date', dateFrom).lte('start_date', dateTo);
      rows = (res.data || []).filter((c: any) => (c.file_opening_charges || 0) > 0).map((c: any) => ({
        id: c.id, date: c.start_date || '', description: `${c.contract_no || ''} - ${c.customer_name || ''}`,
        amount: c.file_opening_charges || 0, customer: c.customer_name || '',
      }));
    } else if (type === 'receipts') {
      const res = await supabase.from('receipt_vouchers').select('*').gte('receipt_date', dateFrom).lte('receipt_date', dateTo);
      rows = (res.data || []).map((r: any) => {
        const received = r.received_amount || 0;
        const discount = r.discount_amount || 0;
        return {
          id: r.id, date: r.receipt_date || '', description: `${r.receipt_voucher_no || ''} - ${r.receipt_type || ''}`,
          amount: received - discount, received, discount, category: r.receipt_type || '', customer: r.customer_name || '',
        };
      });
    } else if (type === 'operational') {
      const res = await supabase.from('contracts').select('*').gte('start_date', dateFrom).lte('start_date', dateTo);
      rows = (res.data || []).filter((c: any) => c.status === 'functional' || c.status === 'ongoing').map((c: any) => ({
        id: c.id, date: c.start_date || '', description: `${c.contract_no || ''} - ${c.customer_name || ''}`,
        amount: c.sale_price || 0, customer: c.customer_name || '', status: 'functional',
      }));
    } else if (type === 'finished') {
      const res = await supabase.from('contracts').select('*').gte('start_date', dateFrom).lte('start_date', dateTo);
      rows = (res.data || []).filter((c: any) => c.status === 'finished' || c.status === 'closed').map((c: any) => ({
        id: c.id, date: c.start_date || '', description: `${c.contract_no || ''} - ${c.customer_name || ''}`,
        amount: c.sale_price || 0, customer: c.customer_name || '', status: 'closed',
      }));
    } else if (type === 'legal') {
      const [lcRes, contRes] = await Promise.all([
        supabase.from('legal_cases').select('*'),
        supabase.from('contracts').select('id, contract_no, customer_name, sale_price, start_date, status').eq('status', 'legal_case').gte('start_date', dateFrom).lte('start_date', dateTo),
      ]);
      const legalMap: Record<string, any> = {};
      (lcRes.data || []).forEach((lc: any) => { if (lc.contract_no) legalMap[lc.contract_no] = lc; });
      rows = (contRes.data || []).map((c: any) => {
        const lc = legalMap[c.contract_no];
        const caseNo = lc?.case_no || '';
        return {
          id: c.id, date: c.start_date || '', description: `${caseNo}${caseNo ? ' | ' : ''}${c.contract_no || ''} - ${c.customer_name || ''}`,
          amount: c.sale_price || 0, customer: c.customer_name || '', category: caseNo,
        };
      });
    } else if (type === 'caseClosed') {
      const [contRes, lcRes] = await Promise.all([
        supabase.from('contracts').select('id, contract_no, customer_name, sale_price, start_date, status').eq('status', 'case_closed').gte('start_date', dateFrom).lte('start_date', dateTo),
        supabase.from('legal_cases').select('*'),
      ]);
      const legalMap: Record<string, any> = {};
      (lcRes.data || []).forEach((lc: any) => { if (lc.contract_no) legalMap[lc.contract_no] = lc; });
      rows = (contRes.data || []).map((c: any) => {
        const lc = legalMap[c.contract_no];
        const caseNo = lc?.case_no || '';
        return {
          id: c.id, date: c.start_date || '', description: `${caseNo}${caseNo ? ' | ' : ''}${c.contract_no || ''} - ${c.customer_name || ''}`,
          amount: c.sale_price || 0, customer: c.customer_name || '', status: c.status || '', category: caseNo,
        };
      });
    }

    rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setDetailRows(rows);
    setReportLoading(false);
  }

  async function loadPaymentModeReport() {
    setPmLoading(true);
    setActiveView('paymentMode');

    const [receipts, expenses, contracts] = await Promise.all([
      fetchAllRows((from, to) => supabase.from('receipt_vouchers').select('payment_mode, received_amount, discount_amount').gte('receipt_date', dateFrom).lte('receipt_date', dateTo).range(from, to)),
      fetchAllRows((from, to) => supabase.from('expenses').select('payment_mode, amount').gte('expense_date', dateFrom).lte('expense_date', dateTo).range(from, to)),
      fetchAllRows((from, to) => supabase.from('contracts').select('payment_mode, file_opening_charges').gte('start_date', dateFrom).lte('start_date', dateTo).range(from, to)),
    ]);

    const map: Record<string, PaymentModeRow> = {};
    const ensure = (mode: string): PaymentModeRow => {
      if (!map[mode]) map[mode] = { mode, receipts: 0, fileCharges: 0, expenses: 0, balance: 0 };
      return map[mode];
    };

    receipts.forEach((r: any) => {
      const net = (r.received_amount || 0) - (r.discount_amount || 0);
      ensure(canonicalPaymentMode(r.payment_mode)).receipts += net;
    });
    contracts.forEach((c: any) => {
      if ((c.file_opening_charges || 0) > 0) ensure(canonicalPaymentMode(c.payment_mode)).fileCharges += c.file_opening_charges || 0;
    });
    expenses.forEach((e: any) => {
      ensure(canonicalPaymentMode(e.payment_mode)).expenses += e.amount || 0;
    });

    const rows = Object.values(map).map(r => ({ ...r, balance: r.receipts + r.fileCharges - r.expenses }));
    rows.sort((a, b) => b.balance - a.balance);
    setPmRows(rows);
    setPmLoading(false);
  }

  async function loadIncomeStatement() {
    setIncomeLoading(true);
    setActiveView('income');

    const [contracts, expenses, receipts, legalCases, allCourtReceipts] = await Promise.all([
      fetchAllRows((from, to) => supabase.from('contracts').select('*').gte('start_date', dateFrom).lte('start_date', dateTo).range(from, to)),
      fetchAllRows((from, to) => supabase.from('expenses').select('*').gte('expense_date', dateFrom).lte('expense_date', dateTo).range(from, to)),
      fetchAllRows((from, to) => supabase.from('receipt_vouchers').select('*').gte('receipt_date', dateFrom).lte('receipt_date', dateTo).range(from, to)),
      fetchAllRows((from, to) => supabase.from('legal_cases').select('*').range(from, to)),
      fetchAllRows((from, to) => supabase.from('receipt_vouchers').select('received_amount').eq('receipt_type', 'courtMoney').range(from, to)),
    ]);

    const salesRevenue = contracts.reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const fileCharges = contracts.reduce((s: number, c: any) => s + (c.file_opening_charges || 0), 0);
    const receiptVouchers = receipts.reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
    const courtRecoveryAllTime = legalCases.reduce((s: number, lc: any) => s + (lc.rcvd_from_court || 0), 0);
    // Court recovery: new recoveries come from Court Money receipt vouchers (period-scoped).
    // The pre-existing bulk-uploaded recovery (Legal Cases "Received from Court" not backed by any
    // receipt) is treated as a one-time historical figure dated up to the cutoff 2026-06-30.
    const COURT_BULK_CUTOFF = '2026-06-30';
    const allTimeCourtReceipts = allCourtReceipts.reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
    const courtRecoveryBulk = Math.max(0, courtRecoveryAllTime - allTimeCourtReceipts);
    const courtReceiptsPeriod = receipts.filter((r: any) => r.receipt_type === 'courtMoney').reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
    const courtRecovery = courtReceiptsPeriod + (dateFrom <= COURT_BULK_CUTOFF ? courtRecoveryBulk : 0);
    const otherIncome = receipts.filter((r: any) => r.receipt_type === 'others').reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
    const discount = receipts.reduce((s: number, r: any) => s + (r.discount_amount || 0), 0);
    const totalRevenue = salesRevenue + fileCharges + courtRecovery + otherIncome;

    let purchaseCost = 0;
    let purchaseCount = 0;
    for (const c of contracts) {
      const items = (c as any).items || [];
      for (const item of items) {
        purchaseCost += (item.purchase_price || 0) * (item.quantity || 1);
        purchaseCount++;
      }
    }
    const grossProfit = totalRevenue - purchaseCost;

    const operatingExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const operatingIncome = grossProfit - operatingExpenses - discount;

    const dueFromCustomers = contracts.reduce((s: number, c: any) => s + (c.remaining_amount || 0), 0);
    const dueFromCourt = legalCases.reduce((s: number, lc: any) => s + (lc.case_amount || 0), 0) - courtRecoveryAllTime;

    const operationalCases = contracts.filter((c: any) => c.status === 'functional' || c.status === 'ongoing').length;
    const finishedCases = contracts.filter((c: any) => c.status === 'finished' || c.status === 'closed').length;
    const legalCasesCount = contracts.filter((c: any) => c.status === 'legal_case').length;
    const closedCases = contracts.filter((c: any) => c.status === 'case_closed').length;

    const operationalValue = contracts.filter((c: any) => c.status === 'functional' || c.status === 'ongoing').reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const finishedValue = contracts.filter((c: any) => c.status === 'finished' || c.status === 'closed').reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const legalValue = contracts.filter((c: any) => c.status === 'legal_case').reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const closedValue = contracts.filter((c: any) => c.status === 'case_closed').reduce((s: number, c: any) => s + (c.sale_price || 0), 0);

    setIncome({
      salesRevenue, salesCount: contracts.length, fileCharges, fileChargesCount: contracts.filter((c: any) => (c.file_opening_charges || 0) > 0).length,
      receiptVouchers, receiptsCount: receipts.length, courtRecovery, otherIncome, totalRevenue, discount,
      purchaseCost, purchaseCount, grossProfit,
      operatingExpenses, expenseCount: expenses.length, operatingIncome,
      dueFromCustomers, dueFromCourt, netIncome: operatingIncome,
      operationalCases, finishedCases, legalCases: legalCasesCount, closedCases,
      operationalValue, finishedValue, legalValue, closedValue,
    });
    setIncomeLoading(false);
  }

  async function loadIncomeRecovery() {
    setRecoveryLoading(true);
    setActiveView('incomeRecovery');

    const [allContracts, periodReceipts, legalCases] = await Promise.all([
      fetchAllRows((from, to) => supabase.from('contracts').select('sale_price, file_opening_charges, remaining_amount, status, start_date').range(from, to)),
      fetchAllRows((from, to) => supabase.from('receipt_vouchers').select('received_amount, discount_amount, receipt_type').gte('receipt_date', dateFrom).lte('receipt_date', dateTo).range(from, to)),
      fetchAllRows((from, to) => supabase.from('legal_cases').select('case_amount, rcvd_from_court').range(from, to)),
    ]);

    // §1 Sales income (accrual) — contracts whose start date falls in the period
    const periodContracts = allContracts.filter((c: any) => c.start_date && c.start_date >= dateFrom && c.start_date <= dateTo);
    const salesRevenue = periodContracts.reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
    const fileCharges = periodContracts.reduce((s: number, c: any) => s + (c.file_opening_charges || 0), 0);
    const totalBilled = salesRevenue + fileCharges;

    // §2 Cash collected (revenue recognized on receipt) — receipts in the period
    const installmentCash = periodReceipts.filter((r: any) => r.receipt_type === 'installment').reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
    const courtCash = periodReceipts.filter((r: any) => r.receipt_type === 'courtMoney').reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
    const otherCash = periodReceipts.filter((r: any) => r.receipt_type === 'others').reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
    const discounts = periodReceipts.reduce((s: number, r: any) => s + (r.discount_amount || 0), 0);
    const netCash = installmentCash + courtCash + otherCash - discounts;
    const collectionRate = totalBilled > 0 ? (netCash / totalBilled) * 100 : 0;

    // §3 Receivables & bad debt (as-of snapshot, not period-scoped)
    const dueFromCustomers = allContracts.filter((c: any) => c.status !== 'legal_case' && c.status !== 'case_closed').reduce((s: number, c: any) => s + (c.remaining_amount || 0), 0);
    const badDebtInCourt = legalCases.reduce((s: number, lc: any) => s + (lc.case_amount || 0), 0);
    const recoveredFromCourt = legalCases.reduce((s: number, lc: any) => s + (lc.rcvd_from_court || 0), 0);
    const netBadDebt = badDebtInCourt - recoveredFromCourt;

    setRecovery({
      salesRevenue, salesCount: periodContracts.length, fileCharges, totalBilled,
      installmentCash, courtCash, otherCash, discounts, netCash, receiptsCount: periodReceipts.length, collectionRate,
      dueFromCustomers, badDebtInCourt, recoveredFromCourt, netBadDebt, legalCasesCount: legalCases.length,
    });
    setRecoveryLoading(false);
  }


  const filteredRows = selectedReport === 'receipts' && receiptTypeFilter !== 'all'
    ? detailRows.filter(r => r.category === receiptTypeFilter)
    : detailRows;
  const numericSortKeys: SortKey[] = ['received', 'discount', 'amount'];
  const visibleRows = [...filteredRows].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (numericSortKeys.includes(sortKey)) {
      return ((Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0)) * dir;
    }
    return String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')) * dir;
  });
  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };
  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === 'asc' ? <ArrowUp className="inline h-3 w-3 ms-1" /> : <ArrowDown className="inline h-3 w-3 ms-1" />)
      : <ArrowUpDown className="inline h-3 w-3 ms-1 opacity-30" />;

  const detailTotal = visibleRows.reduce((s, r) => s + r.amount, 0);
  const detailAvg = visibleRows.length > 0 ? detailTotal / visibleRows.length : 0;
  const currentReportDef = reportTypes.find(r => r.key === selectedReport);

  const showCustomerCol = visibleRows.some(r => r.customer);
  const showCategoryCol = visibleRows.some(r => r.category);
  const showBreakdownCol = visibleRows.some(r => r.received !== undefined);
  const showStatusCol = visibleRows.some(r => r.status);
  const footerColSpan = 3 + (showCustomerCol ? 1 : 0) + (showCategoryCol ? 1 : 0) + (showBreakdownCol ? 2 : 0);
  const detailReceivedTotal = visibleRows.reduce((s, r) => s + (r.received || 0), 0);
  const detailDiscountTotal = visibleRows.reduce((s, r) => s + (r.discount || 0), 0);

  const reportExportHeaders = showBreakdownCol
    ? [t('date'), t('description'), t('customer'), t('category'), t('received'), t('discount'), t('netAmount'), t('status')]
    : [t('date'), t('description'), t('amount'), t('customer'), t('category'), t('status')];
  const reportExportRows = visibleRows.map(r => showBreakdownCol
    ? [r.date, r.description, r.customer || '', r.category || '', r.received || 0, r.discount || 0, r.amount, r.status || '']
    : [r.date, r.description, r.amount, r.customer || '', r.category || '', r.status || '']);

  const DateRangePicker = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-slate-500 whitespace-nowrap">{t('from')}:</Label>
        <DatePicker value={dateFrom} onChange={setDateFrom} placeholder={t("from")} />
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-slate-500 whitespace-nowrap">{t('to')}:</Label>
        <DatePicker value={dateTo} onChange={setDateTo} placeholder={t("to")} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('accounting')}</h1>
          <p className="text-slate-500 text-sm">{t('financialReports')}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker />
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <Button variant={activeView === 'overview' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('overview')} className={activeView === 'overview' ? 'bg-slate-700 text-white' : ''}>
          <BarChart3 className="h-4 w-4 me-1" /> {t('componentReports')}
        </Button>
        {canViewIncome && (
          <Button variant={activeView === 'income' ? 'default' : 'outline'} size="sm" onClick={() => loadIncomeStatement()} className={activeView === 'income' ? 'bg-emerald-600 text-white' : ''}>
            <DollarSign className="h-4 w-4 me-1" /> {t('incomeStatement')}
          </Button>
        )}
        {canViewIncome && (
          <Button variant={activeView === 'incomeRecovery' ? 'default' : 'outline'} size="sm" onClick={() => loadIncomeRecovery()} className={activeView === 'incomeRecovery' ? 'bg-teal-600 text-white' : ''}>
            <TrendingUp className="h-4 w-4 me-1" /> {t('incomeRecovery')}
          </Button>
        )}
        {canViewIncome && (
          <Button variant={activeView === 'paymentMode' ? 'default' : 'outline'} size="sm" onClick={() => loadPaymentModeReport()} className={activeView === 'paymentMode' ? 'bg-indigo-600 text-white' : ''}>
            <DollarSign className="h-4 w-4 me-1" /> {t('paymentModeReport')}
          </Button>
        )}
        <Button variant={activeView === 'customerReport' ? 'default' : 'outline'} size="sm" onClick={() => setActiveView('customerReport')} className={activeView === 'customerReport' ? 'bg-purple-600 text-white' : ''}>
          <Users className="h-4 w-4 me-1" /> {t('customerReport')}
        </Button>
      </div>

      {/* ====================== OVERVIEW VIEW ====================== */}
      {activeView === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map(rpt => (
              <Card key={rpt.key} className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5" onClick={() => loadReport(rpt.key)}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${rpt.gradient} flex items-center justify-center shadow-lg`}>
                        <rpt.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{rpt.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{t('clickToView')}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

        </>
      )}

      {/* ====================== COMPONENT REPORT VIEW ====================== */}
      {activeView === 'report' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl shadow-md p-4 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-3">
              {currentReportDef && (
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${currentReportDef.gradient} flex items-center justify-center`}>
                  <currentReportDef.icon className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-slate-900">{currentReportDef?.label}</h2>
                <p className="text-xs text-slate-500">{dateFrom} ~ {dateTo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedReport === 'receipts' && (
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={receiptTypeFilter}
                  onChange={e => setReceiptTypeFilter(e.target.value as typeof receiptTypeFilter)}
                >
                  <option value="all">{t('all')}</option>
                  <option value="installment">{t('installment')}</option>
                  <option value="courtMoney">{t('courtMoney')}</option>
                  <option value="others">{t('others')}</option>
                </select>
              )}
              <Button variant="outline" size="sm" onClick={() => loadReport(selectedReport)}>
                <Calendar className="h-4 w-4 me-1" /> {t('filter')}
              </Button>
              <DataExport
                title={`${currentReportDef?.label} (${dateFrom} ~ ${dateTo})`}
                headers={reportExportHeaders}
                rows={reportExportRows}
                filename={`report-${selectedReport}-${dateFrom}-${dateTo}`}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {reportTypes.map(rpt => (
              <Button key={rpt.key} variant={selectedReport === rpt.key ? 'default' : 'ghost'} size="sm" onClick={() => loadReport(rpt.key)}
                className={`text-xs ${selectedReport === rpt.key ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                <rpt.icon className="h-3.5 w-3.5 me-1" /> {rpt.label}
              </Button>
            ))}
          </div>

          {reportLoading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('total')}</p>
                    <p className={`text-2xl font-bold mt-1 ${currentReportDef?.color || 'text-blue-600'}`}>{fmt(detailTotal)} {t('kd')}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('average')}</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(detailAvg)} {t('kd')}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('count')}</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{visibleRows.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-start py-3 px-4 font-medium text-slate-600">#</th>
                          <th className="text-start py-3 px-4 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort('date')}>{t('date')}<SortIcon col="date" /></th>
                          <th className="text-start py-3 px-4 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort('description')}>{t('description')}<SortIcon col="description" /></th>
                          {showCustomerCol && <th className="text-start py-3 px-4 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort('customer')}>{t('customer')}<SortIcon col="customer" /></th>}
                          {showCategoryCol && <th className="text-start py-3 px-4 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort('category')}>{t('category')}<SortIcon col="category" /></th>}
                          {showBreakdownCol && <th className="text-start py-3 px-4 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort('received')}>{t('received')} ({t('kd')})<SortIcon col="received" /></th>}
                          {showBreakdownCol && <th className="text-start py-3 px-4 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort('discount')}>{t('discount')} ({t('kd')})<SortIcon col="discount" /></th>}
                          <th className="text-start py-3 px-4 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort('amount')}>{showBreakdownCol ? t('netAmount') : t('amount')} ({t('kd')})<SortIcon col="amount" /></th>
                          {showStatusCol && <th className="text-start py-3 px-4 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort('status')}>{t('status')}<SortIcon col="status" /></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row, i) => (
                          <tr key={row.id || i} className="border-b border-slate-100 hover:bg-blue-50/50">
                            <td className="py-3 px-4 text-slate-400">{i + 1}</td>
                            <td className="py-3 px-4">{row.date}</td>
                            <td className="py-3 px-4 font-medium">{row.description}</td>
                            {showCustomerCol && <td className="py-3 px-4">{row.customer || '-'}</td>}
                            {showCategoryCol && <td className="py-3 px-4">{row.category || '-'}</td>}
                            {showBreakdownCol && <td className="py-3 px-4 text-slate-700">{fmt(row.received || 0)}</td>}
                            {showBreakdownCol && <td className="py-3 px-4 text-red-600">{(row.discount || 0) > 0 ? `(${fmt(row.discount || 0)})` : fmt(0)}</td>}
                            <td className="py-3 px-4 font-semibold text-blue-600">{fmt(row.amount)}</td>
                            {showStatusCol && (
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
                        {visibleRows.length === 0 && (
                          <tr><td colSpan={footerColSpan + 1 + (showStatusCol ? 1 : 0)} className="py-10 text-center text-slate-400">{t('noData')}</td></tr>
                        )}
                      </tbody>
                      {visibleRows.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                            <td colSpan={footerColSpan - (showBreakdownCol ? 2 : 0)} className="py-3 px-4 text-end">{t('total')}:</td>
                            {showBreakdownCol && <td className="py-3 px-4 text-slate-700">{fmt(detailReceivedTotal)}</td>}
                            {showBreakdownCol && <td className="py-3 px-4 text-red-600">{detailDiscountTotal > 0 ? `(${fmt(detailDiscountTotal)})` : fmt(0)}</td>}
                            <td className="py-3 px-4 text-blue-600">{fmt(detailTotal)} {t('kd')}</td>
                            {showStatusCol && <td />}
                          </tr>
                          <tr className="bg-slate-50">
                            <td colSpan={footerColSpan} className="py-3 px-4 text-end text-slate-500">{t('average')}:</td>
                            <td className="py-3 px-4 text-amber-600 font-medium">{fmt(detailAvg)} {t('kd')}</td>
                            {showStatusCol && <td />}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Button variant="outline" onClick={() => setActiveView('overview')} className="mt-2">
                &larr; {t('backToReports')}
              </Button>
            </>
          )}
        </div>
      )}

      {/* ====================== INCOME STATEMENT VIEW ====================== */}
      {activeView === 'income' && canViewIncome && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl shadow-md p-4 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t('incomeStatement')}</h2>
                <p className="text-xs text-slate-500">{t('period')}: {dateFrom} ~ {dateTo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => loadIncomeStatement()}>
                <Calendar className="h-4 w-4 me-1" /> {t('filter')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 me-1" /> {t('print')}
              </Button>
            </div>
          </div>

          {incomeLoading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : income ? (
            <>
              {/* Revenue Section */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-t-lg">
                  <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
                    <ArrowUpRight className="h-5 w-5" /> {t('totalRevenue')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-green-50/50">
                        <td className="py-3 px-6 font-medium">{t('totalSales')}</td>
                        <td className="py-3 px-6 text-slate-500">{income.salesCount} {t('contracts')}</td>
                        <td className="py-3 px-6 text-end font-semibold text-green-600">{fmt(income.salesRevenue)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-green-50/50">
                        <td className="py-3 px-6 font-medium">{t('fileOpeningCharges')}</td>
                        <td className="py-3 px-6 text-slate-500">{income.fileChargesCount} {t('contracts')}</td>
                        <td className="py-3 px-6 text-end font-semibold text-green-600">{fmt(income.fileCharges)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-green-50/50">
                        <td className="py-3 px-6 font-medium">{t('courtRecovery')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-green-600">{fmt(income.courtRecovery)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-green-50/50">
                        <td className="py-3 px-6 font-medium">{t('otherIncome')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-green-600">{fmt(income.otherIncome)} {t('kd')}</td>
                      </tr>
                      <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                        <td className="py-3 px-6" colSpan={2}>{t('totalRevenue')}</td>
                        <td className="py-3 px-6 text-end text-emerald-700">{fmt(income.totalRevenue)} {t('kd')}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Cost of Goods Sold */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg">
                  <CardTitle className="text-base text-amber-800 flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" /> {t('costOfGoodsSold')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-amber-50/50">
                        <td className="py-3 px-6 font-medium">{t('totalPurchases')}</td>
                        <td className="py-3 px-6 text-slate-500">{income.purchaseCount} items</td>
                        <td className="py-3 px-6 text-end font-semibold text-amber-600">({fmt(income.purchaseCost)}) {t('kd')}</td>
                      </tr>
                      <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                        <td className="py-3 px-6" colSpan={2}>{t('grossProfit')}</td>
                        <td className={`py-3 px-6 text-end ${income.grossProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(income.grossProfit)} {t('kd')}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Operating Expenses */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 rounded-t-lg">
                  <CardTitle className="text-base text-red-800 flex items-center gap-2">
                    <ArrowDownRight className="h-5 w-5" /> {t('totalExpenses')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-red-50/50">
                        <td className="py-3 px-6 font-medium">{t('totalExpenses')}</td>
                        <td className="py-3 px-6 text-slate-500">{income.expenseCount} items</td>
                        <td className="py-3 px-6 text-end font-semibold text-red-600">({fmt(income.operatingExpenses)}) {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-red-50/50">
                        <td className="py-3 px-6 font-medium">{t('discountsGiven')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-red-600">({fmt(income.discount)}) {t('kd')}</td>
                      </tr>
                      <tr className={`font-bold border-t-2 ${income.netIncome >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <td className="py-3 px-6" colSpan={2}>{income.netIncome >= 0 ? t('netIncome') : t('netLoss')}</td>
                        <td className={`py-3 px-6 text-end text-lg ${income.netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(income.netIncome)} {t('kd')}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Receivables and Collections */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                  <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                    <Receipt className="h-5 w-5" /> {t('receivablesCollections')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="py-3 px-6 font-medium">{t('receiptVouchers')}</td>
                        <td className="py-3 px-6 text-slate-500">{income.receiptsCount} receipts</td>
                        <td className="py-3 px-6 text-end font-semibold text-blue-600">{fmt(income.receiptVouchers)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="py-3 px-6 font-medium">{t('dueFromCustomers')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-orange-600">{fmt(income.dueFromCustomers)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="py-3 px-6 font-medium">{t('dueFromCourt')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-orange-600">{fmt(income.dueFromCourt)} {t('kd')}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Case Status Breakdown */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-t-lg">
                  <CardTitle className="text-base text-purple-800 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" /> {t('caseStatusBreakdown')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-start py-3 px-6 font-medium text-slate-600">{t('status')}</th>
                        <th className="text-start py-3 px-6 font-medium text-slate-600">{t('count')}</th>
                        <th className="text-end py-3 px-6 font-medium text-slate-600">{t('total')} ({t('kd')})</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="py-3 px-6"><Badge className="bg-blue-100 text-blue-700" variant="secondary">{t('operationalCases')}</Badge></td>
                        <td className="py-3 px-6 font-semibold">{income.operationalCases}</td>
                        <td className="py-3 px-6 text-end font-semibold text-blue-600">{fmt(income.operationalValue)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-green-50/50">
                        <td className="py-3 px-6"><Badge className="bg-green-100 text-green-700" variant="secondary">{t('closedCases')}</Badge></td>
                        <td className="py-3 px-6 font-semibold">{income.finishedCases}</td>
                        <td className="py-3 px-6 text-end font-semibold text-green-600">{fmt(income.finishedValue)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-red-50/50">
                        <td className="py-3 px-6"><Badge className="bg-red-100 text-red-700" variant="secondary">{t('legalCase')}</Badge></td>
                        <td className="py-3 px-6 font-semibold">{income.legalCases}</td>
                        <td className="py-3 px-6 text-end font-semibold text-red-600">{fmt(income.legalValue)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-purple-50/50">
                        <td className="py-3 px-6"><Badge className="bg-purple-100 text-purple-700" variant="secondary">{t('caseClosed')}</Badge></td>
                        <td className="py-3 px-6 font-semibold">{income.closedCases}</td>
                        <td className="py-3 px-6 text-end font-semibold text-purple-600">{fmt(income.closedValue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Button variant="outline" onClick={() => setActiveView('overview')} className="mt-2">
                &larr; {t('backToReports')}
              </Button>
            </>
          ) : null}
        </div>
      )}

      {/* ====================== INCOME & RECOVERY VIEW ====================== */}
      {activeView === 'incomeRecovery' && canViewIncome && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl shadow-md p-4 border-l-4 border-l-teal-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t('incomeRecovery')}</h2>
                <p className="text-xs text-slate-500">{t('period')}: {dateFrom} ~ {dateTo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => loadIncomeRecovery()}>
                <Calendar className="h-4 w-4 me-1" /> {t('filter')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 me-1" /> {t('print')}
              </Button>
            </div>
          </div>

          {recoveryLoading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : recovery ? (
            <>
              {/* §1 Sales Income (accrual) */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-t-lg">
                  <CardTitle className="text-base text-emerald-800 flex items-center gap-2">
                    <ArrowUpRight className="h-5 w-5" /> {t('salesIncomeAccrual')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-green-50/50">
                        <td className="py-3 px-6 font-medium">{t('contractSalesValue')}</td>
                        <td className="py-3 px-6 text-slate-500">{recovery.salesCount} {t('contracts')}</td>
                        <td className="py-3 px-6 text-end font-semibold text-green-600">{fmt(recovery.salesRevenue)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-green-50/50">
                        <td className="py-3 px-6 font-medium">{t('fileOpeningCharges')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-green-600">{fmt(recovery.fileCharges)} {t('kd')}</td>
                      </tr>
                      <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                        <td className="py-3 px-6" colSpan={2}>{t('totalBilledIncome')}</td>
                        <td className="py-3 px-6 text-end text-emerald-700">{fmt(recovery.totalBilled)} {t('kd')}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* §2 Cash Collected (revenue recognized on receipt) */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                  <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                    <Receipt className="h-5 w-5" /> {t('cashCollected')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="py-3 px-6 font-medium">{t('installmentReceipts')}</td>
                        <td className="py-3 px-6 text-slate-500">{recovery.receiptsCount} {t('receiptVouchers')}</td>
                        <td className="py-3 px-6 text-end font-semibold text-blue-600">{fmt(recovery.installmentCash)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="py-3 px-6 font-medium">{t('courtMoneyReceipts')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-blue-600">{fmt(recovery.courtCash)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-blue-50/50">
                        <td className="py-3 px-6 font-medium">{t('otherReceipts')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-blue-600">{fmt(recovery.otherCash)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-red-50/50">
                        <td className="py-3 px-6 font-medium">{t('discountsGiven')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-red-600">({fmt(recovery.discounts)}) {t('kd')}</td>
                      </tr>
                      <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                        <td className="py-3 px-6" colSpan={2}>{t('netCashReceived')}</td>
                        <td className="py-3 px-6 text-end text-blue-700">{fmt(recovery.netCash)} {t('kd')}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* §3 Receivables & Bad Debt (as-of snapshot) */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg">
                  <CardTitle className="text-base text-amber-800 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" /> {t('receivablesBadDebt')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-orange-50/50">
                        <td className="py-3 px-6 font-medium">{t('dueFromCustomersCollectible')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-orange-600">{fmt(recovery.dueFromCustomers)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-red-50/50">
                        <td className="py-3 px-6 font-medium">{t('badDebtInCourt')}</td>
                        <td className="py-3 px-6 text-slate-500">{recovery.legalCasesCount} {t('legalCase')}</td>
                        <td className="py-3 px-6 text-end font-semibold text-red-600">{fmt(recovery.badDebtInCourt)} {t('kd')}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-green-50/50">
                        <td className="py-3 px-6 font-medium">{t('recoveredFromCourt')}</td>
                        <td className="py-3 px-6 text-slate-500"></td>
                        <td className="py-3 px-6 text-end font-semibold text-green-600">({fmt(recovery.recoveredFromCourt)}) {t('kd')}</td>
                      </tr>
                      <tr className="bg-amber-50 font-bold border-t-2 border-amber-200">
                        <td className="py-3 px-6" colSpan={2}>{t('netBadDebtOutstanding')}</td>
                        <td className="py-3 px-6 text-end text-amber-700">{fmt(recovery.netBadDebt)} {t('kd')}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Collection Rate */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t('collectionRate')}</p>
                    <p className="text-xs text-slate-400">{t('collectionRateDesc')}</p>
                  </div>
                  <p className={`text-2xl font-bold ${recovery.collectionRate >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                    {recovery.collectionRate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </p>
                </CardContent>
              </Card>

              <Button variant="outline" onClick={() => setActiveView('overview')} className="mt-2">
                &larr; {t('backToReports')}
              </Button>
            </>
          ) : null}
        </div>
      )}

      {/* ====================== PAYMENT MODE REPORT VIEW ====================== */}
      {activeView === 'paymentMode' && canViewIncome && (
        <div className="space-y-4">
          {pmLoading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{t('paymentModeReport')}</h2>
                  <p className="text-sm text-slate-500">{dateFrom} → {dateTo}</p>
                </div>
                <DataExport
                  title={t('paymentModeReport')}
                  headers={[t('paymentMode'), t('receiptVouchers'), t('fileOpeningCharges'), t('totalExpenses'), t('balance')]}
                  rows={pmRows.map(r => [paymentModeLabel(r.mode, t), r.receipts, r.fileCharges, r.expenses, r.balance])}
                  filename="payment-mode-report"
                />
              </div>

              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  {pmRows.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">
                      <DollarSign className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('paymentMode')}</th>
                            <th className="text-end py-3 px-4 font-medium text-slate-600">{t('receiptVouchers')}</th>
                            <th className="text-end py-3 px-4 font-medium text-slate-600">{t('fileOpeningCharges')}</th>
                            <th className="text-end py-3 px-4 font-medium text-slate-600">{t('totalExpenses')}</th>
                            <th className="text-end py-3 px-4 font-medium text-slate-600">{t('balance')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pmRows.map(r => (
                            <tr key={r.mode} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                              <td className="py-3 px-4 font-medium">{paymentModeLabel(r.mode, t)}</td>
                              <td className="py-3 px-4 text-end text-green-600">+{Math.round(r.receipts).toLocaleString()} {t('kd')}</td>
                              <td className="py-3 px-4 text-end text-teal-600">+{Math.round(r.fileCharges).toLocaleString()} {t('kd')}</td>
                              <td className="py-3 px-4 text-end text-red-600">-{Math.round(r.expenses).toLocaleString()} {t('kd')}</td>
                              <td className="py-3 px-4 text-end font-bold text-slate-900">{Math.round(r.balance).toLocaleString()} {t('kd')}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                            <td className="py-3 px-4">{t('total')}</td>
                            <td className="py-3 px-4 text-end text-green-700">+{Math.round(pmRows.reduce((s, r) => s + r.receipts, 0)).toLocaleString()} {t('kd')}</td>
                            <td className="py-3 px-4 text-end text-teal-700">+{Math.round(pmRows.reduce((s, r) => s + r.fileCharges, 0)).toLocaleString()} {t('kd')}</td>
                            <td className="py-3 px-4 text-end text-red-700">-{Math.round(pmRows.reduce((s, r) => s + r.expenses, 0)).toLocaleString()} {t('kd')}</td>
                            <td className="py-3 px-4 text-end text-slate-900">{Math.round(pmRows.reduce((s, r) => s + r.balance, 0)).toLocaleString()} {t('kd')}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button variant="outline" onClick={() => setActiveView('overview')} className="mt-2">
                &larr; {t('backToReports')}
              </Button>
            </>
          )}
        </div>
      )}

      {/* ====================== CUSTOMER REPORT VIEW ====================== */}
      {activeView === 'customerReport' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl shadow-md p-4 border-l-4 border-l-purple-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t('customerReport')}</h2>
                <p className="text-xs text-slate-500">{t('customerReportDesc')}</p>
              </div>
            </div>
          </div>

          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <Label className="text-sm font-medium">{t('selectCustomerForReport')}</Label>
              <div className="relative mt-2">
                <Input
                  type="text"
                  placeholder={t('searchCustomer') || 'Search customer by name or number...'}
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="h-10 w-full"
                />
                {showCustomerDropdown && customerSearch.trim() !== '' && (() => {
                  const q = customerSearch.toLowerCase();
                  const filtered = allCustomers.filter(c => c.name.toLowerCase().includes(q) || c.customer_no.toLowerCase().includes(q));
                  if (filtered.length === 0) return null;
                  return (
                    <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg">
                      {filtered.slice(0, 50).map(c => (
                        <div
                          key={c.id}
                          className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer border-b border-slate-50"
                          onMouseDown={() => {
                            setCustomerSearch(`${c.customer_no} - ${c.name}`);
                            setShowCustomerDropdown(false);
                            loadCustomerReport(c.id);
                          }}
                        >
                          <span className="font-medium text-blue-600">{c.customer_no}</span> - {c.name}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {customerReportLoading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : customerReportData && selectedCustomerId ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('saleAmount')}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(customerReportData.saleAmount)} {t('kd')}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('receivedAmount2')}</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{fmt(customerReportData.receivedAmount)} {t('kd')}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('discountsGiven')}</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{fmt(customerReportData.discountGiven)} {t('kd')}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('actualReceived')}</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(customerReportData.receivedAmount - customerReportData.discountGiven)} {t('kd')}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('legalAmountReceived')}</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{fmt(customerReportData.legalAmountReceived)} {t('kd')}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5 text-center">
                    <p className="text-xs text-slate-500 font-medium">{t('balanceToReceive')}</p>
                    <p className={`text-2xl font-bold mt-1 ${customerReportData.balanceToReceive > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(customerReportData.balanceToReceive)} {t('kd')}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Contracts Table */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                  <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                    <FileText className="h-5 w-5" /> {t('contractDetails2')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {customerReportData.contracts.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">{t('noContractsFound')}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-start py-3 px-4 font-medium text-slate-600">#</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('contractNo')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('saleAmount')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receivedAmount2')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('remainingAmount')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerReportData.contracts.map((c, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/50">
                              <td className="py-3 px-4 text-slate-400">{i + 1}</td>
                              <td className="py-3 px-4 font-medium">{c.contract_no}</td>
                              <td className="py-3 px-4 text-blue-600 font-semibold">{fmt(c.sale_price)} {t('kd')}</td>
                              <td className="py-3 px-4 text-green-600 font-semibold">{fmt(c.paid_amount)} {t('kd')}</td>
                              <td className="py-3 px-4 text-red-600 font-semibold">{fmt(c.remaining_amount)} {t('kd')}</td>
                              <td className="py-3 px-4">
                                <Badge className={
                                  c.status === 'functional' || c.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                                  c.status === 'closed' || c.status === 'finished' ? 'bg-green-100 text-green-700' :
                                  c.status === 'case_closed' ? 'bg-purple-100 text-purple-700' :
                                  'bg-red-100 text-red-700'
                                } variant="secondary">
                                  {t(c.status as any) || c.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                            <td colSpan={2} className="py-3 px-4 text-end">{t('total')}:</td>
                            <td className="py-3 px-4 text-blue-600">{fmt(customerReportData.saleAmount)} {t('kd')}</td>
                            <td className="py-3 px-4 text-green-600">{fmt(customerReportData.receivedAmount)} {t('kd')}</td>
                            <td className="py-3 px-4 text-red-600">{fmt(customerReportData.saleAmount - customerReportData.receivedAmount)} {t('kd')}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Purchases Table */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg">
                  <CardTitle className="text-base text-amber-800 flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" /> {t('purchasesOfItems')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {customerReportData.purchases.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">{t('noPurchasesFound')}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-start py-3 px-4 font-medium text-slate-600">#</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('itemName')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('modelType')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('supplierName')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('quantity')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('purchasePrice')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerReportData.purchases.map((p, i) => (
                            <tr key={p.id} className="border-b border-slate-100 hover:bg-amber-50/50">
                              <td className="py-3 px-4 text-slate-400">{i + 1}</td>
                              <td className="py-3 px-4 font-medium">{p.item_name}</td>
                              <td className="py-3 px-4 text-slate-600">{p.model_type}</td>
                              <td className="py-3 px-4 text-slate-600">{p.supplier_name}</td>
                              <td className="py-3 px-4">{p.quantity}</td>
                              <td className="py-3 px-4 text-amber-600 font-semibold">{fmt(p.purchase_price)} {t('kd')}</td>
                              <td className="py-3 px-4 text-amber-700 font-semibold">{fmt(p.purchase_price * p.quantity)} {t('kd')}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                            <td colSpan={6} className="py-3 px-4 text-end">{t('totalPurchases')}:</td>
                            <td className="py-3 px-4 text-amber-700">{fmt(customerReportData.totalPurchases)} {t('kd')}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expenses Table */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 rounded-t-lg">
                  <CardTitle className="text-base text-red-800 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" /> {t('expensesRelated')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {customerReportData.expenses.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">{t('noExpensesFound')}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-start py-3 px-4 font-medium text-slate-600">#</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('voucherNo')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('expenseType')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('description')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('date')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('amount')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerReportData.expenses.map((e, i) => (
                            <tr key={e.id} className="border-b border-slate-100 hover:bg-red-50/50">
                              <td className="py-3 px-4 text-slate-400">{i + 1}</td>
                              <td className="py-3 px-4 font-medium">{e.expense_voucher_no}</td>
                              <td className="py-3 px-4 text-slate-600">{e.expense_type}</td>
                              <td className="py-3 px-4 text-slate-500">{e.description}</td>
                              <td className="py-3 px-4 text-slate-600">{e.expense_date}</td>
                              <td className="py-3 px-4 text-red-600 font-semibold">{fmt(e.amount)} {t('kd')}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                            <td colSpan={5} className="py-3 px-4 text-end">{t('totalExpenses')}:</td>
                            <td className="py-3 px-4 text-red-700">{fmt(customerReportData.totalExpenses)} {t('kd')}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Legal Cases Table */}
              {customerReportData.legalCases.length > 0 && (
                <Card className="border-0 shadow-md">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-t-lg">
                    <CardTitle className="text-base text-purple-800 flex items-center gap-2">
                      <Gavel className="h-5 w-5" /> {t('legalCase')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-start py-3 px-4 font-medium text-slate-600">#</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('caseNo')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('caseAmount')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('courtFees')}</th>
                            <th className="text-start py-3 px-4 font-medium text-slate-600">{t('courtRecovery')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerReportData.legalCases.map((lc, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-purple-50/50">
                              <td className="py-3 px-4 text-slate-400">{i + 1}</td>
                              <td className="py-3 px-4 font-medium text-purple-600">{lc.case_no}</td>
                              <td className="py-3 px-4 text-blue-600 font-semibold">{fmt(lc.case_amount)} {t('kd')}</td>
                              <td className="py-3 px-4 text-red-600 font-semibold">{fmt(lc.court_fees)} {t('kd')}</td>
                              <td className="py-3 px-4 text-green-600 font-semibold">{fmt(lc.rcvd_from_court)} {t('kd')}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                            <td colSpan={2} className="py-3 px-4 text-end">{t('total')}:</td>
                            <td className="py-3 px-4 text-blue-600">{fmt(customerReportData.legalCases.reduce((s, lc) => s + lc.case_amount, 0))} {t('kd')}</td>
                            <td className="py-3 px-4 text-red-600">{fmt(customerReportData.legalCases.reduce((s, lc) => s + lc.court_fees, 0))} {t('kd')}</td>
                            <td className="py-3 px-4 text-green-600">{fmt(customerReportData.legalCases.reduce((s, lc) => s + lc.rcvd_from_court, 0))} {t('kd')}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button variant="outline" onClick={() => { setActiveView('overview'); setCustomerReportData(null); setSelectedCustomerId(''); }} className="mt-2">
                &larr; {t('backToReports')}
              </Button>
            </>
          ) : null}
        </div>
      )}

    </div>
  );
}
