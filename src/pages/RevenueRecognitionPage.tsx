import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { DataExport } from '@/components/shared/DataExport';
import { Search, TrendingUp, Calendar } from 'lucide-react';

interface Contract {
  id: string; contract_no: string; customer_id: string; customer_name: string;
  sale_price: number; paid_amount: number; remaining_amount: number;
  duration_months: number; start_date: string; installment_schedule: any[];
  installment_amount: number; file_opening_charges: number;
}

interface CustomerRevenue {
  customer_id: string; customer_name: string; contracts: Contract[];
  totalValue: number; totalRecognized: number; totalPaid: number;
  monthlySchedule: { month: string; recognized: number; paid: number; balance: number }[];
}

export default function RevenueRecognitionPage() {
  const { t } = useLang();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    let contQuery = supabase.from('contracts').select('*');
    if (fromDate) contQuery = contQuery.gte('start_date', fromDate);
    if (toDate) contQuery = contQuery.lte('start_date', toDate);
    const [contRes, recRes] = await Promise.all([
      contQuery.order('customer_name'),
      supabase.from('receipt_vouchers').select('customer_id, received_amount, receipt_date, receipt_type'),
    ]);
    setContracts(contRes.data || []);
    setReceipts(recRes.data || []);
    setLoading(false);
  }

  function buildCustomerRevenue(): CustomerRevenue[] {
    const byCustomer = new Map<string, Contract[]>();
    contracts.forEach(c => {
      const list = byCustomer.get(c.customer_id) || [];
      list.push(c);
      byCustomer.set(c.customer_id, list);
    });

    return [...byCustomer.entries()].map(([customerId, custContracts]) => {
      const customerName = custContracts[0]?.customer_name || '';
      const totalValue = custContracts.reduce((s, c) => s + (c.sale_price || 0), 0);
      const totalPaid = custContracts.reduce((s, c) => s + (c.paid_amount || 0), 0);

      // Build month-wise schedule from all contracts
      const monthMap = new Map<string, { recognized: number; paid: number }>();
      custContracts.forEach(c => {
        const schedule = c.installment_schedule || [];
        schedule.forEach((inst: any) => {
          if (!inst.due_date) return;
          const month = inst.due_date.substring(0, 7); // YYYY-MM
          const existing = monthMap.get(month) || { recognized: 0, paid: 0 };
          existing.recognized += inst.amount || 0;
          if (inst.status === 'paid') existing.paid += inst.amount || 0;
          monthMap.set(month, existing);
        });
      });

      // Also count receipts paid per month
      const custReceipts = receipts.filter(r => r.customer_id === customerId);
      custReceipts.forEach(r => {
        if (!r.receipt_date) return;
        const month = r.receipt_date.substring(0, 7);
        const existing = monthMap.get(month) || { recognized: 0, paid: 0 };
        existing.paid += r.received_amount || 0;
        monthMap.set(month, existing);
      });

      const months = [...monthMap.keys()].sort();
      let runningBalance = 0;
      const monthlySchedule = months.map(month => {
        const data = monthMap.get(month)!;
        runningBalance += data.recognized - data.paid;
        return { month, recognized: data.recognized, paid: data.paid, balance: runningBalance };
      });

      return {
        customer_id: customerId, customer_name: customerName, contracts: custContracts,
        totalValue, totalRecognized: totalValue, totalPaid, monthlySchedule,
      };
    });
  }

  const allCustomerRevenue = buildCustomerRevenue();
  const filtered = allCustomerRevenue.filter(cr =>
    cr.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  const grandTotalValue = filtered.reduce((s, cr) => s + cr.totalValue, 0);
  const grandTotalPaid = filtered.reduce((s, cr) => s + cr.totalPaid, 0);

  const exportHeaders = [t('customerName'), t('totalContractValue'), t('totalPaid'), t('remainingAmount')];
  const exportRows = filtered.map(cr => [cr.customer_name, cr.totalValue, cr.totalPaid, cr.totalValue - cr.totalPaid]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('revenueRecognition')}</h1>
          <p className="text-slate-500 text-sm">{filtered.length} customers</p>
        </div>
        <DataExport title={t('revenueRecognition')} headers={exportHeaders} rows={exportRows} filename="revenue-recognition" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">{t('totalContractValue')}</p><p className="text-2xl font-bold text-blue-600">{grandTotalValue.toLocaleString()} {t('kd')}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">{t('totalPaid')}</p><p className="text-2xl font-bold text-green-600">{grandTotalPaid.toLocaleString()} {t('kd')}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">{t('remainingAmount')}</p><p className="text-2xl font-bold text-red-600">{(grandTotalValue - grandTotalPaid).toLocaleString()} {t('kd')}</p></CardContent></Card>
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

      {loading ? (
        <div className="py-20 text-center text-slate-400">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <TrendingUp className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(cr => (
            <Card key={cr.customer_id} className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{cr.customer_name}</span>
                  <span className="text-sm text-slate-500">{cr.contracts.length} contract(s)</span>
                </CardTitle>
                <div className="flex gap-4 text-xs">
                  <span className="text-blue-600">{t('totalContractValue')}: {cr.totalValue.toLocaleString()} {t('kd')}</span>
                  <span className="text-green-600">{t('totalPaid')}: {cr.totalPaid.toLocaleString()} {t('kd')}</span>
                  <span className="text-red-600">{t('remainingAmount')}: {(cr.totalValue - cr.totalPaid).toLocaleString()} {t('kd')}</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {cr.monthlySchedule.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-start py-2 px-4 font-medium text-slate-600">{t('month')}</th>
                          <th className="text-start py-2 px-4 font-medium text-slate-600">{t('recognizedRevenue')}</th>
                          <th className="text-start py-2 px-4 font-medium text-slate-600">{t('paidAmount')}</th>
                          <th className="text-start py-2 px-4 font-medium text-slate-600">{t('balanceAmount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cr.monthlySchedule.map((m, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="py-2 px-4 font-medium">{m.month}</td>
                            <td className="py-2 px-4">{m.recognized.toLocaleString()} {t('kd')}</td>
                            <td className="py-2 px-4 text-green-600">{m.paid.toLocaleString()} {t('kd')}</td>
                            <td className="py-2 px-4 text-amber-600">{m.balance.toLocaleString()} {t('kd')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 px-4 pb-4">{t('noData')}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
