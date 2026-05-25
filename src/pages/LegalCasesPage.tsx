import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { FileAttachment } from '@/components/shared/FileAttachment';
import { DataExport } from '@/components/shared/DataExport';
import { Plus, Search, Pencil, Trash2, Scale, DollarSign } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Pagination } from '@/components/ui/pagination';

interface LegalCase {
  id: string; legal_case_no: string; customer_id: string; customer_name: string;
  contract_id: string; contract_no: string; case_no: string; purchase_price: number;
  original_amount: number; remaining_from_customer: number; case_amount: number;
  rcvd_from_customer: number; rcvd_from_court: number; balance_amount: number;
  case_date: string; court_fees: number; attachments: string[]; created_at: string;
}

interface Contract {
  id: string; contract_no: string; customer_id: string; customer_name: string;
  sale_price: number; remaining_amount: number; purchase_price: number; status: string;
}

const defaultForm = {
  customer_id: '', contract_id: '', case_no: '', purchase_price: 0,
  original_amount: 0, remaining_from_customer: 0, case_amount: 0,
  rcvd_from_customer: 0, rcvd_from_court: 0, case_date: '', attachments: [] as string[],
};

export default function LegalCasesPage() {
  const { t } = useLang();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<LegalCase | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showPaymentDetail, setShowPaymentDetail] = useState<LegalCase | null>(null);
  const [caseReceipts, setCaseReceipts] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    let casesQuery = supabase.from('legal_cases').select('*').order('created_at', { ascending: false });
    if (fromDate) casesQuery = casesQuery.gte('created_at', fromDate);
    if (toDate) casesQuery = casesQuery.lte('created_at', toDate + 'T23:59:59');
    const [casesRes, contractsRes] = await Promise.all([
      casesQuery,
      supabase.from('contracts').select('*').in('status', ['legal_case', 'case_closed']),
    ]);
    setCases(casesRes.data || []);
    setContracts(contractsRes.data || []);
    setLoading(false);
  }


  async function openPaymentDetail(lc: LegalCase) {
    setShowPaymentDetail(lc);
    const { data } = await supabase.from('receipt_vouchers').select('*')
      .eq('receipt_type', 'courtMoney')
      .eq('court_case_no', lc.case_no)
      .order('receipt_date', { ascending: true });
    setCaseReceipts(data || []);
  }

  function calculateBalance() {
    return Math.max(0, (form.case_amount || 0) - (form.rcvd_from_court || 0));
  }

  async function handleSave() {
    const contract = contracts.find(c => c.id === form.contract_id);
    const data = {
      customer_id: form.customer_id || contract?.customer_id || '',
      customer_name: contract?.customer_name || '',
      contract_id: form.contract_id, contract_no: contract?.contract_no || '',
      case_no: form.case_no, purchase_price: form.purchase_price || contract?.purchase_price || 0,
      original_amount: form.original_amount || contract?.sale_price || 0,
      remaining_from_customer: form.remaining_from_customer || contract?.remaining_amount || 0,
      case_amount: form.case_amount, rcvd_from_customer: form.rcvd_from_customer,
      rcvd_from_court: form.rcvd_from_court, balance_amount: calculateBalance(),
      case_date: form.case_date, attachments: form.attachments,
    };
    if (editing) {
      await supabase.from('legal_cases').update(data).eq('id', editing.id);
    } else {
      await supabase.from('legal_cases').insert(data);
    }
    setShowDialog(false); setForm(defaultForm); setEditing(null); loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('legal_cases').delete().eq('id', id);
    loadData();
  }

  function openEdit(c: LegalCase) {
    setEditing(c);
    const rcvdCalc = Math.max(0, (c.original_amount || 0) - (c.remaining_from_customer || 0));
    setForm({
      customer_id: c.customer_id, contract_id: c.contract_id, case_no: c.case_no,
      purchase_price: c.purchase_price, original_amount: c.original_amount,
      remaining_from_customer: c.remaining_from_customer, case_amount: c.case_amount,
      rcvd_from_customer: rcvdCalc, rcvd_from_court: c.rcvd_from_court,
      case_date: c.case_date || '', attachments: c.attachments || [],
    });
    setShowDialog(true);
  }

  // Contracts that already have a legal case (exclude from Add dropdown, allow in Edit)
  const usedContractIds = new Set(cases.map(c => c.contract_id));

  const filtered = cases.filter(c =>
    c.legal_case_no?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.case_no?.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCases = filtered.length;
  const totalClaimed = filtered.reduce((s, c) => s + (c.case_amount || 0), 0);
  const totalActual = filtered.reduce((s, c) => s + (c.original_amount || 0), 0);
  const totalRecovered = filtered.reduce((s, c) => s + (c.rcvd_from_court || 0), 0);

  const exportHeaders = [t('customerName'), t('caseNo'), t('actualAmount'), t('claimedAmount'), t('receivedAmount'), t('outstanding'), t('caseDate')];
  const exportRows = filtered.map(c => {
    const rcvd = c.rcvd_from_court || 0;
    return [c.customer_name, c.case_no, c.original_amount, c.case_amount, rcvd, c.case_amount - rcvd, c.case_date];
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('legalCases')}</h1>
          <p className="text-slate-500 text-sm">{totalCases} cases</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('legalCases')} headers={exportHeaders} rows={exportRows} filename="legal-cases" />
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addLegalCase')}
          </Button>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md"><CardContent className="p-4"><p className="text-xs text-slate-500">{t('totalCases')}</p><p className="text-xl font-bold text-blue-600">{totalCases}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-4"><p className="text-xs text-slate-500">{t('totalClaimedAmount')}</p><p className="text-xl font-bold text-amber-600">{Math.round(totalClaimed).toLocaleString()} {t('kd')}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-4"><p className="text-xs text-slate-500">{t('actualAmount')}</p><p className="text-xl font-bold text-slate-700">{Math.round(totalActual).toLocaleString()} {t('kd')}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-4"><p className="text-xs text-slate-500">{t('amountRecovered')}</p><p className="text-xl font-bold text-green-600">{Math.round(totalRecovered).toLocaleString()} {t('kd')}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder={t('search')} value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="ps-9" />
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={fromDate} onChange={setFromDate} placeholder={t("from")} />
          <span className="text-slate-400">-</span>
          <DatePicker value={toDate} onChange={setToDate} placeholder={t("to")} />
        </div>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Scale className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('caseNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actualAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('claimedAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receivedAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('outstanding')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('caseDate')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(c => {
                    const rcvd = c.rcvd_from_court || 0;
                    const outstanding = (c.case_amount || 0) - rcvd;
                    return (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                        <td className="py-3 px-4 font-medium">{c.customer_name}</td>
                        <td className="py-3 px-4 text-blue-600">{c.case_no}</td>
                        <td className="py-3 px-4">{Math.round(c.original_amount || 0).toLocaleString()} {t('kd')}</td>
                        <td className="py-3 px-4">{Math.round(c.case_amount || 0).toLocaleString()} {t('kd')}</td>
                        <td className="py-3 px-4 text-green-600">{Math.round(rcvd).toLocaleString()} {t('kd')}</td>
                        <td className="py-3 px-4 font-medium">{Math.round(outstanding).toLocaleString()} {t('kd')}</td>
                        <td className="py-3 px-4">{c.case_date}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openPaymentDetail(c)} title={t('paymentDetails')}><DollarSign className="h-4 w-4 text-green-500" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Payment Detail Dialog */}
      <Dialog open={!!showPaymentDetail} onOpenChange={() => setShowPaymentDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showPaymentDetail?.customer_name} - {t('paymentDetails')}</DialogTitle>
          </DialogHeader>
          {showPaymentDetail && (() => {
            const totalPaid = caseReceipts.reduce((s: number, r: any) => s + (r.received_amount || 0), 0);
            const caseAmt = showPaymentDetail.case_amount || 0;
            const balance = caseAmt - totalPaid;
            return (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500">{t('caseNo')}</p>
                    <p className="font-semibold text-sm mt-1">{showPaymentDetail.case_no}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-600">{t('caseAmount')}</p>
                    <p className="font-semibold text-sm mt-1">{Math.round(caseAmt).toLocaleString()} {t('kd')}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600">{t('totalPaidAmount')}</p>
                    <p className="font-semibold text-sm mt-1 text-green-700">{Math.round(totalPaid).toLocaleString()} {t('kd')}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-600">{t('balanceAmount')}</p>
                    <p className="font-semibold text-sm mt-1 text-red-700">{Math.round(balance).toLocaleString()} {t('kd')}</p>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{t('paid')}: {Math.round(totalPaid).toLocaleString()} / {Math.round(caseAmt).toLocaleString()} {t('kd')}</span>
                    <span>{caseAmt > 0 ? Math.round(totalPaid / caseAmt * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${caseAmt > 0 ? Math.min(100, totalPaid / caseAmt * 100) : 0}%` }} />
                  </div>
                </div>

                {/* Receipts/Payments Table */}
                <div>
                  <h4 className="font-medium mb-2">{t('paymentHistory')}</h4>
                  {caseReceipts.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('noData')}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-start py-2.5 px-3 font-medium text-slate-600">#</th>
                          <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('receiptDate')}</th>
                          <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('receiptType')}</th>
                          <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('receivedAmount')}</th>
                          <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('paymentMode')}</th>
                          <th className="text-start py-2.5 px-3 font-medium text-slate-600">{t('runningBalance')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {caseReceipts.map((r: any, i: number) => {
                          const runningPaid = caseReceipts.slice(0, i + 1).reduce((s: number, rr: any) => s + (rr.received_amount || 0), 0);
                          const rb = caseAmt - runningPaid;
                          return (
                            <tr key={r.id} className="border-b border-slate-100">
                              <td className="py-2.5 px-3">{i + 1}</td>
                              <td className="py-2.5 px-3">{r.receipt_date}</td>
                              <td className="py-2.5 px-3">{t(r.receipt_type as any) || r.receipt_type}</td>
                              <td className="py-2.5 px-3 font-medium text-green-600">{Math.round(r.received_amount || 0).toLocaleString()} {t('kd')}</td>
                              <td className="py-2.5 px-3">{r.payment_mode}</td>
                              <td className="py-2.5 px-3 font-medium">{Math.round(rb).toLocaleString()} {t('kd')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('editLegalCase') : t('addLegalCase')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('contractNo')} *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.contract_id} onChange={e => {
                  const contract = contracts.find(c => c.id === e.target.value);
                  const origAmt = contract?.sale_price || 0;
                  const remFromCust = contract?.remaining_amount || 0;
                  setForm({ ...form, contract_id: e.target.value, customer_id: contract?.customer_id || '', purchase_price: contract?.purchase_price || 0, original_amount: origAmt, remaining_from_customer: remFromCust, rcvd_from_customer: Math.max(0, origAmt - remFromCust) });
                }}>
                  <option value="">Select Contract</option>
                  {editing && form.contract_id && !contracts.find(c => c.id === form.contract_id) && (
                    <option value={form.contract_id}>{editing.contract_no} - {editing.customer_name}</option>
                  )}
                  {contracts.filter(c => editing ? true : !usedContractIds.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.contract_no} - {c.customer_name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('caseNo')} *</Label>
                <Input value={form.case_no} onChange={e => setForm({ ...form, case_no: e.target.value })} />
              </div>
              <div>
                <Label>{t('caseDate')}</Label>
                <DatePicker value={form.case_date} onChange={(v) => setForm({ ...form, case_date: v })} placeholder={t("date")} className="w-full" />
              </div>
              <div>
                <Label>{t('purchasePrice')}</Label>
                <Input type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('originalAmount')}</Label>
                <Input type="number" value={form.original_amount} onChange={e => { const v = Number(e.target.value); setForm({ ...form, original_amount: v, rcvd_from_customer: Math.max(0, v - (form.remaining_from_customer || 0)) }); }} />
              </div>
              <div>
                <Label>{t('remainingFromCustomer')}</Label>
                <Input type="number" value={form.remaining_from_customer} onChange={e => { const v = Number(e.target.value); setForm({ ...form, remaining_from_customer: v, rcvd_from_customer: Math.max(0, (form.original_amount || 0) - v) }); }} />
              </div>
              <div>
                <Label>{t('caseAmount')}</Label>
                <Input type="number" value={form.case_amount} onChange={e => setForm({ ...form, case_amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('rcvdFromCustomer')}</Label>
                <Input type="number" value={form.rcvd_from_customer} readOnly className="bg-slate-100" />
              </div>
              <div>
                <Label>{t('rcvdFromCourt')}</Label>
                <Input type="number" value={form.rcvd_from_court} onChange={e => setForm({ ...form, rcvd_from_court: Number(e.target.value) })} />
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-1">{t('balanceAmount')}</h4>
              <p className="text-2xl font-bold text-blue-700">{Math.round(calculateBalance()).toLocaleString()} {t('kd')}</p>
              <p className="text-xs text-blue-600 mt-1">{t('caseAmount')} - {t('rcvdFromCourt')}</p>
            </div>
            <FileAttachment bucket="legal" folder={editing?.id || 'new'} files={form.attachments} onFilesChange={files => setForm({ ...form, attachments: files })} />
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
