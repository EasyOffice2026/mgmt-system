// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LangProvider } from './contexts/LangContext';
import Layout from './components/layout/Layout';
import LoginPage from './components/auth/LoginPage';

// Pages
import Dashboard from './components/modules/Dashboard';
import Customers from './components/modules/customers/Customers';
import Sales from './components/modules/sales/Sales';
import Purchase from './components/modules/purchase/Purchase';
import Inventory from './components/modules/inventory/Inventory';
import LegalCases from './components/modules/legal/LegalCases';
import Expenses from './components/modules/expenses/Expenses';
import Receipts from './components/modules/receipts/Receipts';
import Accounting from './components/modules/accounting/Accounting';
import Employees from './components/modules/hrd/Employees';
import Attendance from './components/modules/hrd/Attendance';
import Payroll from './components/modules/hrd/Payroll';
import Leaves from './components/modules/hrd/Leaves';
import Users from './components/modules/users/Users';
import Settings from './components/modules/Settings';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:'16px', color:'#5a6a7e' }}>
      Loading...
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="sales" element={<Sales />} />
        <Route path="purchase" element={<Purchase />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="legal" element={<LegalCases />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="receipts" element={<Receipts />} />
        <Route path="accounting" element={<Accounting />} />
        <Route path="hrd" element={<Employees />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LangProvider>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </LangProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
