import { useState, useEffect, Fragment } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../supabaseClient';
import { format, subDays, startOfDay } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, AlertCircle, AlertTriangle, X, ChevronDown, ChevronUp, Info, Send, ShieldCheck, PieChart, CreditCard, Building2, MessageSquare, UserCircle, Globe, Upload } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

interface Transaction {
  id: string;
  amount: number;
  status: 'pending' | 'hold' | 'released' | 'reversible';
  description: string;
  created_at: string;
}

interface AdminNote {
  id: string;
  message: string;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [adminNotes, setAdminNotes] = useState<AdminNote[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  const toggleExpand = (txId: string) => {
    setExpandedTxId(expandedTxId === txId ? null : txId);
  };

  const dismissNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('admin_notes')
        .delete()
        .eq('id', noteId);
      
      if (error) throw error;
      
      setAdminNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error dismissing note:', error);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      
      try {
        // Fetch transactions
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (txError) throw txError;

        if (txData) {
          setTransactions(txData);
          // Calculate balance from released transactions
          const calculatedBalance = txData
            .filter(tx => tx.status === 'released')
            .reduce((sum, tx) => sum + Number(tx.amount), 0);
          setBalance(calculatedBalance);

          // Generate chart data for the last 7 days
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = subDays(new Date(), i);
            return {
              date: format(date, 'MMM d'),
              fullDate: startOfDay(date),
              balance: 0
            };
          }).reverse();

          let runningBalance = calculatedBalance;
          const sortedTxs = [...txData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          const historyData = last7Days.map(day => {
            const dayTxs = sortedTxs.filter(tx => 
              startOfDay(new Date(tx.created_at)).getTime() === day.fullDate.getTime() && 
              tx.status === 'released'
            );
            const dayChange = dayTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
            const dataPoint = { ...day, balance: runningBalance };
            runningBalance -= dayChange; // Work backwards
            return dataPoint;
          }).reverse();

          setChartData(historyData);
        }

        // Fetch admin notes (warnings/notifications)
        const { data: notesData, error: notesError } = await supabase
          .from('admin_notes')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (notesError) throw notesError;
        if (notesData) {
          setAdminNotes(notesData);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Subscribe to realtime changes for transactions
    const txSubscription = supabase
      .channel('public:transactions')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'transactions',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        fetchDashboardData();
      })
      .subscribe();

