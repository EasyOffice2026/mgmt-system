import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { Users, TrendingUp, DollarSign, Receipt, AlertTriangle, Briefcase, CheckSquare, Gavel, Lock } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { isBefore } from 'date-fns';

export default function DashboardPage() {
  const { t } = useLang();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [stats, setStats] = useState({
    totalCustomers: 0, activeContracts: 0, totalRevenue: 0, totalRemaining: 0, totalExpenses: 0, legalCases: 0,
    operationalCases: 0, finishedCases: 0, legalFinishedCases: 0, lateCases: 0, caseClosed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    try {
      const custQuery = supabase.from('customers').select('id', { count: 'exact', head: true });
      let contQuery = supabase.from('contracts').select('*');
      let expQuery = supabase.from('expenses').select('amount');
      let recQuery = supabase.from('receipt_vouchers').select('received_amount');
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
      const [custRes, contRes, expRes, recRes] = await Promise.all([
        custQuery, contQuery.order('created_at', { ascending: false }), expQuery, recQuery,
      ]);
      const allContracts = contRes.data || [];
      const totalRevenue = allContracts.reduce((s: number, c: any) => s + (c.sale_price || 0), 0);
      const totalReceivedAmounts = (recRes.data || []).reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
      const totalRemaining = totalRevenue - totalReceivedAmounts;
      const totalExpenses = (expRes.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);

      const operationalCases = allContracts.filter((c: any) => c.status === 'functional' || c.status === 'ongoing').length;
      const finishedCases = allContracts.filter((c: any) => c.status === 'finished' || c.status === 'closed').length;
      const legalCasesCount = allContracts.filter((c: any) => c.status === 'legal_case').length;
      const caseClosed = allContracts.filter((c: any) => c.status === 'case_closed').length;

      const today = new Date();
      let lateCases = 0;
      allContracts.forEach((c: any) => {
        if (c.status !== 'functional' && c.status !== 'ongoing') return;
        const schedule = c.installment_schedule || c.installments || [];
        if (!Array.isArray(schedule)) return;
        const hasOverdue = schedule.some((inst: any) => {
          if (inst.status === 'paid') return false;
          const dueDate = inst.due_date ? new Date(inst.due_date) : null;
          return dueDate ? isBefore(dueDate, today) : false;
        });
        if (hasOverdue) lateCases++;
      });

      setStats({
        totalCustomers: custRes.count || 0,
        activeContracts: allContracts.length,
        totalRevenue, totalRemaining, totalExpenses,
        legalCases: legalCasesCount,
        operationalCases, finishedCases, legalFinishedCases: 0, lateCases, caseClosed,
      });
    } catch (err) { console.error('Dashboard load error:', err); }
    setLoading(false);
  }

  const totalContracts = stats.operationalCases + stats.finishedCases + stats.legalCases + stats.caseClosed;

  const kpiCards = [
    { title: t('totalCustomers'), value: stats.totalCustomers, icon: Users, color: 'from-blue-500 to-blue-600', tc: 'text-blue-600', bg: 'bg-blue-50' },
    { title: t('functional'), value: stats.operationalCases, icon: Briefcase, color: 'from-emerald-500 to-emerald-600', tc: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: t('closed'), value: stats.finishedCases, icon: CheckSquare, color: 'from-green-500 to-green-600', tc: 'text-green-600', bg: 'bg-green-50' },
    { title: t('legalCase'), value: stats.legalCases, icon: Gavel, color: 'from-red-500 to-red-600', tc: 'text-red-600', bg: 'bg-red-50' },
    { title: t('caseClosed'), value: stats.caseClosed, icon: Lock, color: 'from-purple-500 to-purple-600', tc: 'text-purple-600', bg: 'bg-purple-50' },
    { title: t('totalRevenue'), value: `${stats.totalRevenue.toLocaleString()} ${t('kd')}`, icon: TrendingUp, color: 'from-teal-500 to-teal-600', tc: 'text-teal-600', bg: 'bg-teal-50' },
    { title: t('totalRemaining'), value: `${stats.totalRemaining.toLocaleString()} ${t('kd')}`, icon: DollarSign, color: 'from-amber-500 to-amber-600', tc: 'text-amber-600', bg: 'bg-amber-50' },
    { title: t('totalExpenses'), value: `${stats.totalExpenses.toLocaleString()} ${t('kd')}`, icon: Receipt, color: 'from-rose-500 to-rose-600', tc: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const contractBreakdown = [
    { label: t('functional'), count: stats.operationalCases, color: 'bg-emerald-500', pct: totalContracts > 0 ? (stats.operationalCases / totalContracts) * 100 : 0 },
    { label: t('closed'), count: stats.finishedCases, color: 'bg-green-500', pct: totalContracts > 0 ? (stats.finishedCases / totalContracts) * 100 : 0 },
    { label: t('legalCase'), count: stats.legalCases, color: 'bg-red-500', pct: totalContracts > 0 ? (stats.legalCases / totalContracts) * 100 : 0 },
    { label: t('caseClosed'), count: stats.caseClosed, color: 'bg-purple-500', pct: totalContracts > 0 ? (stats.caseClosed / totalContracts) * 100 : 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard')}</h1>
          <p className="text-slate-500 text-sm">{t('welcome')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-sm text-slate-600">{t('from')}:</Label>
          <DatePicker value={fromDate} onChange={setFromDate} placeholder={t('from')} />
          <Label className="text-sm text-slate-600">{t('to')}:</Label>
          <DatePicker value={toDate} onChange={setToDate} placeholder={t('to')} />
        </div>
      </div>
      {loading ? (
        <div className="py-20 text-center text-slate-400">{t('loading')}</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((card, i) => (
              <Card key={i} className="border-0 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{card.title}</p>
                      <p className={`text-2xl font-bold mt-1.5 ${card.tc}`}>{card.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                      <card.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contract Status Breakdown */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-500" />
                {t('contractStatus') || 'Contract Status Breakdown'}
                <span className="text-sm font-normal text-slate-400 ms-2">({totalContracts} {t('total')})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Stacked bar */}
              <div className="h-6 rounded-full overflow-hidden flex mb-4 shadow-inner bg-slate-100">
                {contractBreakdown.map((item, i) => (
                  item.pct > 0 && <div key={i} className={`${item.color} h-full transition-all`} style={{ width: `${item.pct}%` }} title={`${item.label}: ${item.count}`} />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {contractBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <div>
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="text-sm font-bold text-slate-800">{item.count} <span className="text-xs font-normal text-slate-400">({item.pct.toFixed(1)}%)</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Financial Overview */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-500" />
                {t('financialOverview') || 'Financial Overview'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{t('totalRevenue')}</span>
                    <span className="font-bold text-teal-600">{stats.totalRevenue.toLocaleString()} {t('kd')}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{t('received') || 'Received'}</span>
                    <span className="font-bold text-green-600">{(stats.totalRevenue - stats.totalRemaining).toLocaleString()} {t('kd')}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ width: stats.totalRevenue > 0 ? `${((stats.totalRevenue - stats.totalRemaining) / stats.totalRevenue) * 100}%` : '0%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{t('totalRemaining')}</span>
                    <span className="font-bold text-amber-600">{stats.totalRemaining.toLocaleString()} {t('kd')}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full" style={{ width: stats.totalRevenue > 0 ? `${(stats.totalRemaining / stats.totalRevenue) * 100}%` : '0%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{t('totalExpenses')}</span>
                    <span className="font-bold text-rose-600">{stats.totalExpenses.toLocaleString()} {t('kd')}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full" style={{ width: stats.totalRevenue > 0 ? `${Math.min((stats.totalExpenses / stats.totalRevenue) * 100, 100)}%` : '0%' }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delayed Contracts Card */}
          <Card className="border-0 shadow-md border-l-4 border-l-orange-500">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('delayedContracts') || 'Delayed Contracts'}</p>
                  <p className="text-3xl font-bold mt-1.5 text-orange-600">{stats.lateCases}</p>
                  <p className="text-xs text-slate-400 mt-1">{t('contractsWithOverdueInstallments') || 'Contracts with overdue installments'}</p>
                </div>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <AlertTriangle className="h-7 w-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
