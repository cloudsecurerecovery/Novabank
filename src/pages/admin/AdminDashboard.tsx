import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search,
  Filter,
  Loader2,
  AlertCircle,
  Eye,
  CreditCard,
  MessageSquare,
  Globe,
  Wallet,
  Receipt,
  LineChart,
  ArrowRight,
  Bell,
  RefreshCw,
  Send,
  AlertTriangle,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface PendingTransaction {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  status: 'pending' | 'released' | 'rejected';
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
  user_documents?: {
    id: string;
    file_path: string;
    file_name: string;
  }[];
}

interface WireDetails {
  bank_name: string;
  swift_bic: string;
  account_number: string;
  routing_number: string;
  recipient_address: string;
  bank_address: string;
  wire_type: string;
}

interface AdminStats {
  total_users: number;
  total_balance: number;
  pending_transactions: number;
  active_cards: number;
  open_tickets: number;
  total_volume_today: number;
  pending_loans: number;
  active_loans_volume: number;
  total_savings_volume: number;
  pending_bills_count: number;
  total_investments_volume: number;
}

export default function AdminDashboard() {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<PendingTransaction | null>(null);
  const [wireDetails, setWireDetails] = useState<WireDetails | null>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    total_balance: 0,
    pending_transactions: 0,
    active_cards: 0,
    open_tickets: 0,
    total_volume_today: 0,
    pending_loans: 0,
    active_loans_volume: 0,
    total_savings_volume: 0,
    pending_bills_count: 0,
    total_investments_volume: 0
  });
  const [activeTab, setActiveTab] = useState<'pending' | 'recent'>('pending');
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats using RPC
      const { data: rpcStats, error: rpcError } = await supabase.rpc('get_admin_stats');
      
      if (rpcError) {
        console.warn('RPC get_admin_stats failed, falling back to manual fetch', rpcError);
        // Fallback manual fetch
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('balance');
        
        if (profilesError) throw profilesError;

        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const totalBalance = profiles?.reduce((acc, curr) => acc + (curr.balance || 0), 0) || 0;
        
        setStats({
          total_users: userCount || 0,
          total_balance: totalBalance,
          pending_transactions: 0,
          active_cards: 0,
          open_tickets: 0,
          total_volume_today: 0,
          pending_loans: 0,
          active_loans_volume: 0,
          total_savings_volume: 0,
          pending_bills_count: 0,
          total_investments_volume: 0
        });
      } else {
        setStats(rpcStats);
      }

      // Fetch pending transactions
      const { data: pending, error: pendingError } = await supabase
        .from('transactions')
        .select('*, profiles(full_name, email), user_documents(id, file_path, file_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;
      setPendingTransactions(pending || []);

      // Fetch recent transactions
      const { data: recent, error: recentError } = await supabase
        .from('transactions')
        .select('*, profiles(full_name, email), user_documents(id, file_path, file_name)')
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;
      setRecentTransactions(recent || []);

    } catch (err) {
      console.error('Error fetching admin data:', err);
      toast.error('Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionAction = async (id: string, action: 'released' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: action })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Transaction ${action === 'released' ? 'approved' : 'rejected'}`);
      setSelectedTx(null);
      fetchData();
    } catch (err) {
      console.error('Error updating transaction:', err);
      toast.error('Failed to update transaction');
    }
  };

  const fetchDetails = async (tx: PendingTransaction) => {
    setSelectedTx(tx);
    setDetailsLoading(true);
    setWireDetails(null);
    setDocUrls({});

    try {
      // Fetch wire details if it's a wire transfer
      if (tx.description.toLowerCase().includes('wire')) {
        const { data, error } = await supabase
          .from('wire_transfer_details')
          .select('*')
          .eq('transaction_id', tx.id)
          .single();
        
        if (!error && data) setWireDetails(data);
      }

      // Fetch signed URLs for documents
      if (tx.user_documents && tx.user_documents.length > 0) {
        const { storageService } = await import('../../services/storageService');
        const urls: Record<string, string> = {};
        for (const doc of tx.user_documents) {
          try {
            const url = await storageService.getSignedUrl(doc.file_path);
            urls[doc.id] = url;
          } catch (e) {
            console.error('Error getting signed URL:', e);
          }
        }
        setDocUrls(urls);
      }
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;

    try {
      setSendingBroadcast(true);
      // 1. Get all user IDs
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_admin', false);

      if (usersError) throw usersError;

      if (users && users.length > 0) {
        // 2. Insert notes for all users
        const notes = users.map(u => ({
          user_id: u.id,
          message: broadcastMessage.trim(),
          is_read: false
        }));

        const { error: insertError } = await supabase
          .from('admin_notes')
          .insert(notes);

        if (insertError) throw insertError;
      }

      toast.success(`Broadcast sent to ${users?.length || 0} users`);
      setIsBroadcastModalOpen(false);
      setBroadcastMessage('');
    } catch (err) {
      console.error('Error sending broadcast:', err);
      toast.error('Failed to send broadcast');
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Command Center</h1>
          <p className="text-slate-500 font-medium">Overview of system health and pending actions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsBroadcastModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200"
          >
            <Bell className="w-5 h-5" />
            System Broadcast
          </button>
          <button 
            onClick={fetchData}
            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <Users className="w-6 h-6 text-[#007856]" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Users</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.total_users.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <ArrowUpRight className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Deposits</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">${stats.total_balance.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Pending Actions</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.pending_transactions}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-50 rounded-2xl">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Today's Volume</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">${stats.total_volume_today.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-50 rounded-2xl">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Cards</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.active_cards}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Open Tickets</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.open_tickets}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Pending Loans</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.pending_loans}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <ArrowUpRight className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Loans</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">${stats.active_loans_volume.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Savings</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">${stats.total_savings_volume.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-50 rounded-2xl">
              <Receipt className="w-6 h-6 text-rose-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Pending Bills</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.pending_bills_count}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <LineChart className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Investment Volume</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">${stats.total_investments_volume.toLocaleString()}</p>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`text-xl font-bold transition-colors ${activeTab === 'pending' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-400'}`}
            >
              Pending Approvals
            </button>
            <button 
              onClick={() => setActiveTab('recent')}
              className={`text-xl font-bold transition-colors ${activeTab === 'recent' ? 'text-slate-900' : 'text-slate-300 hover:text-slate-400'}`}
            >
              Recent Activity
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              to="/admin/transactions"
              className="text-xs font-bold text-[#007856] hover:text-[#006045] flex items-center gap-1 uppercase tracking-widest"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
            <button 
              onClick={fetchData}
              className="p-2 text-slate-400 hover:text-[#007856] transition-colors"
              title="Refresh"
            >
              <Clock className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeTab === 'pending' ? (
                pendingTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No pending transactions found.
                    </td>
                  </tr>
                ) : (
                  pendingTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{tx.profiles?.full_name}</span>
                          <span className="text-xs text-slate-500">{tx.profiles?.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 font-medium">{tx.description}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          {format(new Date(tx.created_at), 'MMM dd, yyyy')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => fetchDetails(tx)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleTransactionAction(tx.id, 'rejected')}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleTransactionAction(tx.id, 'released')}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No recent activity found.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{tx.profiles?.full_name}</span>
                          <span className="text-xs text-slate-500">{tx.profiles?.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-600 font-medium">{tx.description}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${
                            tx.status === 'released' ? 'text-emerald-500' : 
                            tx.status === 'pending' ? 'text-amber-500' : 'text-rose-500'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          {format(new Date(tx.created_at), 'MMM dd, yyyy')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => fetchDetails(tx)}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Transaction Details</h2>
                  <p className="text-slate-500 text-sm font-medium mt-1">Reviewing transaction for {selectedTx.profiles.full_name}</p>
                </div>
                <button 
                  onClick={() => setSelectedTx(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                    <p className={`text-2xl font-bold ${selectedTx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {selectedTx.amount > 0 ? '+' : ''}${Math.abs(selectedTx.amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</p>
                    <p className="text-lg font-bold text-slate-900">{format(new Date(selectedTx.created_at), 'MMMM dd, yyyy')}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</p>
                  <p className="text-slate-700 font-medium">{selectedTx.description}</p>
                </div>

                {detailsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
                  </div>
                ) : (
                  <>
                    {wireDetails && (
                      <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 text-[#007856] mb-2">
                          <Globe className="w-5 h-5" />
                          <h3 className="font-bold uppercase tracking-wider text-xs">Wire Transfer Details</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Name</p>
                            <p className="text-sm font-bold text-slate-900">{wireDetails.bank_name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SWIFT/BIC</p>
                            <p className="text-sm font-bold text-slate-900">{wireDetails.swift_bic}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Number</p>
                            <p className="text-sm font-bold text-slate-900">{wireDetails.account_number}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing Number</p>
                            <p className="text-sm font-bold text-slate-900">{wireDetails.routing_number || 'N/A'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beneficiary Address</p>
                            <p className="text-sm font-bold text-slate-900">{wireDetails.recipient_address || 'N/A'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Address</p>
                            <p className="text-sm font-bold text-slate-900">{wireDetails.bank_address || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedTx.user_documents && selectedTx.user_documents.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[#007856]">
                          <Eye className="w-5 h-5" />
                          <h3 className="font-bold uppercase tracking-wider text-xs">Attached Documents</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedTx.user_documents.map(doc => (
                            <div key={doc.id} className="space-y-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{doc.file_name}</p>
                              {docUrls[doc.id] ? (
                                <a href={docUrls[doc.id]} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-slate-200">
                                  <img 
                                    src={docUrls[doc.id]} 
                                    alt={doc.file_name} 
                                    className="w-full h-32 object-cover hover:scale-105 transition-transform"
                                    referrerPolicy="no-referrer"
                                  />
                                </a>
                              ) : (
                                <div className="w-full h-32 bg-slate-100 rounded-xl animate-pulse" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-8 bg-slate-50 flex items-center gap-4">
                {selectedTx.status === 'pending' ? (
                  <>
                    <button 
                      onClick={() => handleTransactionAction(selectedTx.id, 'rejected')}
                      className="flex-1 py-4 bg-white border border-rose-100 text-rose-600 font-bold rounded-2xl hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject Transaction
                    </button>
                    <button 
                      onClick={() => handleTransactionAction(selectedTx.id, 'released')}
                      className="flex-1 py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Approve & Release
                    </button>
                  </>
                ) : (
                  <div className="w-full text-center py-2">
                    <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${
                      selectedTx.status === 'released' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      Transaction {selectedTx.status}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Broadcast Modal */}
      <AnimatePresence>
        {isBroadcastModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">System Broadcast</h2>
                  <button 
                    onClick={() => setIsBroadcastModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        This message will be sent to ALL non-admin users. Use this for important bank-wide notifications.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Broadcast Message</label>
                    <textarea 
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      rows={4}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#007856]/20 transition-all resize-none"
                      placeholder="Type your broadcast message here..."
                    />
                  </div>

                  <button
                    onClick={handleBroadcast}
                    disabled={sendingBroadcast || !broadcastMessage.trim()}
                    className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sendingBroadcast ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Send Broadcast
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