    // Subscribe to realtime changes for admin notes
    const notesSubscription = supabase
      .channel('public:admin_notes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'admin_notes',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      txSubscription.unsubscribe();
      notesSubscription.unsubscribe();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007856]"></div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'released':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3" /> Released</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" /> Pending</span>;
      case 'hold':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3" /> On Hold</span>;
      case 'reversible':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><AlertCircle className="w-3 h-3" /> Reversible</span>;
      default:
        return null;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.full_name}</h1>
          <p className="text-sm text-slate-500 mt-1">Here's what's happening with your NovaBank accounts today.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-[#007856] bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <ShieldCheck className="w-4 h-4" />
          Secure Session Active
        </div>
      </div>

      {/* Admin Notes / Warnings */}
      <AnimatePresence>
        {adminNotes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {adminNotes.map(note => (
              <div key={note.id} className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-md flex items-start justify-between shadow-sm">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-amber-800">Important Notification</h3>
                    <p className="text-sm text-amber-700 mt-1">{note.message}</p>
                    <p className="text-xs text-amber-600 mt-2">{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => dismissNote(note.id)}
                  className="text-amber-500 hover:text-amber-700 focus:outline-none"
                  aria-label="Dismiss notification"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#007856] px-6 py-6 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium text-white/90">Primary Checking</h2>
                <p className="text-[#FFB612] text-sm font-mono mt-1">**** 1234</p>
              </div>
              <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                <Building2 className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Available Balance</p>
                  <p className="text-5xl font-bold text-slate-900 mt-2">
                    ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="h-[120px] w-full md:w-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#007856" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#007856" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: any) => [`$${value.toLocaleString()}`, 'Balance']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#007856" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorBalance)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                <Link to="/transfer" className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#007856] text-white text-sm font-semibold rounded-xl hover:bg-[#006045] transition-all shadow-sm shadow-emerald-200">
                  <Send className="w-4 h-4" />
                  Transfer Funds
                </Link>
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all">
                  <PieChart className="w-4 h-4" />
                  Insights
                </button>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
              <button className="text-sm font-semibold text-[#007856] hover:underline">View All</button>
            </div>
            
            {transactions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">No transactions found yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Transaction</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                      <th scope="col" className="relative px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <Fragment key={tx.id}>
                        <tr className="group hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${
                                Number(tx.amount) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'
                              }`}>
                                {Number(tx.amount) >= 0 ? (
                                  <ArrowDownLeft className="h-5 w-5" />
                                ) : (
                                  <ArrowUpRight className="h-5 w-5" />
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-bold text-slate-900 truncate max-w-[180px] md:max-w-xs">{tx.description}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{format(new Date(tx.created_at), 'MMM d, yyyy')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(tx.status)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${
                            Number(tx.amount) >= 0 ? 'text-emerald-600' : 'text-slate-900'
                          }`}>
                            {Number(tx.amount) >= 0 ? '+' : ''}${Math.abs(Number(tx.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => toggleExpand(tx.id)}
                              className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {expandedTxId === tx.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          </td>
                        </tr>
                        <AnimatePresence>
                          {expandedTxId === tx.id && (
                            <tr>
                              <td colSpan={4} className="px-0 py-0">
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden bg-slate-50/50"
                                >
                                  <div className="px-6 py-4 border-t border-slate-100">
                                    <div className="flex flex-col space-y-3">
                                      <div className="flex items-start gap-3">
                                        <Info className="w-5 h-5 text-slate-400 mt-0.5" />
                                        <div>
                                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Details</p>
                                          <p className="text-sm text-slate-700 mt-1 leading-relaxed">{tx.description}</p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200/50">
                                        <div>
                                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reference ID</p>
                                          <p className="text-xs text-slate-500 font-mono mt-1 break-all">{tx.id}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Processed On</p>
                                          <p className="text-xs text-slate-500 mt-1">{format(new Date(tx.created_at), 'MMMM d, yyyy h:mm:ss a')}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/transfer" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:text-[#007856] transition-all group border border-transparent hover:border-emerald-100">
                <Send className="w-6 h-6 mb-2 text-slate-400 group-hover:text-[#007856]" />
                <span className="text-xs font-bold">Send Money</span>
              </Link>
              <Link to="/deposit" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:text-[#007856] transition-all group border border-transparent hover:border-emerald-100">
                <Upload className="w-6 h-6 mb-2 text-slate-400 group-hover:text-[#007856]" />
                <span className="text-xs font-bold">Deposit</span>
              </Link>
              <Link to="/wire-transfer" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:text-[#007856] transition-all group border border-transparent hover:border-emerald-100">
                <Globe className="w-6 h-6 mb-2 text-slate-400 group-hover:text-[#007856]" />
                <span className="text-xs font-bold">Wire Transfer</span>
              </Link>
              <button className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:text-[#007856] transition-all group border border-transparent hover:border-emerald-100">
                <CreditCard className="w-6 h-6 mb-2 text-slate-400 group-hover:text-[#007856]" />
                <span className="text-xs font-bold">Pay Bills</span>
              </button>
              <Link to="/support" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:text-[#007856] transition-all group border border-transparent hover:border-emerald-100">
                <MessageSquare className="w-6 h-6 mb-2 text-slate-400 group-hover:text-[#007856]" />
                <span className="text-xs font-bold">Support</span>
              </Link>
              <Link to="/profile" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:text-[#007856] transition-all group border border-transparent hover:border-emerald-100">
                <UserCircle className="w-6 h-6 mb-2 text-slate-400 group-hover:text-[#007856]" />
                <span className="text-xs font-bold">Settings</span>
              </Link>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#007856] to-[#006045] rounded-2xl shadow-lg p-6 text-white overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2">NovaBank Platinum</h3>
              <p className="text-white/80 text-sm mb-4">You're eligible for a premium credit card upgrade with 3% cashback.</p>
              <button className="w-full py-2.5 bg-[#FFB612] text-[#007856] font-bold rounded-xl hover:bg-[#e5a310] transition-colors">
                Learn More
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Building2 className="w-32 h-32" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
