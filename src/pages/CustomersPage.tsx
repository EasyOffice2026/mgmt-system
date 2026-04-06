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
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';

interface Customer {
  id: string;
  customer_no: string;
  name: string;
  civil_id: string;
  mobile: string;
  passport_no: string;
  email: string;
  area_name: string;
  block_no: string;
  street_no: string;
  house_no: string;
  attachments: string[];
  created_at: string;
}

const emptyCustomer = {
  name: '', civil_id: '', mobile: '', passport_no: '', email: '',
  area_name: '', block_no: '', street_no: '', house_no: '', attachments: [] as string[],
};

export default function CustomersPage() {
  const { t } = useLang();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCustomers(); }, []);

  async function loadCustomers() {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!/^\d{12}$/.test(form.civil_id)) errs.civil_id = t('civilIdInvalid');
    if (!/^\d{8}$/.test(form.mobile)) errs.mobile = t('mobileInvalid');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('emailInvalid');
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
    setShowDialog(false);
    setForm(emptyCustomer);
    setEditing(null);
    loadCustomers();
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('deleteCustomerConfirm'))) return;
    await supabase.from('customers').delete().eq('id', id);
    loadCustomers();
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name, civil_id: c.civil_id, mobile: c.mobile, passport_no: c.passport_no,
      email: c.email, area_name: c.area_name, block_no: c.block_no,
      street_no: c.street_no, house_no: c.house_no, attachments: c.attachments || [],
    });
    setErrors({});
    setShowDialog(true);
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyCustomer);
    setErrors({});
    setShowDialog(true);
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.civil_id.includes(search) ||
    c.customer_no?.includes(search) ||
    c.mobile.includes(search)
  );

  const exportHeaders = [t('customerNo'), t('customerName'), t('civilId'), t('mobileNo'), t('passportNo'), t('emailAddress'), t('address')];
  const exportRows = filtered.map(c => [
    c.customer_no, c.name, c.civil_id, c.mobile, c.passport_no, c.email,
    [c.area_name, c.block_no, c.street_no, c.house_no].filter(Boolean).join(', '),
  ]);

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

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder={t('search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Users className="h-12 w-12 mx-auto mb-3" />
              <p className="text-lg font-medium">{t('noData')}</p>
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
                    <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-blue-600">{c.customer_no}</td>
                      <td className="py-3 px-4 font-medium">{c.name}</td>
                      <td className="py-3 px-4 font-mono text-xs">{c.civil_id}</td>
                      <td className="py-3 px-4">{c.mobile}</td>
                      <td className="py-3 px-4 text-slate-500">{c.email}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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
                <Label>{t('civilId')} * (12 {t('no')})</Label>
                <Input value={form.civil_id} onChange={e => setForm({ ...form, civil_id: e.target.value.replace(/\D/g, '').slice(0, 12) })} maxLength={12} />
                {errors.civil_id && <p className="text-red-500 text-xs mt-1">{errors.civil_id}</p>}
              </div>
              <div>
                <Label>{t('mobileNo')} * (8 {t('no')})</Label>
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
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">{t('address')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>{t('areaName')}</Label>
                  <Input value={form.area_name} onChange={e => setForm({ ...form, area_name: e.target.value })} />
                </div>
                <div>
                  <Label>{t('blockNo')}</Label>
                  <Input value={form.block_no} onChange={e => setForm({ ...form, block_no: e.target.value })} />
                </div>
                <div>
                  <Label>{t('streetNo')}</Label>
                  <Input value={form.street_no} onChange={e => setForm({ ...form, street_no: e.target.value })} />
                </div>
                <div>
                  <Label>{t('houseNo')}</Label>
                  <Input value={form.house_no} onChange={e => setForm({ ...form, house_no: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <FileAttachment
                bucket="customer-docs"
                folder={editing?.id || 'new'}
                files={form.attachments}
                onFilesChange={files => setForm({ ...form, attachments: files })}
              />
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
