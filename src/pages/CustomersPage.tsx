import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { FileAttachment } from '@/components/shared/FileAttachment';
import { DataExport } from '@/components/shared/DataExport';
import { Plus, Search, Pencil, Trash2, Users, Calendar, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { isBefore } from 'date-fns';

interface Customer {
  id: string; customer_no: string; name: string; civil_id: string; mobile: string;
  passport_no: string; email: string; work_place: string; client_check: string; area_name: string; block_no: string;
  street_no: string; house_no: string; attachments: string[]; created_at: string;
}

const clientCheckOptions = ['premium', 'good', 'average', 'poor', 'black_list'];

interface ContractDetail {
  id: string; contract_no: string; sale_price: number; paid_amount: number; remaining_amount: number; status: string;
  installment_schedule: any[]; item_name: string; start_date: string; end_date: string; duration_months: number;
  installment_amount: number; file_opening_charges: number;
}

const emptyCustomer = {
  name: '', civil_id: '', mobile: '', passport_no: '', email: '', work_place: '', client_check: '',
  area_name: '', block_no: '', street_no: '', house_no: '', attachments: [] as string[],
};

export default function CustomersPage() {
  const { t } = useLang();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showDetails, setShowDetails] = useState<Customer | null>(null);
  const [customerContracts, setCustomerContracts] = useState<ContractDetail[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCustomers(); }, [fromDate, toDate]);

  async function loadCustomers() {
    setLoading(true);
    let query = supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate + 'T23:59:59');
    const { data } = await query;
    setCustomers(data || []);
    setLoading(false);
  }

  const [expandedContract, setExpandedContract] = useState<string | null>(null);

  async function loadCustomerContracts(customerId: string) {
    const { data } = await supabase.from('contracts').select('id, contract_no, sale_price, paid_amount, remaining_amount, status, installment_schedule, item_name, start_date, end_date, duration_months, installment_amount, file_opening_charges').eq('customer_id', customerId);
    setCustomerContracts(data || []);
    setExpandedContract(null);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!/^\d{12}$/.test(form.civil_id)) errs.civil_id = t('civilIdInvalid');
    if (!/^\d{8}$/.test(form.mobile)) errs.mobile = t('mobileInvalid');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('emailInvalid');
    if (!form.area_name.trim()) errs.area_name = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    if (editing) {
      await supabase.from('customers').update(form).eq('id', editing.id);
    } else {
      await supabase.from('customers').insert(form);
    }
    setShowDialog(false); setForm(emptyCustomer); setEditing(null); loadCustomers();
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('deleteCustomerConfirm'))) return;
    await supabase.from('customers').delete().eq('id', id);
    loadCustomers();
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, civil_id: c.civil_id, mobile: c.mobile, passport_no: c.passport_no, email: c.email, work_place: c.work_place || '', client_check: (c as any).client_check || '', area_name: c.area_name, block_no: c.block_no, street_no: c.street_no, house_no: c.house_no, attachments: c.attachments || [] });
    setErrors({}); setShowDialog(true);
  }

  function openAdd() { setEditing(null); setForm(emptyCustomer); setErrors({}); setShowDialog(true); }

  async function openCustomerDetails(c: Customer) {
    setShowDetails(c);
    await loadCustomerContracts(c.id);
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.civil_id.includes(search) ||
    c.customer_no?.includes(search) || c.mobile.includes(search)
  );

  const exportHeaders = [t('customerNo'), t('customerName'), t('civilId'), t('mobileNo'), t('passportNo'), t('emailAddress'), t('address')];
  const exportRows = filtered.map(c => [c.customer_no, c.name, c.civil_id, c.mobile, c.passport_no, c.email, [c.area_name, c.block_no, c.street_no, c.house_no].filter(Boolean).join(', ')]);

  const totalDues = customerContracts.reduce((s, c) => s + (c.remaining_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('customers')}</h1>
          <p className="text-slate-500 text-sm">{filtered.length} {t('customers').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('customers')} headers={exportHeaders} rows={exportRows} filename="customers" />
          <Button onClick={openAdd} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            <Plus className="h-4 w-4 me-1" /> {t('addCustomer')}
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
              <Users className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customerNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('civilId')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('mobileNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('emailAddress')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('clientCheck')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => openCustomerDetails(c)}>
                      <td className="py-3 px-4 font-medium text-blue-600">{c.customer_no}</td>
                      <td className="py-3 px-4 font-medium">{c.name}</td>
                      <td className="py-3 px-4 font-mono text-xs">{c.civil_id}</td>
                      <td className="py-3 px-4">{c.mobile}</td>
                      <td className="py-3 px-4 text-slate-500">{c.email}</td>
                      <td className="py-3 px-4">
                        {(c as any).client_check && (
                          <Badge className={
                            (c as any).client_check === 'premium' ? 'bg-purple-100 text-purple-700' :
                            (c as any).client_check === 'good' ? 'bg-green-100 text-green-700' :
                            (c as any).client_check === 'average' ? 'bg-blue-100 text-blue-700' :
                            (c as any).client_check === 'poor' ? 'bg-amber-100 text-amber-700' :
                            (c as any).client_check === 'black_list' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          } variant="secondary">{t((c as any).client_check as any) || (c as any).client_check}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openCustomerDetails(c)}><Eye className="h-4 w-4 text-blue-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

      <Dialog open={!!showDetails} onOpenChange={() => setShowDetails(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showDetails?.name} - {t('contractDetails')}</DialogTitle>
          </DialogHeader>
          {showDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-slate-500">{t('customerNo')}:</span><p className="font-medium">{showDetails.customer_no}</p></div>
                <div><span className="text-slate-500">{t('civilId')}:</span><p className="font-medium font-mono">{showDetails.civil_id}</p></div>
                <div><span className="text-slate-500">{t('mobileNo')}:</span><p className="font-medium">{showDetails.mobile}</p></div>
                <div><span className="text-slate-500">{t('emailAddress')}:</span><p className="font-medium">{showDetails.email}</p></div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">{t('contracts')}</h3>
                {customerContracts.length === 0 ? (
                  <p className="text-slate-400 text-sm">{t('noData')}</p>
                ) : (
                  <div className="space-y-3">
                    {customerContracts.map(ct => {
                      const schedule = ct.installment_schedule || [];
                      const paidCount = schedule.filter((s: any) => s.status === 'paid').length;
                      const isExpanded = expandedContract === ct.id;
                      const today = new Date();
                      return (
                        <div key={ct.id} className="border rounded-lg overflow-hidden">
                          {/* Contract Header Row */}
                          <div
                            className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => setExpandedContract(isExpanded ? null : ct.id)}
                          >
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="font-medium text-blue-600">{ct.contract_no}</span>
                              <span className="text-sm text-slate-500">{ct.item_name}</span>
                              <Badge className={ct.status === 'functional' ? 'bg-blue-100 text-blue-700' : ct.status === 'finished' ? 'bg-green-100 text-green-700' : ct.status === 'case_closed' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'} variant="secondary">{t(ct.status as any)}</Badge>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right text-sm">
                                <span className="text-green-600 font-medium">{ct.paid_amount?.toLocaleString()}</span>
                                <span className="text-slate-400 mx-1">/</span>
                                <span className="font-medium">{ct.sale_price?.toLocaleString()} {t('kd')}</span>
                              </div>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </div>
                          </div>

                          {/* Expanded Installment Plan */}
                          {isExpanded && (
                            <div className="p-3 space-y-3">
                              {/* Contract Summary */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                <div className="bg-blue-50 rounded p-2">
                                  <p className="text-xs text-blue-600">{t('contractValue')}</p>
                                  <p className="font-semibold">{ct.sale_price?.toLocaleString()} {t('kd')}</p>
                                </div>
                                <div className="bg-green-50 rounded p-2">
                                  <p className="text-xs text-green-600">{t('paidAmount')}</p>
                                  <p className="font-semibold text-green-700">{ct.paid_amount?.toLocaleString()} {t('kd')}</p>
                                </div>
                                <div className="bg-red-50 rounded p-2">
                                  <p className="text-xs text-red-600">{t('remainingAmount')}</p>
                                  <p className="font-semibold text-red-700">{ct.remaining_amount?.toLocaleString()} {t('kd')}</p>
                                </div>
                                <div className="bg-slate-50 rounded p-2">
                                  <p className="text-xs text-slate-500">{t('paidInstallments')}</p>
                                  <p className="font-semibold">{paidCount} / {schedule.length}</p>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span>{t('paid')}: {paidCount}/{schedule.length}</span>
                                  <span>{Math.round(paidCount / Math.max(1, schedule.length) * 100)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${paidCount / Math.max(1, schedule.length) * 100}%` }} />
                                </div>
                              </div>

                              {/* Installment Table */}
                              {schedule.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b bg-slate-50">
                                        <th className="text-start py-2 px-2 font-medium text-slate-600">#</th>
                                        <th className="text-start py-2 px-2 font-medium text-slate-600">{t('dueDate')}</th>
                                        <th className="text-start py-2 px-2 font-medium text-slate-600">{t('amount')}</th>
                                        <th className="text-start py-2 px-2 font-medium text-slate-600">{t('status')}</th>
                                        <th className="text-start py-2 px-2 font-medium text-slate-600">{t('paymentDate')}</th>
                                        <th className="text-start py-2 px-2 font-medium text-slate-600">{t('runningBalance')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {schedule.map((inst: any, idx: number) => {
                                        const runningPaid = schedule.slice(0, idx + 1).filter((s: any) => s.status === 'paid').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
                                        const balance = (ct.sale_price || 0) - runningPaid;
                                        const isOverdue = inst.status !== 'paid' && isBefore(new Date(inst.due_date), today);
                                        return (
                                          <tr key={idx} className={`border-b border-slate-100 ${inst.status === 'paid' ? 'bg-green-50/50' : isOverdue ? 'bg-red-50/50' : ''}`}>
                                            <td className="py-1.5 px-2">{inst.month || idx + 1}</td>
                                            <td className="py-1.5 px-2">{inst.due_date}</td>
                                            <td className="py-1.5 px-2 font-medium">{inst.amount?.toLocaleString()} {t('kd')}</td>
                                            <td className="py-1.5 px-2">
                                              <Badge className={inst.status === 'paid' ? 'bg-green-100 text-green-700 text-[10px]' : isOverdue ? 'bg-red-100 text-red-700 text-[10px]' : 'bg-amber-100 text-amber-700 text-[10px]'} variant="secondary">
                                                {inst.status === 'paid' ? t('paid') : isOverdue ? t('overdue') : t('pending')}
                                              </Badge>
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-500">{inst.paid_date || '-'}</td>
                                            <td className="py-1.5 px-2 font-medium">{balance.toLocaleString()} {t('kd')}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400">{t('noData')}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">{t('totalDues')}: <span className="text-lg">{totalDues.toLocaleString()} {t('kd')}</span></p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('editCustomer') : t('addCustomer')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('customerName')} *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label>{t('civilId')} *</Label>
                <Input value={form.civil_id} onChange={e => setForm({ ...form, civil_id: e.target.value.replace(/\D/g, '').slice(0, 12) })} maxLength={12} />
                {errors.civil_id && <p className="text-red-500 text-xs mt-1">{errors.civil_id}</p>}
              </div>
              <div>
                <Label>{t('mobileNo')} *</Label>
                <Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 8) })} maxLength={8} />
                {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
              </div>
              <div>
                <Label>{t('passportNo')}</Label>
                <Input value={form.passport_no} onChange={e => setForm({ ...form, passport_no: e.target.value })} />
              </div>
              <div>
                <Label>{t('emailAddress')}</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label>{t('workPlace')}</Label>
                <Input value={form.work_place} onChange={e => setForm({ ...form, work_place: e.target.value })} placeholder={t('workPlace')} />
              </div>
              <div>
                <Label>{t('clientCheck')}</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.client_check} onChange={e => setForm({ ...form, client_check: e.target.value })}>
                  <option value="">{t('selectClientCheck')}</option>
                  {clientCheckOptions.map(opt => <option key={opt} value={opt}>{t(opt as any) || opt}</option>)}
                </select>
              </div>
            </div>
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">{t('address')} *</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>{t('areaName')} *</Label>
                  <Input value={form.area_name} onChange={e => setForm({ ...form, area_name: e.target.value })} />
                  {errors.area_name && <p className="text-red-500 text-xs mt-1">{errors.area_name}</p>}
                </div>
                <div><Label>{t('blockNo')}</Label><Input value={form.block_no} onChange={e => setForm({ ...form, block_no: e.target.value })} /></div>
                <div><Label>{t('streetNo')}</Label><Input value={form.street_no} onChange={e => setForm({ ...form, street_no: e.target.value })} /></div>
                <div><Label>{t('houseNo')}</Label><Input value={form.house_no} onChange={e => setForm({ ...form, house_no: e.target.value })} /></div>
              </div>
            </div>
            <div className="border-t pt-4">
              <FileAttachment bucket="customer-docs" folder={editing?.id || 'new'} files={form.attachments} onFilesChange={files => setForm({ ...form, attachments: files })} />
            </div>
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
