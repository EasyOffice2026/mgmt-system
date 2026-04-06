import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { Users, ShoppingCart, Receipt, Scale, TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

interface Stats {
  totalCustomers: number;
  activeContracts: number;
  totalRevenue: number;
  totalDue: number;
  totalExpenses: number;
  legalCases: number;
  contractsByStatus: { name: string; value: number }[];
  monthlyData: { month: string; sales: number; expenses: number }[];
  recentContracts: { id: string; contract_no: string; customer_name: string; sale_price: number; status: string }[];
}

export default function DashboardPage() {
  const { t } = useLang();
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0, activeContracts: 0, totalRevenue: 0, totalDue: 0,
    totalExpenses: 0, legalCases: 0,
    contractsByStatus: [], monthlyData: [], recentContracts: [],
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [custRes, contractRes, expenseRes, legalRes, receiptRes] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('contracts').select('*'),
        supabase.from('expenses').select('amount'),
        supabase.from('legal_cases').select('id', { count: 'exact', head: true }),
        supabase.from('receipt_vouchers').select('received_amount'),
      ]);

      const contracts = contractRes.data || [];
      const expenses = expenseRes.data || [];
      const receipts = receiptRes.data || [];

      const totalRevenue = receipts.reduce((sum, r) => sum + (r.received_amount || 0), 0);
      const totalDue = contracts.reduce((sum, c) => sum + (c.remaining_amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const activeContracts = contracts.filter(c => c.status === 'ongoing').length;

      const statusCounts: Record<string, number> = {};
      contracts.forEach(c => { statusCounts[c.status || 'ongoing'] = (statusCounts[c.status || 'ongoing'] || 0) + 1; });
      const contractsByStatus = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      setStats({
        totalCustomers: custRes.count || 0,
        activeContracts,
        totalRevenue,
        totalDue,
        totalExpenses,
        legalCases: legalRes.count || 0,
        contractsByStatus,
        monthlyData: [],
        recentContracts: contracts.slice(0, 5).map(c => ({
          id: c.id, contract_no: c.contract_no, customer_name: c.customer_name || '',
          sale_price: c.sale_price || 0, status: c.status || 'ongoing',
        })),
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  const kpiCards = [
    { title: t('totalCustomers'), value: stats.totalCustomers, icon: Users, color: 'from-blue-500 to-blue-600' },
    { title: t('activeContracts'), value: stats.activeContracts, icon: ShoppingCart, color: 'from-emerald-500 to-emerald-600' },
    { title: t('totalRevenue'), value: `${stats.totalRevenue.toLocaleString()} ${t('kd')}`, icon: TrendingUp, color: 'from-indigo-500 to-indigo-600' },
    { title: t('totalDue'), value: `${stats.totalDue.toLocaleString()} ${t('kd')}`, icon: DollarSign, color: 'from-amber-500 to-amber-600' },
    { title: t('totalExpenses'), value: `${stats.totalExpenses.toLocaleString()} ${t('kd')}`, icon: TrendingDown, color: 'from-red-500 to-red-600' },
    { title: t('legalCases'), value: stats.legalCases, icon: Scale, color: 'from-purple-500 to-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('welcome')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card, i) => (
          <Card key={i} className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">{card.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contracts by Status */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base">{t('contractsByStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.contractsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={stats.contractsByStatus} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {stats.contractsByStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2" />
                  <p>{t('noData')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base">{t('monthlyRevenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('totalSales')} />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name={t('totalExpenses')} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2" />
                  <p>{t('noData')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Contracts */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-base">{t('recentContracts')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentContracts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-start py-3 px-4 font-medium text-slate-500">{t('contractNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-500">{t('customerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-500">{t('salePrice')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-500">{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentContracts.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{c.contract_no}</td>
                      <td className="py-3 px-4">{c.customer_name}</td>
                      <td className="py-3 px-4">{c.sale_price.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          c.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                          c.status === 'finished' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <Receipt className="h-10 w-10 mx-auto mb-2" />
              <p>{t('noData')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
