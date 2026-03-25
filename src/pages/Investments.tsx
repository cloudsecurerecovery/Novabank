import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  DollarSign,
  Briefcase,
  LineChart,
  Activity,
  ChevronRight,
  MinusCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface Investment {
  id: string;
  asset_name: string;
  asset_symbol: string;
  quantity: number;
  average_price: number;
  current_price: number;
  asset_type: 'stock' | 'crypto' | 'bond' | 'etf';
}

const Investments: React.FC = () => {
  const { user } = useAuthStore();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [newInvestment, setNewInvestment] = useState({
    asset_name: '',
    asset_symbol: '',
    quantity: '',
    average_price: '',
    asset_type: 'stock'
  });
  const [sellData, setSellData] = useState({
    quantity: '',
    price: ''
  });

  useEffect(() => {
    if (user) {
      fetchInvestments();
    }
  }, [user]);

  const fetchInvestments = async () => {
    try {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvestments(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.rpc('buy_investment', {
        asset_name: newInvestment.asset_name,
        asset_symbol: newInvestment.asset_symbol.toUpperCase(),
        quantity: parseFloat(newInvestment.quantity),
        price: parseFloat(newInvestment.average_price),
        asset_type: newInvestment.asset_type
      });

      if (error) throw error;

      toast.success('Investment purchased successfully');
      setShowBuyModal(false);
      setNewInvestment({
        asset_name: '',
        asset_symbol: '',
        quantity: '',
        average_price: '',
        asset_type: 'stock'
      });
      fetchInvestments();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSellInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedInvestment) return;

    try {
      const { error } = await supabase.rpc('sell_investment', {
        target_investment_id: selectedInvestment.id,
        sell_quantity: parseFloat(sellData.quantity),
        sell_price: parseFloat(sellData.price)
      });

      if (error) throw error;

      toast.success('Investment sold successfully');
      setShowSellModal(false);
      setSelectedInvestment(null);
      setSellData({ quantity: '', price: '' });
      fetchInvestments();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const totalValue = investments.reduce((acc, inv) => acc + (inv.quantity * (inv.current_price || inv.average_price)), 0);
  const totalCost = investments.reduce((acc, inv) => acc + (inv.quantity * inv.average_price), 0);
  const totalGain = totalValue - totalCost;
  const gainPercentage = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Investments</h1>
          <p className="text-gray-400 text-sm">Track and manage your portfolio</p>
        </div>
        <button
          onClick={() => setShowBuyModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#007856] text-white rounded-lg hover:bg-[#006347] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Investment
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#007856]/10 rounded-lg">
                  <Briefcase className="w-5 h-5 text-[#007856]" />
                </div>
                <h2 className="text-lg font-semibold text-white">Portfolio Value</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full">
                <Activity className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">Live Updates</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Balance</p>
                <p className="text-4xl font-bold text-white">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="flex flex-col">
                <p className="text-sm text-gray-400 mb-1">Total Gain/Loss</p>
                <div className={`flex items-center gap-1 font-semibold ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalGain >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span>${Math.abs(totalGain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-sm ml-1">({gainPercentage.toFixed(2)}%)</span>
                </div>
              </div>
            </div>

            <div className="mt-8 h-32 flex items-end gap-2">
              {[40, 60, 45, 70, 55, 80, 65, 90, 75, 100, 85, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[#007856]/20 rounded-t-sm hover:bg-[#007856]/40 transition-colors cursor-pointer group relative"
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white text-black text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ${(totalValue * (h/100)).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assets List */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Your Assets</h3>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <Search className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <PieChart className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading assets...</div>
              ) : investments.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No investments found</div>
              ) : (
                investments.map((inv) => {
                  const value = inv.quantity * (inv.current_price || inv.average_price);
                  const gain = value - (inv.quantity * inv.average_price);
                  const gainPercent = ((inv.current_price || inv.average_price) - inv.average_price) / inv.average_price * 100;

                    return (
                      <div key={inv.id} className="p-4 hover:bg-white/5 transition-colors group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center font-bold text-[#007856]">
                              {inv.asset_symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-white font-semibold">{inv.asset_name}</p>
                              <p className="text-xs text-gray-400 uppercase tracking-wider">{inv.asset_symbol} • {inv.asset_type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-white font-bold">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                              <div className={`flex items-center justify-end gap-1 text-xs font-medium ${gain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {gainPercent.toFixed(2)}%
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedInvestment(inv);
                                setSellData({ quantity: inv.quantity.toString(), price: (inv.current_price || inv.average_price).toString() });
                                setShowSellModal(true);
                              }}
                              className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Sell Asset"
                            >
                              <MinusCircle className="w-5 h-5" />
                            </button>
                            <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
                              <ChevronRight className="w-5 h-5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                })
              )}
            </div>
          </div>
        </div>

        {/* Market Insights & News */}
        <div className="space-y-6">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-[#007856]" />
              Market Insights
            </h3>
            <div className="space-y-4">
              {[
                { label: 'S&P 500', value: '5,241.53', change: '+1.12%', up: true },
                { label: 'Nasdaq', value: '16,384.47', change: '+1.54%', up: true },
                { label: 'Bitcoin', value: '67,241.20', change: '-2.41%', up: false },
                { label: 'Gold', value: '2,184.30', change: '+0.45%', up: true },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">{m.label}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{m.value}</p>
                    <p className={`text-[10px] font-bold ${m.up ? 'text-green-500' : 'text-red-500'}`}>
                      {m.change}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#007856] to-[#005a41] rounded-2xl p-6 text-white">
            <h4 className="font-bold mb-2">Investment Tip</h4>
            <p className="text-sm text-white/80 leading-relaxed">
              Diversifying your portfolio across different asset classes like stocks, bonds, and crypto can help manage risk while seeking returns.
            </p>
            <button className="mt-4 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
              Learn More <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sell Investment Modal */}
      {showSellModal && selectedInvestment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Sell {selectedInvestment.asset_symbol}</h2>
              <button onClick={() => setShowSellModal(false)} className="text-gray-400 hover:text-white">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSellInvestment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Quantity to Sell (Max: {selectedInvestment.quantity})</label>
                <input
                  type="number"
                  required
                  max={selectedInvestment.quantity}
                  step="0.000001"
                  value={sellData.quantity}
                  onChange={(e) => setSellData({ ...sellData, quantity: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#007856]"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Selling Price per Unit</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={sellData.price}
                    onChange={(e) => setSellData({ ...sellData, price: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-[#007856]"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Total Proceeds</span>
                  <span className="text-green-500 font-bold">
                    ${(parseFloat(sellData.quantity || '0') * parseFloat(sellData.price || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">Funds will be credited to your main account balance.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSellModal(false)}
                  className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                >
                  Confirm Sale
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Buy Investment Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Investment</h2>
              <button onClick={() => setShowBuyModal(false)} className="text-gray-400 hover:text-white">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleBuyInvestment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Asset Name</label>
                <input
                  type="text"
                  required
                  value={newInvestment.asset_name}
                  onChange={(e) => setNewInvestment({ ...newInvestment, asset_name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#007856]"
                  placeholder="e.g. Apple Inc."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Symbol</label>
                  <input
                    type="text"
                    required
                    value={newInvestment.asset_symbol}
                    onChange={(e) => setNewInvestment({ ...newInvestment, asset_symbol: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#007856]"
                    placeholder="AAPL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                  <select
                    value={newInvestment.asset_type}
                    onChange={(e) => setNewInvestment({ ...newInvestment, asset_type: e.target.value as any })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#007856]"
                  >
                    <option value="stock">Stock</option>
                    <option value="crypto">Crypto</option>
                    <option value="etf">ETF</option>
                    <option value="bond">Bond</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    step="0.000001"
                    value={newInvestment.quantity}
                    onChange={(e) => setNewInvestment({ ...newInvestment, quantity: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#007856]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Price per Unit</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={newInvestment.average_price}
                      onChange={(e) => setNewInvestment({ ...newInvestment, average_price: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-[#007856]"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Total Investment</span>
                  <span className="text-white font-bold">
                    ${(parseFloat(newInvestment.quantity || '0') * parseFloat(newInvestment.average_price || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">Funds will be deducted from your main account balance.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBuyModal(false)}
                  className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#007856] text-white rounded-lg hover:bg-[#006347] transition-colors"
                >
                  Confirm Purchase
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Investments;
