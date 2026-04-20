import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { DataExport } from '@/components/shared/DataExport';
import { Search, FileSearch, ChevronDown, ChevronUp } from 'lucide-react';
import { isBefore } from 'date-fns';

interface Customer {
  id: string; customer_no: string; name: string; civil_id: string; mobile: string;
  email: string; work_place: string;
}

interface Contract {
  id: string; contract_no: string; customer_id: string; customer_name: string;
  item_name: string; model_type: string; category: string;
  sale_price: number; paid_amount: number; remaining_amount: number;
  file_opening_charges: number; duration_months: number; installment_amount: number;
  start_date: string; end_date: string; first_installment_date: string;
  last_installment_date: string; payment_mode: string; status: string;
  installment_schedule: any[]; created_at: string;
}

export default function ContractLookupPage() {
  const { t } = useLang();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerContracts, setCustomerContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [expandedSchedule, setExpandedSchedule] = useState(false);
  const [, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [custRes, contRes] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('contracts').select('*').order('created_at', { ascending: false }),
    ]);
    setCustomers(custRes.data || []);
    setContracts(contRes.data || []);
    setLoading(false);
  }

  const filteredCustomers = search.trim()
    ? customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.civil_id.includes(search) ||
        c.mobile.includes(search) ||
        c.customer_no?.includes(search)
      )
    : [];

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setSelectedContract(null);
    setExpandedSchedule(false);
    const custContracts = contracts.filter(ct => ct.customer_id === c.id);
    setCustomerContracts(custContracts);
  }

  function selectContract(ct: Contract) {
    setSelectedContract(ct);
    setExpandedSchedule(true);
  }

  const today = new Date();

  const exportHeaders = selectedContract
    ? ['#', t('dueDate'), t('amount'), t('status'), t('paymentDate'), t('runningBalance')]
    : [t('contractNo'), t('itemName'), t('salePrice'), t('paidAmount'), t('remainingAmount'), t('status')];

  const exportRows = selectedContract
    ? (selectedContract.installment_schedule || []).map((inst: any, i: number) => {
        const runningPaid = (selectedContract.installment_schedule || []).slice(0, i + 1)
          .filter((s: any) => s.status === 'paid').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
        const balance = (selectedContract.sale_price || 0) - runningPaid;
        return [i + 1, inst.due_date, inst.amount, inst.status === 'paid' ? 'Paid' : 'Unpaid', inst.paid_date || '-', balance];
      })
    : customerContracts.map(ct => [ct.contract_no, ct.item_name, ct.sale_price, ct.paid_amount, ct.remaining_amount, ct.status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('contractLookup')}</h1>
          <p className="text-slate-500 text-sm">{t('searchByNameMobileCivil')}</p>
        </div>
        <DataExport
          title={selectedContract ? `${selectedContract.contract_no} - ${t('installmentPlan')}` : t('contractLookup')}
          headers={exportHeaders}
          rows={exportRows}
          filename="contract-lookup"
        />
      </div>

      {/* Search Box */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('searchByNameMobileCivil')}
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedCustomer(null); setSelectedContract(null); }}
              className="ps-9 text-base h-12"
            />
          </div>
          {/* Search Results */}
          {search.trim() && filteredCustomers.length > 0 && !selectedCustomer && (
            <div className="mt-3 border rounded-lg max-h-60 overflow-y-auto">
              {filteredCustomers.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                  onClick={() => selectCustomer(c)}
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-slate-500">{t('civilId')}: {c.civil_id} | {t('mobileNo')}: {c.mobile}</p>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">{c.customer_no}</Badge>
                </div>
              ))}
            </div>
          )}
          {search.trim() && filteredCustomers.length === 0 && !selectedCustomer && (
            <p className="mt-3 text-sm text-slate-400">{t('noData')}</p>
          )}
        </CardContent>
      </Card>

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <Card className="border-0 shadow-md border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">{selectedCustomer.name}</h3>
              <Button variant="outline" size="sm" onClick={() => { setSelectedCustomer(null); setSelectedContract(null); setSearch(''); }}>
                {t('close')}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-500">{t('customerNo')}:</span><p className="font-medium">{selectedCustomer.customer_no}</p></div>
              <div><span className="text-slate-500">{t('civilId')}:</span><p className="font-medium font-mono">{selectedCustomer.civil_id}</p></div>
              <div><span className="text-slate-500">{t('mobileNo')}:</span><p className="font-medium">{selectedCustomer.mobile}</p></div>
              <div><span className="text-slate-500">{t('workPlace')}:</span><p className="font-medium">{selectedCustomer.work_place || '-'}</p></div>
            </div>

            {/* Contracts List */}
            <div className="mt-4 border-t pt-4">
              <h4 className="font-medium mb-3">{t('contracts')} ({customerContracts.length})</h4>
              {customerContracts.length === 0 ? (
                <p className="text-sm text-slate-400">{t('noData')}</p>
              ) : (
                <div className="space-y-2">
                  {customerContracts.map(ct => (
                    <div
                      key={ct.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedContract?.id === ct.id ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => selectContract(ct)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-blue-600">{ct.contract_no}</span>
                          <span className="text-sm text-slate-500">{ct.item_name}</span>
                          <Badge className={ct.status === 'functional' ? 'bg-blue-100 text-blue-700' : ct.status === 'finished' ? 'bg-green-100 text-green-700' : ct.status === 'case_closed' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'} variant="secondary">
                            {t(ct.status as any)}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <span className="text-green-600 font-medium">{ct.paid_amount?.toLocaleString()}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="font-medium">{ct.sale_price?.toLocaleString()} {t('kd')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Contract Details */}
      {selectedContract && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{selectedContract.contract_no} - {t('contractDetails')}</h3>
              <Button variant="ghost" size="sm" onClick={() => setExpandedSchedule(!expandedSchedule)}>
                {expandedSchedule ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>

            {/* Contract Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{t('itemName')}</p>
                <p className="font-semibold mt-1">{selectedContract.item_name || '-'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{t('modelType')}</p>
                <p className="font-semibold mt-1">{selectedContract.model_type || '-'}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600">{t('salePrice')}</p>
                <p className="font-semibold mt-1">{selectedContract.sale_price?.toLocaleString()} {t('kd')}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600">{t('paidAmount')}</p>
                <p className="font-semibold mt-1 text-green-700">{selectedContract.paid_amount?.toLocaleString()} {t('kd')}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-600">{t('remainingAmount')}</p>
                <p className="font-semibold mt-1 text-red-700">{selectedContract.remaining_amount?.toLocaleString()} {t('kd')}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-amber-600">{t('fileOpeningCharges')}</p>
                <p className="font-semibold mt-1">{selectedContract.file_opening_charges?.toLocaleString()} {t('kd')}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{t('duration')}</p>
                <p className="font-semibold mt-1">{selectedContract.duration_months} {t('months')}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{t('startDate')}</p>
                <p className="font-semibold mt-1">{selectedContract.start_date}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{t('endDate')}</p>
                <p className="font-semibold mt-1">{selectedContract.end_date || selectedContract.last_installment_date || '-'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{t('paymentMode')}</p>
                <p className="font-semibold mt-1">{selectedContract.payment_mode}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{t('installmentAmount')}</p>
                <p className="font-semibold mt-1">{selectedContract.installment_amount?.toLocaleString()} {t('kd')}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{t('status')}</p>
                <Badge className={selectedContract.status === 'functional' ? 'bg-blue-100 text-blue-700' : selectedContract.status === 'finished' ? 'bg-green-100 text-green-700' : selectedContract.status === 'case_closed' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'} variant="secondary">
                  {t(selectedContract.status as any)}
                </Badge>
              </div>
            </div>

            {/* Progress Bar */}
            {(() => {
              const schedule = selectedContract.installment_schedule || [];
              const paidCount = schedule.filter((s: any) => s.status === 'paid').length;
              return (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{t('paidInstallments')}: {paidCount}/{schedule.length}</span>
                    <span>{Math.round(paidCount / Math.max(1, schedule.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${paidCount / Math.max(1, schedule.length) * 100}%` }} />
                  </div>
                </div>
              );
            })()}

            {/* Installment Schedule Table */}
            {expandedSchedule && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-start py-2.5 px-3 font-medium text-slate-600">#</th>
                      <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('dueDate')}</th>
                      <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('amount')}</th>
                      <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('status')}</th>
                      <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('paymentDate')}</th>
                      <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('runningBalance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedContract.installment_schedule || []).map((inst: any, i: number) => {
                      const runningPaid = (selectedContract.installment_schedule || []).slice(0, i + 1)
                        .filter((s: any) => s.status === 'paid').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
                      const balance = (selectedContract.sale_price || 0) - runningPaid;
                      const isOverdue = inst.status !== 'paid' && isBefore(new Date(inst.due_date), today);
                      return (
                        <tr key={i} className={`border-b border-slate-100 ${inst.status === 'paid' ? 'bg-green-50/50' : isOverdue ? 'bg-red-50/50' : ''}`}>
                          <td className="py-2.5 px-3 font-medium">{inst.month || i + 1}</td>
                          <td className="py-2.5 px-3">{inst.due_date}</td>
                          <td className="py-2.5 px-3 font-medium">{inst.amount?.toLocaleString()} {t('kd')}</td>
                          <td className="py-2.5 px-3">
                            <Badge className={inst.status === 'paid' ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} variant="secondary">
                              {inst.status === 'paid' ? t('paid') : isOverdue ? t('overdue') : t('unpaid')}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{inst.paid_date || '-'}</td>
                          <td className="py-2.5 px-3 font-medium">{balance.toLocaleString()} {t('kd')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedCustomer && !search.trim() && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-20 text-center text-slate-400">
            <FileSearch className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-1">{t('contractLookup')}</p>
            <p className="text-sm">{t('searchByNameMobileCivil')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
