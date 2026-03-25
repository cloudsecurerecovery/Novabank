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
  X,
  Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { auditService } from '../../services/auditService';
import { useAuthStore } from '../../store/authStore';

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

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_id: string;
  details: any;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuthStore();
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<PendingTransaction[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<AuditLog[]>([]);
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
  const [processingRecurring, setProcessingRecurring] = useState(false);

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

      // Fetch recent audit logs
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!logsError) {
        setRecentLogs(logs || []);
      }

      // Fetch security events
      const { data: security, error: securityError } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name)')
        .in('action', ['failed_login_attempt', 'unauthorized_access', 'balance_update', 'system_settings_update'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (!securityError) {
        setSecurityEvents(security || []);
      }

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

      if (currentUser) {
        await auditService.log(currentUser.id, 'transaction_status_change', {
          transaction_id: id,
          new_status: action
        });
      }

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

        if (currentUser) {
          await auditService.log(currentUser.id, 'admin_broadcast', {
            message: broadcastMessage.trim(),
            user_count: users.length
          });
        }
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

  const handleProcessRecurring = async () => {
    try {
      setProcessingRecurring(true);
      
      // 1. Fetch all active recurring bills that are due
      const now = new Date().toISOString();
      const { data: bills, error: billsError } = await supabase
        .from('bill_payments')
        .select('*, profiles(balance)')
        .eq('is_recurring', true)
        .gt('remaining_payments', 0)
        .lte('scheduled_date', now)
        .eq('status', 'pending');

      if (billsError) throw billsError;

      if (!bills || bills.length === 0) {
        toast.success('No recurring payments due at this time.');
        return;
      }

      const processedBillIds: string[] = [];
      const failedBillIds: string[] = [];

      for (const bill of bills) {
        try {
          // Check balance
          if (bill.profiles.balance < bill.amount) {
            console.warn(`Insufficient balance for recurring bill ${bill.id}`);
            failedBillIds.push(bill.id);
            continue;
          }

          // Process payment
          const { error: balanceError } = await supabase
            .from('profiles')
            .update({ balance: bill.profiles.balance - bill.amount })
            .eq('id', bill.user_id);
          
          if (balanceError) throw balanceError;

          const { error: txError } = await supabase
            .from('transactions')
            .insert([{
              user_id: bill.user_id,
              amount: -bill.amount,
              description: `Recurring Bill: ${bill.biller_name}`,
              status: 'released',
              type: 'debit'
            }]);

          if (txError) throw txError;

          const nextDate = new Date(bill.scheduled_date);
          if (bill.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (bill.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          else if (bill.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

          const remaining = bill.remaining_payments - 1;
          
          const { error: nextBillError } = await supabase
            .from('bill_payments')
            .update({
              scheduled_date: nextDate.toISOString(),
              remaining_payments: remaining,
              is_recurring: remaining > 0,
              updated_at: now
            })
            .eq('id', bill.id);

          if (nextBillError) throw nextBillError;

          processedBillIds.push(bill.id);
        } catch (err) {
          console.error(`Error processing bill ${bill.id}:`, err);
          failedBillIds.push(bill.id);
        }
      }

      toast.success(`Processed ${processedBillIds.length} recurring payments. ${failedBillIds.length} failed.`);
      
      if (currentUser) {
        await auditService.log(currentUser.id, 'recurring_payment_processed', {
          processed_count: processedBillIds.length,
          failed_count: failedBillIds.length,
          processed_bill_ids: processedBillIds,
          failed_bill_ids: failedBillIds
        });
      }

      fetchData();
    } catch (err: any) {
      console.error('Error processing recurring payments:', err);
      toast.error(err.message || 'Failed to process recurring payments');
    } finally {
      setProcessingRecurring(false);
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
            onClick={handleProcessRecurring}
            disabled={processingRecurring}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
          >
            {processingRecurring ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Process Recurring
          </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* System Health */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">System Health</h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Operational
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Globe className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-600">API Latency</span>
                </div>
                <span className="text-sm font-bold text-emerald-600">24ms</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-xl">
                    <ArrowUpRight className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-600">Uptime</span>
                </div>
                <span className="text-sm font-bold text-emerald-600">99.98%</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-600">Error Rate</span>
                </div>
                <span className="text-sm font-bold text-emerald-600">0.02%</span>
              </div>

              <div className="pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  <span>Server Load</span>
                  <span>12%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#007856] rounded-full" style={{ width: '12%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[2rem] text-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Shield className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Security Shield</h3>
              <p className="text-slate-400 text-sm font-medium mb-6">Real-time threat monitoring and geographic blocking active.</p>
              <Link 
                to="/admin/settings"
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Security Settings <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Security Events */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden h-full">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Security Alerts</h2>
              <div className="p-2 bg-rose-50 rounded-xl">
                <Shield className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {securityEvents.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-medium">
                    No security alerts detected.
                  </div>
                ) : (
                  securityEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-4 p-4 hover:bg-rose-50/30 rounded-2xl transition-colors group">
                      <div className={`p-3 rounded-xl transition-all ${
                        event.action === 'failed_login_attempt' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {event.action.replace(/_/g, ' ')}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {format(new Date(event.created_at), 'HH:mm')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium line-clamp-1">
                          {event.profiles?.full_name || 'System'}: {typeof event.details === 'string' ? event.details : JSON.stringify(event.details)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Audit Logs */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden h-full">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Recent Audit Logs</h2>
              <Link 
                to="/admin/audit-logs"
                className="text-xs font-bold text-[#007856] hover:text-[#006045] flex items-center gap-1 uppercase tracking-widest"
              >
                View Full Log <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {recentLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-medium">
                    No recent audit logs found.
                  </div>
                ) : (
                  recentLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
                      <div className="p-3 bg-slate-100 rounded-xl text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {log.profiles?.full_name || 'System'}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium line-clamp-1">
                          {log.action}: {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
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
