import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Users, 
  DollarSign, 
  ArrowUpRight, 
  MessageSquare, 
  TrendingUp, 
  Activity,
  ShieldCheck,
  ArrowDownLeft,
  Clock,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface Stats {
  totalUsers: number;
  totalBalance: number;
  transactionsToday: number;
  activeChats: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalBalance: 0,
    transactionsToday: 0,
    activeChats: 0
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      // 1. Total Users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 2. Total Balance (Released Transactions)
      const { data: txs } = await supabase
        .from('transactions')
        .select('amount, status, created_at')
        .eq('status', 'released');

      const totalBalance = txs?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

      // 3. Transactions Today
      const today = startOfDay(new Date()).toISOString();
      const { count: txTodayCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // 4. Active Chats (Users with messages in last 24h)
      const yesterday = subDays(new Date(), 1).toISOString();
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('sender_id')
        .gte('created_at', yesterday);
      
      const activeChats = new Set(recentMessages?.map(m => m.sender_id)).size;

      setStats({
        totalUsers: userCount || 0,
        totalBalance,
        transactionsToday: txTodayCount || 0,
        activeChats
      });

      // 5. Chart Data (Last 7 Days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        return {
          date: format(date, 'MMM d'),
          fullDate: startOfDay(date),
          volume: 0,
          count: 0
        };
      }).reverse();

      if (txs) {
        const historyData = last7Days.map(day => {
          const dayTxs = txs.filter(tx => 
            startOfDay(new Date(tx.created_at)).getTime() === day.fullDate.getTime()
          );
          return {
            ...day,
            volume: dayTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0),
            count: dayTxs.length
          };
        });
        setChartData(historyData);
      }

      // 6. Recent Activity
      const { data: recentTxs } = await supabase
        .from('transactions')
        .select('*, profiles:user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setRecentActivity(recentTxs || []);

    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007856]"></div>
      </div>
    );
  }

  const statCards = [
    { 
      title: 'Total Customers', 
      value: stats.totalUsers.toLocaleString(), 
      icon: Users, 
      color: 'bg-blue-50 text-blue-600',
      trend: '+12% from last month'
    },
    { 
      title: 'System Liquidity', 
      value: `$${stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 
      icon: DollarSign, 
      color: 'bg-emerald-50 text-emerald-600',
      trend: 'Stable growth'
    },
    { 
      title: 'Daily Transactions', 
      value: stats.transactionsToday.toString(), 
      icon: Activity, 
      color: 'bg-amber-50 text-amber-600',
      trend: 'High volume today'
    },
    { 
      title: 'Active Inquiries', 
      value: stats.activeChats.toString(), 
      icon: MessageSquare, 
      color: 'bg-purple-50 text-purple-600',
      trend: '2 agents responding'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Overview</h1>
          <p className="text-slate-500 font-medium">Real-time system performance and user activity.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Admin Access Verified</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.color} transition-colors group-hover:scale-110 duration-300`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
            </div>
            <h3 className="text-slate-500 text-sm font-bold mb-1">{stat.title}</h3>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{stat.trend}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Transaction Volume</h3>
              <p className="text-sm text-slate-500 font-medium">Last 7 days of system activity</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#007856]" />
                <span className="text-xs font-bold text-slate-500">Volume ($)</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007856" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#007856" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  stroke="#007856" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {recentActivity.map((tx, idx) => (
              <div key={tx.id} className="flex items-start gap-4">
                <div className={`mt-1 h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  tx.amount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'
                }`}>
                  {tx.amount >= 0 ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {tx.profiles?.full_name || 'System'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      {format(new Date(tx.created_at), 'h:mm a')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="text-center py-12">
                <Clock className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No recent activity</p>
              </div>
            )}
          </div>
          <button className="w-full mt-8 py-3 bg-slate-50 text-slate-600 font-bold text-xs rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest">
            View All Transactions
          </button>
        </div>
      </div>
    </div>
  );
}
