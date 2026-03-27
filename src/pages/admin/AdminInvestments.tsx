import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  LineChart, 
  Search, 
  Filter, 
  Loader2, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { auditService } from '../../services/auditService';
import { useAuthStore } from '../../store/authStore';

interface Investment {
  id: string;
  user_id: string;
  asset_name: string;
  asset_symbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  asset_type: 'stock' | 'crypto' | 'bond' | 'etf';
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function AdminInvestments() {
  const { user: currentUser } = useAuthStore();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Investment | 'profiles.full_name'; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc'
  });

  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  useEffect(() => {
    fetchInvestments();
  }, []);

  const fetchInvestments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('investments')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvestments(data || []);
    } catch (err) {
      console.error('Error fetching investments:', err);
      toast.error('Failed to load investments');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: any) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleUpdatePrice = async () => {
    if (!selectedSymbol || !newPrice || isNaN(Number(newPrice))) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      setUpdatingPrice(true);
      const { error } = await supabase.rpc('admin_update_investment_price', {
        target_symbol: selectedSymbol,
        new_price: Number(newPrice)
      });

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_investment_price_update', {
          symbol: selectedSymbol,
          new_price: Number(newPrice)
        });
      }

      toast.success(`Price updated for ${selectedSymbol}`);
      setIsPriceModalOpen(false);
      fetchInvestments();
    } catch (err: any) {
      console.error('Error updating price:', err);
      toast.error(err.message || 'Failed to update price');
    } finally {
      setUpdatingPrice(false);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this investment record? This will NOT refund the user.')) return;

    try {
      const { error } = await supabase
        .from('investments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_investment_delete', {
          investment_id: id
        });
      }

      toast.success('Investment record deleted');
      fetchInvestments();
    } catch (err) {
      console.error('Error deleting investment:', err);
      toast.error('Failed to delete investment');
    }
  };

  const filteredInvestments = investments
    .filter(inv => {
      const matchesSearch = 
        inv.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.asset_symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.profiles.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || inv.asset_type === filterType;

      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortConfig.key === 'profiles.full_name') {
        aValue = a.profiles.full_name;
        bValue = b.profiles.full_name;
      } else {
        aValue = a[sortConfig.key as keyof Investment];
        bValue = b[sortConfig.key as keyof Investment];
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const totalValue = investments.reduce((sum, inv) => sum + (inv.quantity * (inv.current_price || inv.average_price)), 0);

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
          <h1 className="text-3xl font-bold text-slate-900">Investment Management</h1>
          <p className="text-slate-500 font-medium">Monitor user portfolios and update asset prices.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-6 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Assets Under Management</p>
            <p className="text-xl font-bold text-[#007856]">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <button 
            onClick={fetchInvestments}
            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by asset, symbol, or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all"
          />
        </div>
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-[#007856]/20 transition-all"
        >
          <option value="all">All Asset Types</option>
          <option value="stock">Stocks</option>
          <option value="crypto">Crypto</option>
          <option value="bond">Bonds</option>
          <option value="etf">ETFs</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('profiles.full_name')}
                >
                  <div className="flex items-center gap-2">
                    User
                    {sortConfig.key === 'profiles.full_name' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('asset_name')}
                >
                  <div className="flex items-center gap-2">
                    Asset
                    {sortConfig.key === 'asset_name' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center gap-2">
                    Quantity
                    {sortConfig.key === 'quantity' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-600 transition-colors"
                  onClick={() => handleSort('current_price')}
                >
                  <div className="flex items-center gap-2">
                    Price
                    {sortConfig.key === 'current_price' ? (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </div>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profit/Loss</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInvestments.map((inv) => {
                const totalCost = inv.quantity * inv.average_price;
                const currentValue = inv.quantity * (inv.current_price || inv.average_price);
                const profitLoss = currentValue - totalCost;
                const profitLossPercentage = (profitLoss / totalCost) * 100;

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{inv.profiles.full_name}</span>
                        <span className="text-[10px] text-slate-500 font-medium">{inv.profiles.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs">
                          {inv.asset_symbol.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{inv.asset_name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{inv.asset_symbol} • {inv.asset_type}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{inv.quantity.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">${(inv.current_price || inv.average_price).toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-medium italic">Avg: ${inv.average_price.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {profitLoss >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-500" />
                        )}
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${profitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {profitLoss >= 0 ? '+' : ''}${Math.abs(profitLoss).toLocaleString()}
                          </span>
                          <span className={`text-[10px] font-bold ${profitLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {profitLoss >= 0 ? '+' : ''}{profitLossPercentage.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedSymbol(inv.asset_symbol);
                            setNewPrice((inv.current_price || inv.average_price).toString());
                            setIsPriceModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-[#007856] hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Update Price"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteInvestment(inv.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Price Modal */}
      <AnimatePresence>
        {isPriceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Update Asset Price</h2>
                  <button 
                    onClick={() => setIsPriceModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 font-bold">
                      {selectedSymbol.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{selectedSymbol}</p>
                      <p className="text-xs text-slate-500 font-medium">Updating market price for all users</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Market Price ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="number"
                        step="0.01"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleUpdatePrice}
                    disabled={updatingPrice}
                    className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingPrice ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Update Global Price
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
