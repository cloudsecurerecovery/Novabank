import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { useAuthStore } from './store/authStore';
import { storageService } from './services/storageService';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PortalCode from './pages/PortalCode';
import Dashboard from './pages/Dashboard';
import Transfer from './pages/Transfer';
import Profile from './pages/Profile';
import Cards from './pages/Cards';
import Deposit from './pages/Deposit';
import Notifications from './pages/Notifications';
import SupportChat from './pages/SupportChat';
import Transactions from './pages/Transactions';
import Loans from './pages/Loans';
import Savings from './pages/Savings';
import BillPay from './pages/BillPay';
import Investments from './pages/Investments';
import Referrals from './pages/Referrals';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminSupport from './pages/admin/AdminSupport';
import AdminSettings from './pages/admin/AdminSettings';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminLoans from './pages/admin/AdminLoans';
import AdminSavings from './pages/admin/AdminSavings';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminLogin from './pages/admin/AdminLogin';
import NotFound from './pages/NotFound';
import Layout from './components/Layout';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';

export default function App() {
  const { login, logout, user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Global Notification Listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        toast.success(payload.new.message, {
          duration: 5000,
          position: 'top-right',
          icon: '🔔'
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_notes',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        toast(payload.new.message, {
          duration: 6000,
          position: 'top-right',
          icon: '💬'
        });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const fetchProfile = async (userId: string, email: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (data) {
        let signedAvatarUrl = '';
        if (data.avatar_url) {
          try {
            signedAvatarUrl = await storageService.getSignedUrl(data.avatar_url);
          } catch (e) {
            console.warn('Failed to get signed avatar URL', e);
          }
        }
        
        login({
          id: data.id,
          full_name: data.full_name || email.split('@')[0],
          email: email,
          is_admin: data.is_admin || email === 'ositalan5@gmail.com',
          role: data.role || (email === 'ositalan5@gmail.com' ? 'admin' : 'user'),
          avatar_url: signedAvatarUrl,
          phone: data.phone,
          balance: data.balance || 0,
          savings_balance: data.savings_balance || 0,
          loan_balance: data.loan_balance || 0,
          investment_balance: data.investment_balance || 0,
        });
      } else {
        login({
          id: userId,
          full_name: email.split('@')[0],
          email: email,
          is_admin: email === 'ositalan5@gmail.com',
          role: email === 'ositalan5@gmail.com' ? 'admin' : 'user',
        });
      }
    };

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || '');
      } else {
        logout();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || '');
      } else {
        logout();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [login, logout]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#007856] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Initializing NovaBank...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/portal-code" element={<PortalCode />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {/* User Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transfer" element={<Transfer />} />
            <Route path="/deposit" element={<Deposit />} />
            <Route path="/wire-transfer" element={<Transfer />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/bill-pay" element={<BillPay />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/support" element={<SupportChat />} />

            {/* Admin Routes */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/audit" element={<AdminAuditLogs />} />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/loans" element={<AdminLoans />} />
              <Route path="/admin/savings" element={<AdminSavings />} />
              <Route path="/admin/transactions" element={<AdminTransactions />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

