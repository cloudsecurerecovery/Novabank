import { useState, useEffect, Fragment } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../supabaseClient';
import { format } from 'date-fns';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Search, 
  Filter, 
  Download,
  Calendar,
  FileText,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  id: string;
  amount: number;
  status: 'pending' | 'hold' | 'released' | 'reversible';
  description: string;
  created_at: string;
  user_documents?: {
    id: string;
    file_path: string;
    file_name: string;
  }[];
}

export default function Transactions() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [checkImages, setCheckImages] = useState<Record<string, string>>({});
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const toggleExpand = (txId: string) => {
    setExpandedTxId(expandedTxId === txId ? null : txId);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            user_documents:user_documents(id, file_path, file_name)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) {
          setTransactions(data);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user]);

  useEffect(() => {
    const loadCheckImages = async () => {
      if (!expandedTxId) return;
      const tx = transactions.find(t => t.id === expandedTxId);
      if (!tx?.user_documents?.length) return;

      const { storageService } = await import('../services/storageService');
      const urls: Record<string, string> = {};
      
      for (const doc of tx.user_documents) {
        if (checkImages[doc.id]) continue;
        try {
          const url = await storageService.getSignedUrl(doc.file_path);
          urls[doc.id] = url;
        } catch (e) {
          console.error('Failed to get signed URL', e);
        }
      }
      if (Object.keys(urls).length > 0) {
        setCheckImages(prev => ({ ...prev, ...urls }));
      }
    };

    loadCheckImages();
  }, [expandedTxId, transactions]);

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

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(tx.status);
    return matchesSearch && matchesStatus;
  });

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007856]"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transaction History</h1>
          <p className="text-sm text-slate-500 mt-1">View and manage all your account activity.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
          <Download className="w-4 h-4" />
          Export Statement
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by description or reference ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 mr-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filter Status:</span>
          </div>
          {['pending', 'hold', 'released', 'reversible'].map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                selectedStatuses.includes(status)
                  ? 'bg-[#007856] text-white border-[#007856] shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
          {selectedStatuses.length > 0 && (
            <button 
              onClick={() => setSelectedStatuses([])}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 ml-2"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-20 text-center">
            <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No transactions found</h3>
            <p className="text-slate-500 font-medium mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/50">
                  <th scope="col" className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction</th>
                  <th scope="col" className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th scope="col" className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th scope="col" className="relative px-8 py-4"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredTransactions.map((tx) => (
                  <Fragment key={tx.id}>
                    <tr className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-8 py-5">
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
                            <div className="text-sm font-bold text-slate-900 truncate max-w-[200px] md:max-w-xs">{tx.description}</div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.created_at), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className={`px-8 py-5 whitespace-nowrap text-sm font-bold text-right ${
                        Number(tx.amount) >= 0 ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {Number(tx.amount) >= 0 ? '+' : ''}${Math.abs(Number(tx.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => toggleExpand(tx.id)}
                          className={`p-2 rounded-xl transition-all ${expandedTxId === tx.id ? 'bg-[#007856] text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                          {expandedTxId === tx.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                              <div className="px-8 py-6 border-t border-slate-100">
                                <div className="flex flex-col space-y-6">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-2 text-slate-400">
                                        <Info className="w-4 h-4" />
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest">Details</h4>
                                      </div>
                                      <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                                        <div>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference ID</p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <p className="text-xs font-mono text-slate-600 break-all">{tx.id}</p>
                                            <button 
                                              onClick={() => copyToClipboard(tx.id, tx.id)}
                                              className="text-[10px] font-bold text-[#007856] hover:underline"
                                            >
                                              {copySuccess === tx.id ? 'Copied!' : 'Copy'}
                                            </button>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Timestamp</p>
                                          <p className="text-xs font-medium text-slate-600 mt-1">
                                            {format(new Date(tx.created_at), 'MMMM d, yyyy h:mm:ss a')}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-4 md:col-span-2">
                                      <div className="flex items-center gap-2 text-slate-400">
                                        <FileText className="w-4 h-4" />
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest">Description & Attachments</h4>
                                      </div>
                                      <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4">
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                          {tx.description}
                                        </p>
                                        
                                        {tx.user_documents && tx.user_documents.length > 0 && (
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-50">
                                            {tx.user_documents.map(doc => (
                                              <div key={doc.id} className="space-y-1">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{doc.file_name}</p>
                                                {checkImages[doc.id] ? (
                                                  <a href={checkImages[doc.id]} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg border border-slate-100">
                                                    <img 
                                                      src={checkImages[doc.id]} 
                                                      alt={doc.file_name} 
                                                      className="w-full h-20 object-cover transition-transform group-hover:scale-110"
                                                      referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                      <Download className="w-4 h-4 text-white" />
                                                    </div>
                                                  </a>
                                                ) : (
                                                  <div className="w-full h-20 bg-slate-100 rounded-lg animate-pulse" />
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex justify-end gap-3 pt-2">
                                    <button className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all">
                                      Download Receipt
                                    </button>
                                    <button className="px-6 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all">
                                      Report Issue
                                    </button>
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
    </motion.div>
  );
}
