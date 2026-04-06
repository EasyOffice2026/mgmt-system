import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { DataExport } from '@/components/shared/DataExport';
import { Plus, Trash2, Calculator, TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';

interface MonthlySummary {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalReceipts: number;
  dueFromCustomers: number;
  dueFromCourt: number;
  remainingFromCourt: number;
  netIncome: number;
}

interface Partner {
  id: string;
  partner_name: string;
  contribution: number;
  amount_received: number;
  share_percentage: number;
  created_at: string;
}

const defaultPartner = { partner_name: '', contribution: 0, amount_received: 0, share_percentage: 0 };

export default function AccountingPage() {
  const { t } = useLang();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summary, setSummary] = useState<MonthlySummary>({
    totalSales: 0, totalPurchases: 0, totalExpenses: 0, totalReceipts: 0,
    dueFromCustomers: 0, dueFromCourt: 0, remainingFromCourt: 0, netIncome: 0,
  });
  const [partners, setPartners] = useState<Partner[]>([]);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [partnerForm, setPartnerForm] = useState(defaultPartner);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [selectedMonth]);

  async function loadData() {
    setLoading(true);
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const [contractsRes, purchasesRes, expensesRes, receiptsRes, legalRes, partnersRes] = await Promise.all([
      supabase.from('contracts').select('sale_price, remaining_amount, status, start_date').gte('start_date', startDate).lte('start_date', endDate),
      supabase.from('purchases').select('purchase_price, purchase_date').gte('purchase_date', startDate).lte('purchase_date', endDate),
      supabase.from('expenses').select('amount, expense_date').gte('expense_date', startDate).lte('expense_date', endDate),
      supabase.from('receipt_vouchers').select('received_amount, receipt_date').gte('receipt_date', startDate).lte('receipt_date', endDate),
      supabase.from('legal_cases').select('remaining_from_customer, rcvd_from_court, case_amount'),
      supabase.from('partners').select('*').order('created_at', { ascending: true }),
    ]);

    const contracts = contractsRes.data || [];
    const purchases = purchasesRes.data || [];
    const expenses = expensesRes.data || [];
    const receipts = receiptsRes.data || [];
    const legalCases = legalRes.data || [];

    const totalSales = contracts.reduce((sum, c) => sum + (c.sale_price || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalReceipts = receipts.reduce((sum, r) => sum + (r.received_amount || 0), 0);
    const dueFromCustomers = contracts.reduce((sum, c) => sum + (c.remaining_amount || 0), 0);
    const dueFromCourt = legalCases.reduce((sum, lc) => sum + (lc.case_amount || 0), 0);
    const remainingFromCourt = dueFromCourt - legalCases.reduce((sum, lc) => sum + (lc.rcvd_from_court || 0), 0);

    setSummary({
      totalSales, totalPurchases, totalExpenses, totalReceipts,
      dueFromCustomers, dueFromCourt, remainingFromCourt,
      netIncome: totalReceipts - totalExpenses - totalPurchases,
    });
    setPartners(partnersRes.data || []);
    setLoading(false);
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

  const summaryCards = [
    { title: t('totalSales'), value: summary.totalSales, icon: TrendingUp, color: 'from-blue-500 to-blue-600', textColor: 'text-blue-600' },
    { title: t('totalPurchases'), value: summary.totalPurchases, icon: DollarSign, color: 'from-amber-500 to-amber-600', textColor: 'text-amber-600' },
    { title: t('totalExpenses'), value: summary.totalExpenses, icon: TrendingDown, color: 'from-red-500 to-red-600', textColor: 'text-red-600' },
    { title: t('dueFromCustomers'), value: summary.dueFromCustomers, icon: Users, color: 'from-purple-500 to-purple-600', textColor: 'text-purple-600' },
    { title: t('remainingFromCourt'), value: summary.remainingFromCourt, icon: Calculator, color: 'from-indigo-500 to-indigo-600', textColor: 'text-indigo-600' },
    { title: t('netIncome'), value: summary.netIncome, icon: DollarSign, color: summary.netIncome >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600', textColor: summary.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600' },
  ];

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

      {loading ? (
        <div className="py-20 text-center text-slate-400">{t('loading')}</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaryCards.map((card, i) => (
              <Card key={i} className="border-0 shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 font-medium">{card.title}</p>
                      <p className={`text-2xl font-bold mt-1 ${card.textColor}`}>
                        {card.value.toLocaleString()} {t('kd')}
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                      <card.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
