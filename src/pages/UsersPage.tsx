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
import { Plus, Search, Pencil, Key, UserCheck, UserX, Settings } from 'lucide-react';

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

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: true });
    setUsers(data || []);
    setLoading(false);
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
          <p className="text-slate-500 text-sm">{filtered.length} users</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
            <Key className="h-4 w-4 me-1" /> {t('changePassword')}
          </Button>
          {isOwner && (
            <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowDialog(true); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              <Plus className="h-4 w-4 me-1" /> {t('addUser')}
            </Button>
          )}
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
