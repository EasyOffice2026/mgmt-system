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
import RevenueRecognitionPage from '@/pages/RevenueRecognitionPage';
import UsersPage from '@/pages/UsersPage';
import ContractLookupPage from '@/pages/ContractLookupPage';
import OwnersPartnersPage from '@/pages/OwnersPartnersPage';

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
              <Route path="customers" element={<CustomersPage />} />
              <Route path="sales" element={<SalesPage />} />
              <Route path="purchase" element={<PurchasePage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="legal-cases" element={<LegalCasesPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="receipts" element={<ReceiptsPage />} />
              <Route path="contract-lookup" element={<ContractLookupPage />} />
              <Route path="revenue-recognition" element={<RevenueRecognitionPage />} />
              <Route path="accounting" element={<AccountingPage />} />
              <Route path="owners-partners" element={<OwnersPartnersPage />} />
              <Route path="users" element={<UsersPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
