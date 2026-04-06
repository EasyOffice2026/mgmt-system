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
import { Plus, Search, Pencil, Trash2, Scale } from 'lucide-react';

interface LegalCase {
  id: string;
  legal_case_no: string;
  customer_id: string;
  customer_name: string;
  contract_id: string;
  contract_no: string;
  case_no: string;
  purchase_price: number;
  original_amount: number;
  remaining_from_customer: number;
  case_amount: number;
  rcvd_from_customer: number;
  rcvd_from_court: number;
  excess_amount: number;
  attachments: string[];
  created_at: string;
}

interface Contract {
  id: string;
  contract_no: string;
  customer_id: string;
  customer_name: string;
  sale_price: number;
  remaining_amount: number;
  purchase_price: number;
  status: string;
}

const defaultForm = {
  customer_id: '', contract_id: '', case_no: '', purchase_price: 0,
  original_amount: 0, remaining_from_customer: 0, case_amount: 0,
  rcvd_from_customer: 0, rcvd_from_court: 0, attachments: [] as string[],
};

export default function LegalCasesPage() {
  const { t } = useLang();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<LegalCase | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [casesRes, contractsRes] = await Promise.all([
      supabase.from('legal_cases').select('*').order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('status', 'legal_case'),
    ]);
    setCases(casesRes.data || []);
    setContracts(contractsRes.data || []);
    setLoading(false);
  }

  function calculateExcess() {
    const excess = (form.rcvd_from_court + form.rcvd_from_customer) - form.remaining_from_customer;
    return Math.max(0, excess);
  }

  async function handleSave() {
    const contract = contracts.find(c => c.id === form.contract_id);
    const data = {
      customer_id: form.customer_id || contract?.customer_id || '',
      customer_name: contract?.customer_name || '',
      contract_id: form.contract_id,
      contract_no: contract?.contract_no || '',
      case_no: form.case_no,
      purchase_price: form.purchase_price || contract?.purchase_price || 0,
      original_amount: form.original_amount || contract?.sale_price || 0,
      remaining_from_customer: form.remaining_from_customer || contract?.remaining_amount || 0,
      case_amount: form.case_amount,
      rcvd_from_customer: form.rcvd_from_customer,
      rcvd_from_court: form.rcvd_from_court,
      excess_amount: calculateExcess(),
      attachments: form.attachments,
    };

    if (editing) {
      await supabase.from('legal_cases').update(data).eq('id', editing.id);
    } else {
      await supabase.from('legal_cases').insert(data);
    }
    setShowDialog(false);
    setForm(defaultForm);
    setEditing(null);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('legal_cases').delete().eq('id', id);
    loadData();
  }

  function openEdit(c: LegalCase) {
    setEditing(c);
    setForm({
      customer_id: c.customer_id, contract_id: c.contract_id, case_no: c.case_no,
      purchase_price: c.purchase_price, original_amount: c.original_amount,
      remaining_from_customer: c.remaining_from_customer, case_amount: c.case_amount,
      rcvd_from_customer: c.rcvd_from_customer, rcvd_from_court: c.rcvd_from_court,
      attachments: c.attachments || [],
    });
    setShowDialog(true);
  }

  const filtered = cases.filter(c =>
    c.legal_case_no?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.case_no?.toLowerCase().includes(search.toLowerCase())
  );

  const exportHeaders = [t('legalCaseNo'), t('customerName'), t('contractNo'), t('caseNo'), t('originalAmount'), t('remainingFromCustomer'), t('caseAmount'), t('rcvdFromCustomer'), t('rcvdFromCourt'), t('excessAmount')];
  const exportRows = filtered.map(c => [c.legal_case_no, c.customer_name, c.contract_no, c.case_no, c.original_amount, c.remaining_from_customer, c.case_amount, c.rcvd_from_customer, c.rcvd_from_court, c.excess_amount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('legalCases')}</h1>
          <p className="text-slate-500 text-sm">{filtered.length} cases</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('legalCases')} headers={exportHeaders} rows={exportRows} filename="legal-cases" />
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addLegalCase')}
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Scale className="h-12 w-12 mx-auto mb-3" />
              <p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('legalCaseNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('customerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('contractNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('caseNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('originalAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('remainingFromCustomer')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('rcvdFromCourt')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('excessAmount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-blue-600">{c.legal_case_no}</td>
                      <td className="py-3 px-4">{c.customer_name}</td>
                      <td className="py-3 px-4">{c.contract_no}</td>
                      <td className="py-3 px-4">{c.case_no}</td>
                      <td className="py-3 px-4">{c.original_amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-red-600">{c.remaining_from_customer?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 text-green-600">{c.rcvd_from_court?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4 font-medium">{c.excess_amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
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
                  setForm({
                    ...form, contract_id: e.target.value, customer_id: contract?.customer_id || '',
                    purchase_price: contract?.purchase_price || 0, original_amount: contract?.sale_price || 0,
                    remaining_from_customer: contract?.remaining_amount || 0,
                  });
                }}>
                  <option value="">Select Contract</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_no} - {c.customer_name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('caseNo')} *</Label>
                <Input value={form.case_no} onChange={e => setForm({ ...form, case_no: e.target.value })} />
              </div>
              <div>
                <Label>{t('purchasePrice')}</Label>
                <Input type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('originalAmount')}</Label>
                <Input type="number" value={form.original_amount} onChange={e => setForm({ ...form, original_amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('remainingFromCustomer')}</Label>
                <Input type="number" value={form.remaining_from_customer} onChange={e => setForm({ ...form, remaining_from_customer: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('caseAmount')}</Label>
                <Input type="number" value={form.case_amount} onChange={e => setForm({ ...form, case_amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('rcvdFromCustomer')}</Label>
                <Input type="number" value={form.rcvd_from_customer} onChange={e => setForm({ ...form, rcvd_from_customer: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('rcvdFromCourt')}</Label>
                <Input type="number" value={form.rcvd_from_court} onChange={e => setForm({ ...form, rcvd_from_court: Number(e.target.value) })} />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-1">{t('excessAmount')}</h4>
              <p className="text-2xl font-bold text-blue-700">{calculateExcess().toLocaleString()} {t('kd')}</p>
              <p className="text-xs text-blue-600 mt-1">({t('rcvdFromCourt')} + {t('rcvdFromCustomer')}) - {t('remainingFromCustomer')}</p>
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
