import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { format } from 'date-fns';
import { 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreHorizontal,
  Download,
  Calendar,
  User as UserIcon,
  Plus,
  Bell,
  Send,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'hold' | 'released' | 'reversible';
  description: string;
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

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string>('');
  const [noticeLoading, setNoticeLoading] = useState<string | null>(null);
  const [noticeSuccess, setNoticeSuccess] = useState<string | null>(null);
  const [isBulkNoticeOpen, setIsBulkNoticeOpen] = useState(false);
  const [bulkNoticeMessage, setBulkNoticeMessage] = useState('');
  const [bulkNoticeLoading, setBulkNoticeLoading] = useState(false);
  const [bulkNoticeSuccess, setBulkNoticeSuccess] = useState(false);
  const [checkImages, setCheckImages] = useState<Record<string, string>>({});

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          profiles:user_id (full_name, email),
          user_documents:user_documents(id, file_path, file_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data as any);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const loadCheckImages = async () => {
      if (!expandedTxId) return;
      const tx = transactions.find(t => t.id === expandedTxId);
      if (!tx?.user_documents?.length) return;

      const { storageService } = await import('../../services/storageService');
      const urls: Record<string, string> = {};
      
      for (const doc of tx.user_documents) {
        try {
          const url = await storageService.getSignedUrl(doc.file_path);
          urls[doc.id] = url;
        } catch (e) {
          console.error('Failed to get signed URL', e);
        }
      }
      setCheckImages(prev => ({ ...prev, ...urls }));
    };

    loadCheckImages();
  }, [expandedTxId, transactions]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      const oldStatus = tx.status;
      const targetStatus = newStatus.toLowerCase() as Transaction['status'];
      const amount = tx.amount;
      const userId = tx.user_id;

      const { error } = await supabase
        .from('transactions')
        .update({ status: targetStatus })
        .eq('id', id);

      if (error) throw error;

      // Log to audit log
      const { auditService } = await import('../../services/auditService');
      await auditService.log(userId, 'transaction_status_change', {
        transaction_id: id,
        old_status: oldStatus,
        new_status: targetStatus,
        admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      await fetchTransactions();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendNotice = async (userId: string, txId: string) => {
    if (!noticeMessage.trim()) return;
    setNoticeLoading(txId);
    try {
      const { error } = await supabase
        .from('admin_notes')
        .insert([{
          user_id: userId,
          message: noticeMessage
        }]);

      if (error) throw error;

      // Log to audit log
      const { auditService } = await import('../../services/auditService');
      await auditService.log(userId, 'admin_notification', {
        message: noticeMessage,
        transaction_id: txId,
        admin_id: (await supabase.auth.getUser()).data.user?.id
      });

      setNoticeMessage('');
      setNoticeSuccess(txId);
      setTimeout(() => setNoticeSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to send notice:', err);
      alert('Failed to send notice');
    } finally {
      setNoticeLoading(null);
    }
  };

  const handleBulkSendNotice = async () => {
    if (!bulkNoticeMessage.trim() || filteredTransactions.length === 0) return;
    
    setBulkNoticeLoading(true);
    try {
      // Get unique user IDs from filtered transactions
      const uniqueUserIds = Array.from(new Set(filteredTransactions.map(tx => tx.user_id)));
      
      const { auditService } = await import('../../services/auditService');
      const adminId = (await supabase.auth.getUser()).data.user?.id;

      // Send notices in batches or sequentially
      for (const userId of uniqueUserIds) {
        await supabase
          .from('admin_notes')
          .insert([{
            user_id: userId,
            message: bulkNoticeMessage
          }]);

        await auditService.log(userId, 'admin_notification', {
          message: bulkNoticeMessage,
          is_bulk: true,
          filter_criteria: { statuses: selectedStatuses, search: searchQuery },
          admin_id: adminId
        });
      }

      setBulkNoticeSuccess(true);
      setBulkNoticeMessage('');
      setTimeout(() => {
        setBulkNoticeSuccess(false);
        setIsBulkNoticeOpen(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to send bulk notices:', err);
      alert('Failed to send some notices. Please check logs.');
    } finally {
      setBulkNoticeLoading(false);
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case 'released': 
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-100',
          icon: <CheckCircle2 className="w-3 h-3" />
        };
      case 'pending': 
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-100',
          icon: <Clock className="w-3 h-3" />
        };
      case 'hold': 
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-100',
          icon: <AlertCircle className="w-3 h-3" />
        };
      case 'reversible': 
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-700',
          border: 'border-orange-100',
          icon: <AlertCircle className="w-3 h-3" />
        };
      case 'add_funds':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-100',
          icon: <Plus className="w-3 h-3" />
        };
      default: 
        return {
          bg: 'bg-slate-50',
          text: 'text-slate-700',
          border: 'border-slate-100',
          icon: <Info className="w-3 h-3" />
        };
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedStatuses.length === 0 || 
      selectedStatuses.some(status => {
        if (status === 'add_funds') {
          return tx.description === 'Admin Deposit';
        }
        return tx.status === status;
      });
    
    return matchesSearch && matchesStatus;
  });

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const statusOptions = [
    { id: 'add_funds', label: 'Add Funds' },
    { id: 'pending', label: 'Pending' },
    { id: 'hold', label: 'On Hold' },
    { id: 'released', label: 'Released' },
    { id: 'reversible', label: 'Reversible' },
  ];

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['ID', 'Date', 'Customer', 'Email', 'Amount', 'Status', 'Description'];
    const rows = filteredTransactions.map(tx => [
      tx.id,
      format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
      tx.profiles?.full_name || 'Unknown',
      tx.profiles?.email || 'Unknown',
      tx.amount,
      tx.status,
      tx.description
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007856]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transaction Control</h1>
          <p className="text-slate-500 font-medium">Monitor and manage all system transactions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedStatuses([])}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedStatuses.length === 0 
                  ? 'bg-[#007856] text-white shadow-lg shadow-emerald-100' 
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              All Transactions
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 mr-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filter Status:</span>
          </div>
          {statusOptions.map((option) => {
            const isSelected = selectedStatuses.includes(option.id);
            const styles = getStatusStyles(option.id);
            return (
              <button
                key={option.id}
                onClick={() => toggleStatus(option.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isSelected 
                    ? `${styles.bg} ${styles.text} ${styles.border} shadow-sm ring-2 ring-offset-1 ring-emerald-500/20` 
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {styles.icon}
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Bulk Notice Section */}
        {selectedStatuses.length > 0 && filteredTransactions.length > 0 && (
          <div className="mt-2 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-amber-600">
                <Bell className="w-4 h-4" />
                <span className="text-xs font-bold">Bulk Action: Send notice to {new Set(filteredTransactions.map(t => t.user_id)).size} unique users in filtered results</span>
              </div>
              <button
                onClick={() => setIsBulkNoticeOpen(!isBulkNoticeOpen)}
                className="text-xs font-bold text-[#007856] hover:underline"
              >
                {isBulkNoticeOpen ? 'Cancel' : 'Send Bulk Notice'}
              </button>
            </div>

            <AnimatePresence>
              {isBulkNoticeOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <textarea
                        value={bulkNoticeMessage}
                        onChange={(e) => setBulkNoticeMessage(e.target.value)}
                        placeholder="Type a message to all filtered users..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleBulkSendNotice}
                        disabled={bulkNoticeLoading || !bulkNoticeMessage.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-2xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
                      >
                        {bulkNoticeLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : bulkNoticeSuccess ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {bulkNoticeSuccess ? 'Sent!' : 'Send to All'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence>
                {filteredTransactions.map((tx) => {
                  const status = getStatusStyles(tx.status);
                  const isExpanded = expandedTxId === tx.id;
                  
                  return (
                    <motion.tr 
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-slate-50/50 transition-all group ${isExpanded ? 'bg-slate-50/50' : ''}`}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                            tx.amount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {tx.amount >= 0 ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                          </div>
                          <div className="max-w-[200px]">
                            <p className="text-sm font-bold text-slate-900 truncate">{tx.description}</p>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                            {tx.profiles?.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{tx.profiles?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-400 font-medium">{tx.profiles?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className={`text-sm font-bold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {tx.amount >= 0 ? '+' : ''}{Number(tx.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </p>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${status.bg} ${status.text} ${status.border}`}>
                          {status.icon}
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="relative inline-block text-left">
                          <select
                            value={tx.status}
                            disabled={actionLoading === tx.id}
                            onChange={(e) => handleStatusChange(tx.id, e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#007856]/20 transition-all appearance-none pr-8 cursor-pointer disabled:opacity-50"
                          >
                            <option value="pending">Pending</option>
                            <option value="hold">Hold</option>
                            <option value="released">Released</option>
                            <option value="reversible">Reversible</option>
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-4 py-5 text-right">
                        <button
                          onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                          className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-[#007856] text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Expanded Details View */}
        <AnimatePresence>
          {expandedTxId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-50/50 border-t border-slate-100 overflow-hidden"
            >
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Info className="w-4 h-4" />
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">Transaction Info</h4>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference ID</p>
                        <p className="text-xs font-mono text-slate-600 mt-1">{expandedTxId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Timestamp</p>
                        <p className="text-xs font-medium text-slate-600 mt-1">
                          {format(new Date(transactions.find(t => t.id === expandedTxId)?.created_at || ''), 'MMMM d, yyyy h:mm:ss a')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <UserIcon className="w-4 h-4" />
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">Customer Details</h4>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User ID</p>
                        <p className="text-xs font-mono text-slate-600 mt-1">
                          {transactions.find(t => t.id === expandedTxId)?.user_id}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Holder</p>
                        <p className="text-xs font-medium text-slate-600 mt-1">
                          {transactions.find(t => t.id === expandedTxId)?.profiles?.full_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <FileText className="w-4 h-4" />
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">Description & Documents</h4>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4">
                      <p className="text-sm text-slate-700 leading-relaxed italic">
                        "{transactions.find(t => t.id === expandedTxId)?.description}"
                      </p>
                      
                      {transactions.find(t => t.id === expandedTxId)?.user_documents?.length ? (
                        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-50">
                          {transactions.find(t => t.id === expandedTxId)?.user_documents?.map(doc => (
                            <div key={doc.id} className="space-y-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{doc.file_name}</p>
                              {checkImages[doc.id] ? (
                                <a href={checkImages[doc.id]} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg border border-slate-100">
                                  <img 
                                    src={checkImages[doc.id]} 
                                    alt={doc.file_name} 
                                    className="w-full h-24 object-cover transition-transform group-hover:scale-110"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Download className="w-5 h-5 text-white" />
                                  </div>
                                </a>
                              ) : (
                                <div className="w-full h-24 bg-slate-50 rounded-lg animate-pulse" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Send Notice Section */}
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-amber-600 mb-4">
                    <Bell className="w-4 h-4" />
                    <h4 className="text-[10px] font-bold uppercase tracking-widest">Send Notice to Customer</h4>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <textarea
                        value={noticeMessage}
                        onChange={(e) => setNoticeMessage(e.target.value)}
                        placeholder="Type a message to the user regarding this transaction..."
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          const tx = transactions.find(t => t.id === expandedTxId);
                          if (tx) handleSendNotice(tx.user_id, tx.id);
                        }}
                        disabled={noticeLoading === expandedTxId || !noticeMessage.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-2xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
                      >
                        {noticeLoading === expandedTxId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : noticeSuccess === expandedTxId ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {noticeSuccess === expandedTxId ? 'Sent!' : 'Send Notice'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredTransactions.length === 0 && (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No transactions found</h3>
            <p className="text-slate-500 font-medium mt-1">Try adjusting your search or filters to find what you're looking for.</p>
          </div>
        )}
      </div>
    </div>
  );
}
