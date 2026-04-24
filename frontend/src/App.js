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
import Guests from './components/modules/customers/Customers';
import Orders from './components/modules/sales/Sales';
import Menu from './components/modules/purchase/Purchase';
import Inventory from './components/modules/inventory/Inventory';
import Tables from './components/modules/legal/LegalCases';
import Reservations from './components/modules/expenses/Expenses';
import Kitchen from './components/modules/receipts/Receipts';
import Reports from './components/modules/accounting/Accounting';
import Staff from './components/modules/hrd/Employees';
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
        <Route path="guests" element={<Guests />} />
        <Route path="orders" element={<Orders />} />
        <Route path="menu" element={<Menu />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="tables" element={<Tables />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="kitchen" element={<Kitchen />} />
        <Route path="staff" element={<Staff />} />
        <Route path="reports" element={<Reports />} />
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
