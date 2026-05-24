import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { Users, TrendingUp, DollarSign, Receipt, Calendar, AlertTriangle, CheckCircle, Briefcase, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isBefore } from 'date-fns';

export default function DashboardPage() {
  const { t } = useLang();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [stats, setStats] = useState({
    totalCustomers: 0, activeContracts: 0, totalRevenue: 0, totalRemaining: 0, totalExpenses: 0, legalCases: 0,
    operationalCases: 0, finishedCases: 0, legalFinishedCases: 0, lateCases: 0,
  });
  const [contracts, setContracts] = useState<any[]>([]);
  const [dueInstallments, setDueInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    try {
      const custQuery = supabase.from('customers').select('id', { count: 'exact', head: true });
      let contQuery = supabase.from('contracts').select('*');
      let expQuery = supabase.from('expenses').select('amount');
      let recQuery = supabase.from('receipt_vouchers').select('received_amount');
      const legalQuery = supabase.from('legal_cases').select('*');
      if (fromDate) {
        contQuery = contQuery.gte('start_date', fromDate);
        expQuery = expQuery.gte('expense_date', fromDate);
        recQuery = recQuery.gte('receipt_date', fromDate);
      }
      if (toDate) {
        contQuery = contQuery.lte('start_date', toDate);
        expQuery = expQuery.lte('expense_date', toDate);
        recQuery = recQuery.lte('receipt_date', toDate);
      }
      const [custRes, contRes, expRes, recRes, legalRes] = await Promise.all([
        custQuery, contQuery.order('created_at', { ascending: false }), expQuery, recQuery, legalQuery,
      ]);
      const allContracts = contRes.data || [];
      const allLegalCases = legalRes.data || [];
      const totalRevenue = allContracts.reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
      const totalReceivedAmounts = (recRes.data || []).reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
      const totalRemaining = totalRevenue - totalReceivedAmounts;
      const totalExpenses = (expRes.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);

      // Case counts by status
      const operationalCases = allContracts.filter((c: any) => c.status === 'functional' || c.status === 'ongoing').length;
      const finishedCases = allContracts.filter((c: any) => c.status === 'finished').length;
      const legalCasesCount = allContracts.filter((c: any) => c.status === 'legal_case').length;
      const legalFinishedCases = allLegalCases.filter((lc: any) => {
        const rcvd = (lc.rcvd_from_court || 0) + (lc.rcvd_from_customer || 0);
        return rcvd >= (lc.case_amount || 0) && (lc.case_amount || 0) > 0;
      }).length;

      // Count late payment cases (contracts with overdue installments)
      const today = new Date();
      let lateCases = 0;
      const allDue: any[] = [];
      allContracts.forEach((c: any) => {
        const schedule = c.installment_schedule || c.installments || [];
        if (!Array.isArray(schedule)) return;
        let hasOverdue = false;
        schedule.forEach((inst: any, idx: number) => {
          if (inst.status !== 'paid') {
            const dueDate = inst.due_date ? new Date(inst.due_date) : null;
            const isOverdue = dueDate ? isBefore(dueDate, today) : false;
            if (isOverdue) hasOverdue = true;
            if (isOverdue) {
              allDue.push({
                contractNo: c.contract_no,
                customerName: c.customer_name,
                installmentNo: inst.month || (idx + 1),
                dueDate: inst.due_date,
                amount: inst.amount || 0,
                isOverdue,
              });
            }
          }
        });
        if (hasOverdue) lateCases++;
      });
      // Sort by due date ascending (oldest overdue first)
      allDue.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      setStats({
        totalCustomers: custRes.count || 0,
        activeContracts: allContracts.length,
        totalRevenue, totalRemaining, totalExpenses,
        legalCases: legalCasesCount,
        operationalCases, finishedCases, legalFinishedCases, lateCases,
      });
      setContracts(allContracts.slice(0, 10));
      setDueInstallments(allDue);
    } catch (err) { console.error('Dashboard load error:', err); }
    setLoading(false);
  }

  const kpiCards = [
    { title: t('totalCustomers'), value: stats.totalCustomers, icon: Users, color: 'from-blue-500 to-blue-600', tc: 'text-blue-600' },
    { title: t('functional'), value: stats.operationalCases, icon: Briefcase, color: 'from-emerald-500 to-emerald-600', tc: 'text-emerald-600' },
    { title: t('finished'), value: stats.finishedCases, icon: CheckSquare, color: 'from-green-500 to-green-600', tc: 'text-green-600' },
    { title: t('totalRevenue'), value: `${stats.totalRevenue.toLocaleString()} ${t('kd')}`, icon: TrendingUp, color: 'from-teal-500 to-teal-600', tc: 'text-teal-600' },
    { title: t('totalRemaining'), value: `${stats.totalRemaining.toLocaleString()} ${t('kd')}`, icon: DollarSign, color: 'from-amber-500 to-amber-600', tc: 'text-amber-600' },
    { title: t('totalExpenses'), value: `${stats.totalExpenses.toLocaleString()} ${t('kd')}`, icon: Receipt, color: 'from-rose-500 to-rose-600', tc: 'text-rose-600' },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard')}</h1>
          <p className="text-slate-500 text-sm">{t('welcome')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-slate-400" />
          <Label className="text-sm text-slate-600">{t('from')}:</Label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 h-9" />
          <Label className="text-sm text-slate-600">{t('to')}:</Label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 h-9" />
        </div>
      </div>
      {loading ? (
        <div className="py-20 text-center text-slate-400">{t('loading')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpiCards.map((card, i) => (
              <Card key={i} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 font-medium">{card.title}</p>
                      <p className={`text-2xl font-bold mt-1 ${card.tc}`}>{card.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                      <card.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div>
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-base">{t('recentContracts')}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('contractNo')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('customerName')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('contractDate')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('period')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('startDate')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('endDate')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('instPerMonth')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('fileFee')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('totalPaid')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.length === 0 ? (
                        <tr><td colSpan={9} className="py-8 text-center text-slate-400">{t('noData')}</td></tr>
                      ) : contracts.map((c: any) => {
                        const ipm = c.duration_months > 0 ? ((c.sale_price - (c.file_opening_charges || 0)) / c.duration_months) : 0;
                        return (
                          <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50">
                            <td className="py-2 px-3 font-medium text-blue-600">{c.contract_no}</td>
                            <td className="py-2 px-3">{c.customer_name}</td>
                            <td className="py-2 px-3">{c.start_date}</td>
                            <td className="py-2 px-3">{c.duration_months} {t('months')}</td>
                            <td className="py-2 px-3">{c.start_date}</td>
                            <td className="py-2 px-3">{c.end_date || c.last_installment_date}</td>
                            <td className="py-2 px-3">{ipm.toFixed(3)} {t('kd')}</td>
                            <td className="py-2 px-3">{(c.file_opening_charges || 0).toLocaleString()} {t('kd')}</td>
                            <td className="py-2 px-3 text-green-600">{(c.paid_amount || 0).toLocaleString()} {t('kd')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Due Installments Section */}
          <div>
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    {t('delayedInstallments') || 'Delayed Installments'}
                  </CardTitle>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t('overdue')}: {dueInstallments.length}
                    </span>
                    <span className="flex items-center gap-1 text-slate-600">
                      {t('total')}: {dueInstallments.reduce((s, d) => s + d.amount, 0).toLocaleString()} {t('kd')}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-start py-2 px-3 font-medium text-slate-600">#</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('contractNo')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('customerName')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('installmentNo')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('dueDate')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('amount')}</th>
                        <th className="text-start py-2 px-3 font-medium text-slate-600">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dueInstallments.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle className="h-8 w-8 text-green-400" />
                            <span>{t('noDueInstallments')}</span>
                          </div>
                        </td></tr>
                      ) : dueInstallments.map((d, i) => (
                        <tr key={i} className={`border-b border-slate-100 ${d.isOverdue ? 'bg-red-50/50' : 'hover:bg-blue-50/50'}`}>
                          <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                          <td className="py-2 px-3 font-medium text-blue-600">{d.contractNo}</td>
                          <td className="py-2 px-3">{d.customerName}</td>
                          <td className="py-2 px-3">{d.installmentNo}</td>
                          <td className="py-2 px-3">{d.dueDate}</td>
                          <td className="py-2 px-3 font-medium">{d.amount.toLocaleString()} {t('kd')}</td>
                          <td className="py-2 px-3">
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100" variant="secondary">
                              <AlertTriangle className="h-3 w-3 mr-1" /> {t('overdue')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
