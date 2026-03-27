import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../supabaseClient';
import { 
  Users, 
  Search,
  Filter,
  Loader2,
  Eye,
  Shield,
  UserCheck,
  UserX,
  History,
  Mail,
  Phone,
  ArrowRight,
  X,
  Calendar,
  ShieldAlert,
  Lock,
  Unlock,
  DollarSign,
  CheckCircle2,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Key,
  Edit3,
  Wallet,
  Landmark,
  LineChart,
  ChevronUp,
  ChevronDown,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { auditService } from '../../services/auditService';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  balance: number;
  savings_balance?: number;
  loan_balance?: number;
  investment_balance?: number;
  is_admin: boolean;
  role: string;
  account_status: string;
  kyc_status: string;
  created_at: string;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<string>('');
  const [newSavingsBalance, setNewSavingsBalance] = useState<string>('');
  const [newLoanBalance, setNewLoanBalance] = useState<string>('');
  const [newInvestmentBalance, setNewInvestmentBalance] = useState<string>('');
  const [adjustingBalance, setAdjustingBalance] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [editProfileData, setEditProfileData] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [balanceMode, setBalanceMode] = useState<'set' | 'adjust'>('set');
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [targetBalanceType, setTargetBalanceType] = useState<'checking' | 'savings' | 'loan' | 'investment'>('checking');
  const [adjustmentDescription, setAdjustmentDescription] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof UserProfile; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterKYC, setFilterKYC] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentState: boolean) => {
    const newRole = !currentState ? 'admin' : 'user';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_admin: !currentState,
          role: newRole
        })
        .eq('id', userId);

      if (error) throw error;
      
      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_role_update', {
          target_user_id: userId,
          new_role: newRole,
          is_admin: !currentState
        });
      }

      toast.success(`User role updated to ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}`);
      fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_admin: !currentState, role: newRole } : null);
      }
    } catch (err) {
      console.error('Error updating admin status:', err);
      toast.error('Failed to update admin status');
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'frozen' : 'active';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: newStatus })
        .eq('id', userId);

      if (error) throw error;
      
      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_status_update', {
          target_user_id: userId,
          new_status: newStatus
        });
      }

      toast.success(`Account ${newStatus === 'frozen' ? 'frozen' : 'unfrozen'} successfully`);
      fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, account_status: newStatus } : null);
      }
    } catch (err) {
      console.error('Error updating account status:', err);
      toast.error('Failed to update account status');
    }
  };

  const handleVerifyKYC = async (userId: string, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ kyc_status: status })
        .eq('id', userId);

      if (error) throw error;
      
      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_kyc_update', {
          target_user_id: userId,
          new_status: status
        });
      }

      toast.success(`KYC status updated to ${status}`);
      fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, kyc_status: status } : null);
      }
    } catch (err) {
      console.error('Error updating KYC status:', err);
      toast.error('Failed to update KYC status');
    }
  };

  const openDetails = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDetailsModalOpen(true);
  };

  const openMessageModal = (user: UserProfile) => {
    setSelectedUser(user);
    setMessageText('');
    setIsMessageModalOpen(true);
  };

  const openTransactionsModal = async (user: UserProfile) => {
    setSelectedUser(user);
    setIsTransactionsModalOpen(true);
    setTxLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUserTransactions(data || []);
    } catch (err) {
      console.error('Error fetching user transactions:', err);
      toast.error('Failed to load transactions');
    } finally {
      setTxLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim()) return;

    try {
      setSendingMessage(true);
      const { error } = await supabase
        .from('admin_notes')
        .insert({
          user_id: selectedUser.id,
          message: messageText.trim(),
          is_read: false
        });

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_notification', {
          target_user_id: selectedUser.id,
          message: messageText.trim()
        });
      }

      toast.success('Message sent to user');
      setIsMessageModalOpen(false);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const openEditBalance = (user: UserProfile) => {
    setSelectedUser(user);
    setNewBalance((user.balance || 0).toString());
    setNewSavingsBalance((user.savings_balance || 0).toString());
    setNewLoanBalance((user.loan_balance || 0).toString());
    setNewInvestmentBalance((user.investment_balance || 0).toString());
    setBalanceMode('set');
    setAdjustmentAmount('');
    setAdjustmentDescription('');
    setIsEditBalanceModalOpen(true);
  };

  const openEditProfile = (user: UserProfile) => {
    setSelectedUser(user);
    setEditProfileData({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || ''
    });
    setIsEditProfileModalOpen(true);
  };

  const handleUpdateProfile = async () => {
    if (!selectedUser) return;

    try {
      setUpdatingProfile(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editProfileData.full_name,
          email: editProfileData.email,
          phone: editProfileData.phone
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_profile_update', {
          target_user_id: selectedUser.id,
          updated_fields: editProfileData
        });
      }

      toast.success('User profile updated successfully');
      setIsEditProfileModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      setResettingPassword(email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_password_reset_sent', {
          target_email: email
        });
      }

      toast.success('Password reset email sent to user');
    } catch (err: any) {
      console.error('Error resetting password:', err);
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setResettingPassword(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      // In a real app, you might want to soft delete or use a service role to delete from auth.users
      // For now, we'll mark the account as 'deleted' in profiles
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: 'deleted' })
        .eq('id', userId);

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_user_delete', {
          target_user_id: userId
        });
      }

      toast.success('User account marked as deleted');
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Failed to delete user');
    }
  };

  const handleUpdateBalance = async () => {
    if (!selectedUser) return;

    try {
      setAdjustingBalance(true);

      if (balanceMode === 'set') {
        const balanceTypes: ('checking' | 'savings' | 'loan' | 'investment')[] = ['checking', 'savings', 'loan', 'investment'];
        const newBalances = [
          Number(newBalance) || 0,
          Number(newSavingsBalance) || 0,
          Number(newLoanBalance) || 0,
          Number(newInvestmentBalance) || 0
        ];

        for (let i = 0; i < balanceTypes.length; i++) {
          const type = balanceTypes[i];
          const newVal = newBalances[i];
          const oldVal = i === 0 ? selectedUser.balance : 
                        i === 1 ? selectedUser.savings_balance :
                        i === 2 ? selectedUser.loan_balance :
                        selectedUser.investment_balance;

          if (newVal !== (oldVal || 0)) {
            const { error } = await supabase.rpc('admin_set_balance', {
              target_user_id: selectedUser.id,
              new_balance: newVal,
              balance_type: type
            });
            if (error) throw error;
          }
        }
      } else {
        if (!adjustmentAmount || isNaN(Number(adjustmentAmount))) {
          toast.error('Please enter a valid amount');
          return;
        }

        const amount = Number(adjustmentAmount) * (adjustmentType === 'debit' ? -1 : 1);
        const { error } = await supabase.rpc('admin_adjust_balance', {
          target_user_id: selectedUser.id,
          amount: amount,
          description: adjustmentDescription || `Admin ${adjustmentType === 'credit' ? 'Credit' : 'Debit'} (${targetBalanceType})`,
          balance_type: targetBalanceType
        });

        if (error) throw error;
      }

      // Log the action
      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_balance_adjustment', {
          target_user_id: selectedUser.id,
          mode: balanceMode,
          details: balanceMode === 'set' ? {
            checking: newBalance,
            savings: newSavingsBalance,
            loan: newLoanBalance,
            investment: newInvestmentBalance
          } : {
            type: targetBalanceType,
            amount: adjustmentAmount,
            action: adjustmentType
          }
        });
      }

      toast.success('Balances updated successfully');
      setIsEditBalanceModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error('Error updating balance:', err);
      toast.error(err.message || 'Failed to update balance');
    } finally {
      setAdjustingBalance(false);
    }
  };

  const handleSort = (key: keyof UserProfile) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredUsers = users
    .filter(user => {
      const matchesSearch = 
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || user.account_status === filterStatus;
      const matchesKYC = filterKYC === 'all' || user.kyc_status === filterKYC;
      const matchesRole = filterRole === 'all' || (filterRole === 'admin' ? user.is_admin : !user.is_admin);

      return matchesSearch && matchesStatus && matchesKYC && matchesRole;
    })
    .sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || bValue === undefined) return 0;

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 font-medium">Manage accounts, verify identities, and adjust limits.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all w-full md:w-64"
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-3 bg-white border border-slate-100 rounded-2xl transition-colors ${isFilterOpen ? 'text-[#007856] ring-2 ring-[#007856]/20' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Filter className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-72 bg-white rounded-[24px] shadow-2xl border border-slate-100 p-6 z-50 space-y-4"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-900">Filters</h3>
                    <button 
                      onClick={() => {
                        setFilterStatus('all');
                        setFilterKYC('all');
                        setFilterRole('all');
                      }}
                      className="text-[10px] font-bold text-[#007856] hover:underline"
                    >
                      Reset All
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Status</label>
                      <select 
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#007856]/20"
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="frozen">Frozen</option>
                        <option value="deleted">Deleted</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KYC Status</label>
                      <select 
                        value={filterKYC}
                        onChange={(e) => setFilterKYC(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#007856]/20"
                      >
                        <option value="all">All KYC</option>
                        <option value="verified">Verified</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                        <option value="unverified">Unverified</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</label>
                      <select 
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#007856]/20"
                      >
                        <option value="all">All Roles</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('full_name')}
                >
                  <div className="flex items-center gap-2">
                    User Details
                    {sortConfig.key === 'full_name' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center gap-2">
                    Email
                    {sortConfig.key === 'email' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('balance')}
                >
                  <div className="flex items-center gap-2">
                    Balance
                    {sortConfig.key === 'balance' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('account_status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {sortConfig.key === 'account_status' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('is_admin')}
                >
                  <div className="flex items-center gap-2">
                    Role
                    {sortConfig.key === 'is_admin' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('kyc_status')}
                >
                  <div className="flex items-center gap-2">
                    KYC
                    {sortConfig.key === 'kyc_status' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-2">
                    Join Date
                    {sortConfig.key === 'created_at' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold">
                        {user.full_name?.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{user.full_name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500 font-medium">{user.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-900">
                      ${(user.balance || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${user.account_status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${user.account_status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {user.account_status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007856] focus:ring-offset-2 ${
                          user.is_admin ? 'bg-purple-600' : 'bg-slate-200'
                        }`}
                        title={user.is_admin ? 'Revoke Admin Access' : 'Grant Admin Access'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            user.is_admin ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.is_admin ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-600'
                      }`}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user.kyc_status === 'verified' ? 'bg-emerald-50 text-emerald-600' : 
                      user.kyc_status === 'pending' ? 'bg-blue-50 text-blue-600' :
                      user.kyc_status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {user.kyc_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {format(new Date(user.created_at), 'MMM dd, yyyy')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openEditProfile(user)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="Edit Profile"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(user.email)}
                        disabled={resettingPassword === user.email}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors disabled:opacity-50"
                        title="Reset Password"
                      >
                        {resettingPassword === user.email ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => openMessageModal(user)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        title="Send Message"
                      >
                        <Mail className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => openTransactionsModal(user)}
                        className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                        title="View Transactions"
                      >
                        <History className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => openEditBalance(user)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                        title="Edit Balance"
                      >
                        <DollarSign className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(user.id, user.account_status)}
                        className={`p-2 rounded-xl transition-colors ${
                          user.account_status === 'active' 
                            ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' 
                            : 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                        }`}
                        title={user.account_status === 'active' ? 'Freeze Account' : 'Unfreeze Account'}
                      >
                        {user.account_status === 'active' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => openDetails(user)}
                        className="p-2 text-slate-400 hover:text-[#007856] hover:bg-emerald-50 rounded-xl transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      <AnimatePresence>
        {isDetailsModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-2xl font-bold text-slate-400">
                      {selectedUser.full_name?.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedUser.full_name}</h2>
                      <p className="text-slate-500 font-medium">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Phone className="w-3 h-3" /> Phone Number
                    </p>
                    <p className="text-sm font-bold text-slate-900">{selectedUser.phone || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> Join Date
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {format(new Date(selectedUser.created_at), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldAlert className="w-3 h-3" /> KYC Status
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedUser.kyc_status === 'verified' ? 'bg-emerald-50 text-emerald-600' : 
                        selectedUser.kyc_status === 'pending' ? 'bg-blue-50 text-blue-600' :
                        selectedUser.kyc_status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {selectedUser.kyc_status}
                      </span>
                      {selectedUser.kyc_status === 'pending' && (
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleVerifyKYC(selectedUser.id, 'verified')}
                            className="p-1 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 transition-colors"
                            title="Approve KYC"
                          >
                            <UserCheck className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleVerifyKYC(selectedUser.id, 'rejected')}
                            className="p-1 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 transition-colors"
                            title="Reject KYC"
                          >
                            <UserX className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <History className="w-3 h-3" /> Account Status
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedUser.account_status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {selectedUser.account_status}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => handleToggleStatus(selectedUser.id, selectedUser.account_status)}
                    className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      selectedUser.account_status === 'active'
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {selectedUser.account_status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    {selectedUser.account_status === 'active' ? 'Freeze Account' : 'Unfreeze Account'}
                  </button>
                  <div className={`flex-1 py-4 px-6 rounded-2xl font-bold text-sm transition-all flex items-center justify-between gap-2 ${
                    selectedUser.is_admin
                      ? 'bg-purple-50 text-purple-600'
                      : 'bg-slate-50 text-slate-600'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>{selectedUser.is_admin ? 'Admin' : 'User'}</span>
                    </div>
                    <button
                      onClick={() => handleToggleAdmin(selectedUser.id, selectedUser.is_admin)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        selectedUser.is_admin ? 'bg-purple-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          selectedUser.is_admin ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditProfileModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Edit User Profile</h2>
                  <button 
                    onClick={() => setIsEditProfileModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                    <input 
                      type="text"
                      value={editProfileData.full_name}
                      onChange={(e) => setEditProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                    <input 
                      type="email"
                      value={editProfileData.email}
                      onChange={(e) => setEditProfileData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</label>
                    <input 
                      type="tel"
                      value={editProfileData.phone}
                      onChange={(e) => setEditProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>

                  <button
                    onClick={handleUpdateProfile}
                    disabled={updatingProfile}
                    className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Balance Modal */}
      <AnimatePresence>
        {isEditBalanceModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Adjust Balance</h2>
                  <button 
                    onClick={() => setIsEditBalanceModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">User</p>
                    <p className="text-sm font-bold text-slate-900">{selectedUser.full_name}</p>
                    <p className="text-xs text-slate-500">{selectedUser.email}</p>
                  </div>

                  <div className="flex p-1 bg-slate-100 rounded-2xl">
                    <button
                      onClick={() => setBalanceMode('set')}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        balanceMode === 'set' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Set Balance
                    </button>
                    <button
                      onClick={() => setBalanceMode('adjust')}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        balanceMode === 'adjust' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Credit / Debit
                    </button>
                  </div>

                  <div className="space-y-4">
                    {balanceMode === 'set' ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Checking Balance (USD)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                              type="number"
                              value={newBalance}
                              onChange={(e) => setNewBalance(e.target.value)}
                              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Savings Balance (USD)</label>
                          <div className="relative">
                            <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                              type="number"
                              value={newSavingsBalance}
                              onChange={(e) => setNewSavingsBalance(e.target.value)}
                              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loan Balance (USD)</label>
                          <div className="relative">
                            <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                              type="number"
                              value={newLoanBalance}
                              onChange={(e) => setNewLoanBalance(e.target.value)}
                              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Investment Balance (USD)</label>
                          <div className="relative">
                            <LineChart className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                              type="number"
                              value={newInvestmentBalance}
                              onChange={(e) => setNewInvestmentBalance(e.target.value)}
                              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</label>
                            <select
                              value={adjustmentType}
                              onChange={(e) => setAdjustmentType(e.target.value as 'credit' | 'debit')}
                              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                            >
                              <option value="credit">Credit (+)</option>
                              <option value="debit">Debit (-)</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account</label>
                            <select
                              value={targetBalanceType}
                              onChange={(e) => setTargetBalanceType(e.target.value as any)}
                              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                            >
                              <option value="checking">Checking</option>
                              <option value="savings">Savings</option>
                              <option value="loan">Loan</option>
                              <option value="investment">Investment</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount (USD)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input 
                              type="number"
                              value={adjustmentAmount}
                              onChange={(e) => setAdjustmentAmount(e.target.value)}
                              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description (Optional)</label>
                          <input 
                            type="text"
                            value={adjustmentDescription}
                            onChange={(e) => setAdjustmentDescription(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#007856]/20 transition-all"
                            placeholder="e.g. Manual credit for deposit"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      Manual balance adjustments are logged and should only be used for corrections or approved manual credits.
                    </p>
                  </div>

                  <button
                    onClick={handleUpdateBalance}
                    disabled={adjustingBalance || isNaN(Number(newBalance))}
                    className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {adjustingBalance ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirm Adjustment
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Send Message Modal */}
      <AnimatePresence>
        {isMessageModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Send Bank Message</h2>
                  <button 
                    onClick={() => setIsMessageModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recipient</p>
                    <p className="text-sm font-bold text-slate-900">{selectedUser.full_name}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message Content</label>
                    <textarea 
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows={4}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#007856]/20 transition-all resize-none"
                      placeholder="Type your message here..."
                    />
                  </div>

                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !messageText.trim()}
                    className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Send Message
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Transactions Modal */}
      <AnimatePresence>
        {isTransactionsModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Transaction History</h2>
                  <p className="text-sm text-slate-500 font-medium">{selectedUser.full_name}</p>
                </div>
                <button 
                  onClick={() => setIsTransactionsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                {txLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
                  </div>
                ) : userTransactions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">No transactions found for this user.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            tx.amount >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                          }`}>
                            {tx.amount >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{tx.description}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {format(new Date(tx.created_at), 'MMM dd, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                          </p>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${
                            tx.status === 'released' ? 'text-emerald-500' : 
                            tx.status === 'pending' ? 'text-amber-500' : 'text-rose-500'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
