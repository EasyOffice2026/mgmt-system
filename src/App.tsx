import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LangProvider } from '@/contexts/LangContext';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import CustomersPage from '@/pages/CustomersPage';
import SalesPage from '@/pages/SalesPage';
import PurchasePage from '@/pages/PurchasePage';
import InventoryPage from '@/pages/InventoryPage';
import LegalCasesPage from '@/pages/LegalCasesPage';
import ExpensesPage from '@/pages/ExpensesPage';
import ReceiptsPage from '@/pages/ReceiptsPage';
import AccountingPage from '@/pages/AccountingPage';
import UsersPage from '@/pages/UsersPage';
import ContractLookupPage from '@/pages/ContractLookupPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 animate-pulse">
            AB
          </div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function RoleRoute({ module, children }: { module: string; children: React.ReactNode }) {
  const { hasAccess, loading } = useAuth();
  if (loading) return null;
  return hasAccess(module) ? <>{children}</> : <Navigate to="/" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="customers" element={<RoleRoute module="customers"><CustomersPage /></RoleRoute>} />
              <Route path="sales" element={<RoleRoute module="sales"><SalesPage /></RoleRoute>} />
              <Route path="purchase" element={<RoleRoute module="purchase"><PurchasePage /></RoleRoute>} />
              <Route path="inventory" element={<RoleRoute module="inventory"><InventoryPage /></RoleRoute>} />
              <Route path="legal-cases" element={<RoleRoute module="legalCases"><LegalCasesPage /></RoleRoute>} />
              <Route path="expenses" element={<RoleRoute module="expenses"><ExpensesPage /></RoleRoute>} />
              <Route path="receipts" element={<RoleRoute module="receipts"><ReceiptsPage /></RoleRoute>} />
              <Route path="contract-lookup" element={<RoleRoute module="contractLookup"><ContractLookupPage /></RoleRoute>} />
              <Route path="accounting" element={<RoleRoute module="accounting"><AccountingPage /></RoleRoute>} />
              <Route path="users" element={<RoleRoute module="users"><UsersPage /></RoleRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
