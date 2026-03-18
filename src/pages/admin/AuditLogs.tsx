import React, { useState, useEffect } from 'react';
import { auditService, AuditLog } from '../../services/auditService';
import { format } from 'date-fns';
import { 
  Shield, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Activity, 
  ArrowRight, 
  LogIn, 
  LogOut, 
  Send, 
  Download,
  Info,
  ChevronDown,
  Loader2,
  Camera,
  Trash2,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await auditService.getLogs();
      setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login': return <LogIn className="w-4 h-4 text-emerald-600" />;
      case 'logout': return <LogOut className="w-4 h-4 text-slate-400" />;
      case 'transfer_sent': return <Send className="w-4 h-4 text-indigo-600" />;
      case 'transfer_received': return <ArrowRight className="w-4 h-4 text-emerald-600" rotate={180} />;
      case 'profile_update': return <User className="w-4 h-4 text-amber-600" />;
      case 'avatar_update': return <Camera className="w-4 h-4 text-indigo-600" />;
      case 'avatar_remove': return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'admin_deposit': return <Shield className="w-4 h-4 text-emerald-600" />;
      case 'admin_notification': return <Shield className="w-4 h-4 text-amber-600" />;
      case 'transaction_status_change': return <Activity className="w-4 h-4 text-indigo-600" />;
      case 'registration': return <UserPlus className="w-4 h-4 text-emerald-600" />;
      default: return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-500 font-medium">Complete history of significant system events and user actions.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
          <Download className="w-4 h-4" />
          Export Logs
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs by user, action, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="pl-11 pr-10 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all appearance-none font-bold text-slate-700 min-w-[180px]"
          >
            <option value="all">All Actions</option>
            <option value="login">Logins</option>
            <option value="registration">Registrations</option>
            <option value="transfer_sent">Transfers Sent</option>
            <option value="transfer_received">Transfers Received</option>
            <option value="profile_update">Profile Updates</option>
            <option value="avatar_update">Avatar Updates</option>
            <option value="avatar_remove">Avatar Removals</option>
            <option value="admin_deposit">Admin Deposits</option>
            <option value="transaction_status_change">Status Changes</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timestamp</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr 
                    className="hover:bg-slate-50/50 transition-all cursor-pointer group"
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
                          {getActionIcon(log.action)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            ID: {log.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{log.user_name || 'System'}</p>
                        <p className="text-xs text-slate-400 font-medium">{log.user_email}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-xs font-bold text-[#007856] hover:underline">
                        {expandedLogId === log.id ? 'Hide Details' : 'View Details'}
                      </button>
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expandedLogId === log.id && (
                      <tr>
                        <td colSpan={4} className="px-8 py-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pb-8 pt-2">
                              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <Info className="w-3 h-3" /> Payload Data
                                </h4>
                                <pre className="text-xs font-mono text-slate-600 bg-white p-4 rounded-xl border border-slate-100 overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                                {log.ip_address && (
                                  <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    IP Address: <span className="text-slate-600 font-mono">{log.ip_address}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Activity className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No audit logs found</h3>
            <p className="text-slate-500 font-medium mt-1">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
