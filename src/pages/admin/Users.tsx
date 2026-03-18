import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { format } from 'date-fns';
import { ShieldAlert, Plus, Users as UsersIcon, Search, MoreVertical, X, DollarSign, Bell, ShieldCheck, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarImage } from '../../components/AvatarImage';

interface User {
  id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  balance?: number;
  avatar_url?: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [notificationMsg, setNotificationMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('user_id, amount')
        .eq('status', 'released');

      if (txError) throw txError;

      const usersWithBalances = profiles.map(profile => {
        const userTxs = transactions.filter(tx => tx.user_id === profile.id);
        const balance = userTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
        return { ...profile, balance };
      });

      setUsers(usersWithBalances);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !fundAmount) return;

    setActionLoading(true);
    try {
      const amount = parseFloat(fundAmount);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount greater than 0.');
        return;
      }

      const { error } = await supabase
        .from('transactions')
        .insert([{
          user_id: selectedUser.id,
          amount: amount,
          status: 'released',
          description: 'Admin Deposit'
        }]);

      if (error) throw error;

      // Log to audit log
      const { auditService } = await import('../../services/auditService');
      await auditService.log(selectedUser.id, 'admin_deposit', {
        amount: amount,
        admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      setFundAmount('');
      await fetchUsers();
      // Update selected user balance locally too
      setSelectedUser(prev => prev ? { ...prev, balance: (prev.balance || 0) + amount } : null);
    } catch (err) {
      console.error('Failed to add funds:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !notificationMsg) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('admin_notes')
        .insert([{
          user_id: selectedUser.id,
          message: notificationMsg
        }]);

      if (error) throw error;

      // Log to audit log
      const { auditService } = await import('../../services/auditService');
      await auditService.log(selectedUser.id, 'admin_notification', {
        message: notificationMsg,
        admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      setNotificationMsg('');
    } catch (err) {
      console.error('Failed to send notification:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007856]"></div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 font-medium">Manage NovaBank customers and their accounts.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balance</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Joined</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((u) => (
                <motion.tr 
                  key={u.id} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden group-hover:bg-[#007856] transition-colors">
                        <AvatarImage 
                          avatarUrl={u.avatar_url} 
                          fullName={u.full_name} 
                        />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{u.full_name || 'No Name'}</div>
                        <div className="text-xs text-slate-400 font-medium">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      u.is_admin ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {u.is_admin ? 'Admin' : 'Customer'}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-900">
                      ${(u.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <div className="text-xs text-slate-500 font-medium">
                      {format(new Date(u.created_at), 'MMM d, yyyy')}
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setIsPanelOpen(true);
                      }}
                      className="p-2 rounded-xl hover:bg-white hover:shadow-md transition-all text-[#007856]"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Panel */}
      <AnimatePresence>
        {isPanelOpen && selectedUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold text-slate-900">Manage User</h2>
                  <button 
                    onClick={() => setIsPanelOpen(false)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* User Info Card */}
                <div className="bg-slate-50 rounded-3xl p-6 mb-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-16 w-16 rounded-2xl bg-[#007856] flex items-center justify-center overflow-hidden">
                      <AvatarImage 
                        avatarUrl={selectedUser.avatar_url} 
                        fullName={selectedUser.full_name} 
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{selectedUser.full_name}</h3>
                      <p className="text-sm text-slate-500 font-medium">{selectedUser.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Balance</p>
                      <p className="text-lg font-bold text-[#007856]">${(selectedUser.balance || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                      <p className="text-sm font-bold text-slate-700">{selectedUser.is_admin ? 'Admin' : 'Customer'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Add Funds Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#007856]">
                      <Plus className="w-5 h-5" />
                      <h4 className="text-sm font-bold uppercase tracking-wider">Add Funds</h4>
                    </div>
                    <form onSubmit={handleAddFunds} className="space-y-4">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <DollarSign className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(e.target.value)}
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold"
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={actionLoading || !fundAmount}
                        className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Deposit Funds'}
                      </button>
                    </form>
                  </div>

                  {/* Notification Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-600">
                      <Bell className="w-5 h-5" />
                      <h4 className="text-sm font-bold uppercase tracking-wider">Send Notification</h4>
                    </div>
                    <form onSubmit={handleSendNotification} className="space-y-4">
                      <textarea
                        required
                        rows={4}
                        value={notificationMsg}
                        onChange={(e) => setNotificationMsg(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-slate-900 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium placeholder:text-slate-400"
                        placeholder="Enter message to user..."
                      />
                      <button
                        type="submit"
                        disabled={actionLoading || !notificationMsg}
                        className="w-full py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Message'}
                      </button>
                    </form>
                  </div>

                  {/* Security Badge */}
                  <div className="pt-8 border-t border-slate-100">
                    <div className="bg-emerald-50 rounded-2xl p-4 flex items-start gap-3 border border-emerald-100">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                        All admin actions are logged and audited for security compliance. NovaBank ensures full transparency in account management.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
