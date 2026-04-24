import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/contexts/LangContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Pencil, Key, UserCheck, UserX, Settings, Trash2, CreditCard, Tag } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  full_name_ar: string;
  role: string;
  is_active: boolean;
  created_at: string;
  email?: string;
}

const defaultForm = {
  email: '', password: '', full_name: '', full_name_ar: '', role: 'staff',
};

const defaultCategories = ['Mobile', 'Car', 'Furniture', 'Electronics', 'Jewelry', 'Other'];
const defaultPaymentModes = ['cash', 'bank_transfer', 'link', 'wamd'];

export default function UsersPage() {
  const { t } = useLang();
  const { isOwner, user: currentUser, changePassword } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(true);

  // Payment Mode & Category management
  const [paymentModes, setPaymentModes] = useState<string[]>(defaultPaymentModes);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [newPaymentMode, setNewPaymentMode] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'paymentModes' | 'categories'>('users');

  useEffect(() => { loadUsers(); loadPaymentModes(); loadCategories(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: true });
    setUsers(data || []);
    setLoading(false);
  }

  async function loadPaymentModes() {
    const { data } = await supabase.from('payment_modes').select('name').order('name');
    if (data && data.length > 0) {
      const merged = [...new Set([...defaultPaymentModes, ...data.map((d: any) => d.name)])];
      setPaymentModes(merged);
    }
  }

  async function loadCategories() {
    const { data } = await supabase.from('purchases').select('category');
    const cats = new Set(defaultCategories);
    (data || []).forEach((p: any) => { if (p.category) cats.add(p.category); });
    setCategories([...cats]);
  }

  async function addPaymentMode() {
    const modeName = newPaymentMode.trim().toLowerCase().replace(/\s+/g, '_');
    if (!modeName) return;
    if (paymentModes.includes(modeName)) { alert('Payment mode already exists!'); return; }
    await supabase.from('payment_modes').upsert({ name: modeName }, { onConflict: 'name' });
    setNewPaymentMode('');
    await loadPaymentModes();
  }

  async function deletePaymentMode(mode: string) {
    if (defaultPaymentModes.includes(mode)) { alert('Cannot delete default payment mode'); return; }
    if (!window.confirm(`Delete payment mode "${mode}"?`)) return;
    await supabase.from('payment_modes').delete().eq('name', mode);
    await loadPaymentModes();
  }

  function addCategory() {
    const catName = newCategory.trim();
    if (!catName) return;
    if (categories.includes(catName)) { alert('Category already exists!'); return; }
    setCategories([...categories, catName]);
    setNewCategory('');
  }

  function removeCategory(cat: string) {
    if (defaultCategories.includes(cat)) { alert('Cannot delete default category'); return; }
    if (!window.confirm(`Delete category "${cat}"?`)) return;
    setCategories(categories.filter(c => c !== cat));
  }

  async function handleSave() {
    if (editing) {
      await supabase.from('user_profiles').update({
        full_name: form.full_name,
        full_name_ar: form.full_name_ar,
        role: form.role,
      }).eq('id', editing.id);
    } else {
      // Create new user via Supabase Auth
      const { data: authData, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (error) { alert(error.message); return; }
      if (authData.user) {
        await supabase.from('user_profiles').insert({
          id: authData.user.id,
          full_name: form.full_name,
          full_name_ar: form.full_name_ar,
          role: form.role,
          is_active: true,
        });
      }
    }
    setShowDialog(false);
    setForm(defaultForm);
    setEditing(null);
    loadUsers();
  }

  async function handleChangePassword() {
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('passwordMismatch'));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    try {
      await changePassword(passwordForm.newPassword);
      setShowPasswordDialog(false);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      alert(t('passwordChanged'));
    } catch (err) {
      setPasswordError(String(err));
    }
  }

  async function toggleActive(user: UserProfile) {
    await supabase.from('user_profiles').update({ is_active: !user.is_active }).eq('id', user.id);
    loadUsers();
  }

  function openEdit(u: UserProfile) {
    setEditing(u);
    setForm({
      email: '', password: '',
      full_name: u.full_name, full_name_ar: u.full_name_ar, role: u.role,
    });
    setShowDialog(true);
  }

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name_ar?.includes(search) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-700',
      admin: 'bg-blue-100 text-blue-700',
      staff: 'bg-slate-100 text-slate-700',
    };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('users')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
            <Key className="h-4 w-4 me-1" /> {t('changePassword')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('users')}>
          <Settings className="h-4 w-4 inline me-1" /> {t('users')}
        </button>
        <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'paymentModes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('paymentModes')}>
          <CreditCard className="h-4 w-4 inline me-1" /> {t('paymentModes')}
        </button>
        <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'categories' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab('categories')}>
          <Tag className="h-4 w-4 inline me-1" /> {t('categories')}
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-md flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
            </div>
            {isOwner && (
              <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className="h-4 w-4 me-1" /> {t('addUser')}
              </Button>
            )}
          </div>
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              {loading ? (
                <div className="py-20 text-center text-slate-400">{t('loading')}</div>
              ) : filtered.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <Settings className="h-12 w-12 mx-auto mb-3" />
                  <p className="text-lg font-medium">{t('noData')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('fullName')}</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('fullNameAr')}</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('role')}</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('status')}</th>
                        <th className="text-start py-3 px-4 font-medium text-slate-600">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(u => (
                        <tr key={u.id} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                          <td className="py-3 px-4 font-medium">{u.full_name}</td>
                          <td className="py-3 px-4">{u.full_name_ar}</td>
                          <td className="py-3 px-4">
                            <Badge className={roleColor(u.role)} variant="secondary">{t(u.role as keyof typeof t)}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} variant="secondary">
                              {u.is_active ? t('active') : t('inactive')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {isOwner && u.id !== currentUser?.id && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                                  <Pencil className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                                  {u.is_active ? <UserX className="h-4 w-4 text-red-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Payment Modes Tab */}
      {activeTab === 'paymentModes' && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-medium text-lg">{t('managePaymentModes')}</h3>
            <p className="text-sm text-slate-500">Add or remove payment modes used across contracts, purchases, and receipts. No duplicates allowed.</p>
            <div className="flex gap-2">
              <Input placeholder={t('addPaymentMode')} value={newPaymentMode} onChange={e => setNewPaymentMode(e.target.value)} className="max-w-xs"
                onKeyDown={e => { if (e.key === 'Enter') addPaymentMode(); }} />
              <Button onClick={addPaymentMode} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className="h-4 w-4 me-1" /> {t('add')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {paymentModes.map(mode => (
                <div key={mode} className="flex items-center gap-1 bg-slate-100 rounded-lg px-3 py-2 text-sm">
                  <CreditCard className="h-3 w-3 text-slate-500" />
                  <span>{t(mode as any) || mode}</span>
                  {!defaultPaymentModes.includes(mode) && (
                    <button onClick={() => deletePaymentMode(mode)} className="ms-1 text-red-400 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-medium text-lg">{t('manageCategories')}</h3>
            <p className="text-sm text-slate-500">Add or remove product categories used in purchases and contracts. No duplicates allowed.</p>
            <div className="flex gap-2">
              <Input placeholder={t('addCategory')} value={newCategory} onChange={e => setNewCategory(e.target.value)} className="max-w-xs"
                onKeyDown={e => { if (e.key === 'Enter') addCategory(); }} />
              <Button onClick={addCategory} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className="h-4 w-4 me-1" /> {t('add')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <div key={cat} className="flex items-center gap-1 bg-slate-100 rounded-lg px-3 py-2 text-sm">
                  <Tag className="h-3 w-3 text-slate-500" />
                  <span>{cat}</span>
                  {!defaultCategories.includes(cat) && (
                    <button onClick={() => removeCategory(cat)} className="ms-1 text-red-400 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit User Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('editUser') : t('addUser')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <>
                <div>
                  <Label>{t('email')} *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label>{t('password')} *</Label>
                  <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
              </>
            )}
            <div>
              <Label>{t('fullName')} *</Label>
              <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>{t('fullNameAr')}</Label>
              <Input value={form.full_name_ar} onChange={e => setForm({ ...form, full_name_ar: e.target.value })} dir="rtl" />
            </div>
            <div>
              <Label>{t('role')}</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="staff">{t('staff')}</option>
                <option value="admin">{t('admin')}</option>
                <option value="owner">{t('owner')}</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleSave} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changePassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {passwordError && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-200">{passwordError}</div>
            )}
            <div>
              <Label>{t('newPassword')}</Label>
              <Input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
            </div>
            <div>
              <Label>{t('confirmPassword')}</Label>
              <Input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>{t('cancel')}</Button>
              <Button onClick={handleChangePassword} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
