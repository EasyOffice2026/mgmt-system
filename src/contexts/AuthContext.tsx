import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  full_name: string;
  full_name_ar: string;
  role: 'owner' | 'admin' | 'salesman' | 'accountant' | 'staff';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  isOwner: boolean;
  isAdmin: boolean;
  isSalesman: boolean;
  isAccountant: boolean;
  hasAccess: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function changePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  const isOwner = profile?.role === 'owner';
  const isAdmin = profile?.role === 'owner' || profile?.role === 'admin';
  const isSalesman = profile?.role === 'salesman';
  const isAccountant = profile?.role === 'accountant';

  const ROLE_ACCESS: Record<string, string[]> = {
    owner: ['dashboard', 'contractLookup', 'customers', 'sales', 'purchase', 'inventory', 'legalCases', 'expenses', 'receipts', 'accounting', 'users'],
    admin: ['dashboard', 'contractLookup', 'customers', 'sales', 'purchase', 'inventory', 'legalCases', 'expenses', 'receipts', 'accounting'],
    salesman: ['dashboard', 'contractLookup', 'customers', 'sales', 'receipts'],
    accountant: ['dashboard', 'contractLookup', 'expenses', 'receipts', 'accounting'],
    staff: ['dashboard', 'contractLookup'],
  };

  function hasAccess(module: string): boolean {
    const role = profile?.role || 'staff';
    return ROLE_ACCESS[role]?.includes(module) ?? false;
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, changePassword, isOwner, isAdmin, isSalesman, isAccountant, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
