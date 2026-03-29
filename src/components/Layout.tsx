import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Building2, LogOut, LayoutDashboard, UserCircle, MessageSquare, DollarSign, Clock, Menu, X, ArrowDownLeft, Globe, Bell, CreditCard, Shield, Users, History, Settings, PiggyBank, Banknote, Receipt, LineChart, Gift, Loader2, ShieldAlert, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AvatarImage } from './AvatarImage';
import { motion, AnimatePresence } from 'framer-motion';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchCount = async () => {
      // 1. Count unread admin notes
      const { count: adminNotesCount, error: adminError } = await supabase
        .from('admin_notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      // 2. Count unread system notifications
      const { count: systemNotificationsCount, error: systemError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      
      if (!adminError && !systemError) {
        setNotificationCount((adminNotesCount || 0) + (systemNotificationsCount || 0));
      }
    };

    fetchCount();

    // Subscribe to both tables
    const adminNotesSub = supabase
      .channel('public:admin_notes_count')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'admin_notes',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchCount();
      })
      .subscribe();

    const systemNotificationsSub = supabase
      .channel('public:notifications_count')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchCount();
      })
      .subscribe();

    return () => {
      adminNotesSub.unsubscribe();
      systemNotificationsSub.unsubscribe();
    };
  }, [user]);

  const handleLogout = async () => {
    if (user) {
      const { auditService } = await import('../services/auditService');
      await auditService.log(user.id, 'logout', {
        timestamp: new Date().toISOString()
      });
    }
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Cards', path: '/cards', icon: CreditCard },
    { name: 'Savings', path: '/savings', icon: PiggyBank },
    { name: 'Loans', path: '/loans', icon: Banknote },
    { name: 'Investments', path: '/investments', icon: LineChart },
    { name: 'Transactions', path: '/transactions', icon: Clock },
    { name: 'Transfer', path: '/transfer', icon: DollarSign },
    { name: 'Profile', path: '/profile', icon: UserCircle },
  ];

  // Add Admin Portal link for admin users in regular view
  if (user?.is_admin) {
    navItems.push({ name: 'Admin Portal', path: '/admin', icon: Shield });
  }

  const adminItems = [
    { name: 'Admin Hub', path: '/admin', icon: Shield },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Transactions', path: '/admin/transactions', icon: Clock },
    { name: 'Audit Logs', path: '/admin/audit', icon: History },
    { name: 'Support', path: '/admin/support', icon: MessageSquare },
    { name: 'Broadcast', path: '/admin/notifications', icon: Bell },
    { name: 'Loans', path: '/admin/loans', icon: Banknote },
    { name: 'Savings', path: '/admin/savings', icon: PiggyBank },
    { name: 'Investments', path: '/admin/investments', icon: LineChart },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const isAdminPath = location.pathname.startsWith('/admin') && user?.is_admin;
  const allNavItems = isAdminPath ? adminItems : navItems;

  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();
        
        if (!error && data) {
          setIsMaintenanceMode(data.value === true);
        }
      } catch (err) {
        console.error('Error checking maintenance mode:', err);
      } finally {
        setCheckingMaintenance(false);
      }
    };

    checkMaintenance();

    // Subscribe to changes in system_settings
    const channel = supabase
      .channel('system_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: 'key=eq.maintenance_mode' }, (payload) => {
        setIsMaintenanceMode(payload.new.value === true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (checkingMaintenance) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
      </div>
    );
  }

  if (isMaintenanceMode && !user?.is_admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="inline-flex p-6 bg-amber-500/10 rounded-[2.5rem] border border-amber-500/20">
            <ShieldAlert className="w-16 h-16 text-amber-500" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white tracking-tight">System Maintenance</h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              NovaBank is currently undergoing scheduled maintenance to improve our services. We'll be back online shortly.
            </p>
          </div>
          <div className="pt-8 border-t border-white/10">
            <p className="text-slate-500 text-sm font-medium">Estimated time remaining: 45 minutes</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-100 transition-all"
          >
            Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-72 bg-slate-900 text-white flex-col fixed h-full z-30 shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 bg-[#007856] rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <Shield className="h-6 w-6 text-[#FFB612]" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase italic">
              Nova<span className="text-[#FFB612]">Bank</span>
            </span>
          </div>
          
          <nav className="space-y-1.5">
            {allNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                  location.pathname === item.path
                    ? 'bg-[#007856] text-white shadow-lg shadow-emerald-900/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${
                  location.pathname === item.path ? 'text-white' : 'text-slate-500'
                }`} />
                <span className="font-bold text-sm tracking-wide">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl overflow-hidden ring-2 ring-slate-800 shadow-xl">
              <AvatarImage avatarUrl={user?.avatar_url} fullName={user?.full_name} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">{user?.full_name}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white transition-all duration-300 font-bold text-sm group shadow-lg"
          >
            <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-72 min-h-screen flex flex-col pb-24 md:pb-0">
        {/* Header - Mobile & Desktop */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 md:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="md:hidden flex items-center gap-2">
              <div className="h-8 w-8 bg-[#007856] rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-[#FFB612]" />
              </div>
              <span className="text-lg font-black tracking-tighter uppercase italic">
                Nova<span className="text-[#FFB612]">B</span>
              </span>
            </div>
            <div className="hidden md:block">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {allNavItems.find(item => item.path === location.pathname)?.name || 'Dashboard'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Server Status</span>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-600">Secure Connection</span>
              </div>
            </div>

            <Link 
              to="/notifications" 
              className="relative p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all group"
            >
              <Bell className="h-5 w-5 text-slate-600 group-hover:scale-110 transition-transform" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full ring-4 ring-white shadow-lg">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </Link>

            <Link to="/profile" className="md:hidden h-10 w-10 rounded-xl overflow-hidden ring-2 ring-slate-100 shadow-md">
              <AvatarImage avatarUrl={user?.avatar_url} fullName={user?.full_name} />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 px-6 py-3 z-40 flex items-center justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        {allNavItems.slice(0, 5).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${
              location.pathname === item.path ? 'text-[#007856] scale-110' : 'text-slate-400'
            }`}
          >
            <div className={`p-2 rounded-xl transition-all ${
              location.pathname === item.path ? 'bg-[#007856]/10' : ''
            }`}>
              <item.icon className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter">{item.name.split(' ')[0]}</span>
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-red-500 transition-all"
        >
          <div className="p-2 rounded-xl">
            <LogOut className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">Exit</span>
        </button>
      </nav>
    </div>
  );
}
