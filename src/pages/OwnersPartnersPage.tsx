import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { DataExport } from '@/components/shared/DataExport';
import { Plus, Search, Pencil, Trash2, Landmark, Calendar, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface Partner {
  id: string; name: string; partner_no: string; mobile: string; email: string;
  civil_id: string; created_at: string;
}

interface Transaction {
  id: string; partner_id: string; partner_name: string; transaction_type: 'capital_in' | 'capital_out' | 'received_against_client';
  amount: number; description: string; reference_no: string; transaction_date: string;
  client_name: string; contract_no: string; created_at: string;
}

const defaultPartnerForm = { name: '', mobile: '', email: '', civil_id: '' };
const defaultTxForm = {
  partner_id: '', transaction_type: 'capital_in' as 'capital_in' | 'capital_out' | 'received_against_client',
  amount: 0, description: '', reference_no: '', transaction_date: '',
  client_name: '', contract_no: '',
};

export default function OwnersPartnersPage() {
  const { t } = useLang();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [showTxDialog, setShowTxDialog] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [partnerForm, setPartnerForm] = useState(defaultPartnerForm);
  const [txForm, setTxForm] = useState(defaultTxForm);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [fromDate, toDate]);

  async function loadData() {
    setLoading(true);
    let txQuery = supabase.from('partner_transactions').select('*').order('transaction_date', { ascending: false });
    if (fromDate) txQuery = txQuery.gte('transaction_date', fromDate);
    if (toDate) txQuery = txQuery.lte('transaction_date', toDate);
    const [partnerRes, txRes] = await Promise.all([
      supabase.from('partners').select('*').order('name'),
      txQuery,
    ]);
    setPartners(partnerRes.data || []);
    setTransactions(txRes.data || []);
    setLoading(false);
  }

  async function handleSavePartner() {
    if (!partnerForm.name.trim()) return;
    if (editingPartner) {
      await supabase.from('partners').update(partnerForm).eq('id', editingPartner.id);
    } else {
      await supabase.from('partners').insert(partnerForm);
    }
    setShowPartnerDialog(false); setPartnerForm(defaultPartnerForm); setEditingPartner(null); loadData();
  }

  async function handleSaveTx() {
    if (!txForm.partner_id || txForm.amount <= 0) return;
    const partner = partners.find(p => p.id === txForm.partner_id);
    const data = { ...txForm, partner_name: partner?.name || '' };
    if (editingTx) {
      await supabase.from('partner_transactions').update(data).eq('id', editingTx.id);
    } else {
      await supabase.from('partner_transactions').insert(data);
    }
    setShowTxDialog(false); setTxForm(defaultTxForm); setEditingTx(null); loadData();
  }

  async function handleDeletePartner(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('partners').delete().eq('id', id);
    loadData();
  }

  async function handleDeleteTx(id: string) {
    if (!window.confirm('Are you sure?')) return;
    await supabase.from('partner_transactions').delete().eq('id', id);
    loadData();
  }

  function openEditPartner(p: Partner) {
    setEditingPartner(p);
    setPartnerForm({ name: p.name, mobile: p.mobile || '', email: p.email || '', civil_id: p.civil_id || '' });
    setShowPartnerDialog(true);
  }

  function openEditTx(tx: Transaction) {
    setEditingTx(tx);
    setTxForm({
      partner_id: tx.partner_id, transaction_type: tx.transaction_type,
      amount: tx.amount, description: tx.description || '', reference_no: tx.reference_no || '',
      transaction_date: tx.transaction_date || '', client_name: tx.client_name || '', contract_no: tx.contract_no || '',
    });
    setShowTxDialog(true);
  }

  // Calculate partner summaries
  function getPartnerSummary(partnerId: string) {
    const partnerTxs = transactions.filter(tx => tx.partner_id === partnerId);
    const capitalIn = partnerTxs.filter(tx => tx.transaction_type === 'capital_in').reduce((s, tx) => s + (tx.amount || 0), 0);
    const capitalOut = partnerTxs.filter(tx => tx.transaction_type === 'capital_out').reduce((s, tx) => s + (tx.amount || 0), 0);
    const receivedAgainst = partnerTxs.filter(tx => tx.transaction_type === 'received_against_client').reduce((s, tx) => s + (tx.amount || 0), 0);
    return { capitalIn, capitalOut, receivedAgainst, net: capitalIn - capitalOut - receivedAgainst };
  }

  const filteredPartners = partners.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.partner_no?.includes(search) ||
    p.civil_id?.includes(search)
  );

  const totalCapitalIn = transactions.filter(tx => tx.transaction_type === 'capital_in').reduce((s, tx) => s + (tx.amount || 0), 0);
  const totalCapitalOut = transactions.filter(tx => tx.transaction_type === 'capital_out').reduce((s, tx) => s + (tx.amount || 0), 0);
  const totalReceivedAgainst = transactions.filter(tx => tx.transaction_type === 'received_against_client').reduce((s, tx) => s + (tx.amount || 0), 0);

  const filteredTxs = selectedPartner
    ? transactions.filter(tx => tx.partner_id === selectedPartner)
    : transactions;

  const exportHeaders = [t('partnerName'), t('transactionType'), t('amount'), t('clientName'), t('contractNo'), t('referenceNo'), t('date')];
  const exportRows = filteredTxs.map(tx => [tx.partner_name, tx.transaction_type, tx.amount, tx.client_name, tx.contract_no, tx.reference_no, tx.transaction_date]);

  const txTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      capital_in: 'bg-green-100 text-green-700',
      capital_out: 'bg-red-100 text-red-700',
      received_against_client: 'bg-blue-100 text-blue-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('ownersPartners')}</h1>
          <p className="text-slate-500 text-sm">{t('capitalTracking')}</p>
        </div>
        <div className="flex items-center gap-3">
          <DataExport title={t('ownersPartners')} headers={exportHeaders} rows={exportRows} filename="partners" />
          <Button onClick={() => { setEditingPartner(null); setPartnerForm(defaultPartnerForm); setShowPartnerDialog(true); }} variant="outline">
            <Plus className="h-4 w-4 me-1" /> {t('addPartner')}
          </Button>
          <Button onClick={() => { setEditingTx(null); setTxForm(defaultTxForm); setShowTxDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="h-4 w-4 me-1" /> {t('addTransaction')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('totalCapitalIn')}</p>
              <p className="text-lg font-bold text-green-600">{totalCapitalIn.toLocaleString()} {t('kd')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('totalCapitalOut')}</p>
              <p className="text-lg font-bold text-red-600">{totalCapitalOut.toLocaleString()} {t('kd')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('receivedAgainstClients')}</p>
              <p className="text-lg font-bold text-blue-600">{totalReceivedAgainst.toLocaleString()} {t('kd')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('netCapital')}</p>
              <p className="text-lg font-bold text-amber-600">{(totalCapitalIn - totalCapitalOut - totalReceivedAgainst).toLocaleString()} {t('kd')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Date Range */}
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

      {/* Partners Summary Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : filteredPartners.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Landmark className="h-12 w-12 mx-auto mb-3" /><p className="text-lg font-medium">{t('noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('partnerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('mobileNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('capitalPaid')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('capitalWithdrawn')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('receivedAgainstClients')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('netCapital')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.map(p => {
                    const summary = getPartnerSummary(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-100 hover:bg-blue-50/50 transition-colors cursor-pointer ${selectedPartner === p.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedPartner(selectedPartner === p.id ? null : p.id)}
                      >
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4">{p.mobile}</td>
                        <td className="py-3 px-4 text-green-600 font-medium">{summary.capitalIn.toLocaleString()} {t('kd')}</td>
                        <td className="py-3 px-4 text-red-600 font-medium">{summary.capitalOut.toLocaleString()} {t('kd')}</td>
                        <td className="py-3 px-4 text-blue-600 font-medium">{summary.receivedAgainst.toLocaleString()} {t('kd')}</td>
                        <td className="py-3 px-4 font-bold">{summary.net.toLocaleString()} {t('kd')}</td>
                        <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditPartner(p)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeletePartner(p.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                          </div>
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

      {/* Transactions Table */}
      {filteredTxs.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold">{t('transactions')} {selectedPartner ? `- ${partners.find(p => p.id === selectedPartner)?.name}` : ''}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('date')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('partnerName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('transactionType')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('amount')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('clientName')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('contractNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('referenceNo')}</th>
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTxs.map(tx => (
                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4">{tx.transaction_date}</td>
                      <td className="py-3 px-4 font-medium">{tx.partner_name}</td>
                      <td className="py-3 px-4">
                        <Badge className={txTypeColor(tx.transaction_type)} variant="secondary">
                          {t(tx.transaction_type as any)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-medium">{tx.amount?.toLocaleString()} {t('kd')}</td>
                      <td className="py-3 px-4">{tx.client_name || '-'}</td>
                      <td className="py-3 px-4 text-blue-600">{tx.contract_no || '-'}</td>
                      <td className="py-3 px-4 text-slate-500">{tx.reference_no || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditTx(tx)}><Pencil className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTx(tx.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Partner Dialog */}
      <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPartner ? t('editPartner') : t('addPartner')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('partnerName')} *</Label>
              <Input value={partnerForm.name} onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })} />
            </div>
            <div>
              <Label>{t('mobileNo')}</Label>
              <Input value={partnerForm.mobile} onChange={e => setPartnerForm({ ...partnerForm, mobile: e.target.value })} />
            </div>
            <div>
              <Label>{t('emailAddress')}</Label>
              <Input type="email" value={partnerForm.email} onChange={e => setPartnerForm({ ...partnerForm, email: e.target.value })} />
            </div>
            <div>
              <Label>{t('civilId')}</Label>
              <Input value={partnerForm.civil_id} onChange={e => setPartnerForm({ ...partnerForm, civil_id: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPartnerDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleSavePartner} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Transaction Dialog */}
      <Dialog open={showTxDialog} onOpenChange={setShowTxDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTx ? t('editTransaction') : t('addTransaction')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('partnerName')} *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={txForm.partner_id} onChange={e => setTxForm({ ...txForm, partner_id: e.target.value })}>
                  <option value="">{t('selectPartner')}</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t('transactionType')} *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={txForm.transaction_type} onChange={e => setTxForm({ ...txForm, transaction_type: e.target.value as any })}>
                  <option value="capital_in">{t('capital_in')}</option>
                  <option value="capital_out">{t('capital_out')}</option>
                  <option value="received_against_client">{t('received_against_client')}</option>
                </select>
              </div>
              <div>
                <Label>{t('amount')} *</Label>
                <Input type="number" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t('date')}</Label>
                <Input type="date" value={txForm.transaction_date} onChange={e => setTxForm({ ...txForm, transaction_date: e.target.value })} />
              </div>
              {txForm.transaction_type === 'received_against_client' && (
                <>
                  <div>
                    <Label>{t('clientName')}</Label>
                    <Input value={txForm.client_name} onChange={e => setTxForm({ ...txForm, client_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t('contractNo')}</Label>
                    <Input value={txForm.contract_no} onChange={e => setTxForm({ ...txForm, contract_no: e.target.value })} />
                  </div>
                </>
              )}
              <div>
                <Label>{t('referenceNo')}</Label>
                <Input value={txForm.reference_no} onChange={e => setTxForm({ ...txForm, reference_no: e.target.value })} />
              </div>
              <div>
                <Label>{t('description')}</Label>
                <Input value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowTxDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleSaveTx} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
