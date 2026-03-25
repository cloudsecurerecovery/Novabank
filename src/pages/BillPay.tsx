import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Receipt, 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ArrowRight,
  Building2,
  DollarSign,
  Trash2,
  CreditCard,
  X,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface Bill {
  id: string;
  biller_name: string;
  account_number: string;
  amount: number;
  status: 'pending' | 'scheduled' | 'completed' | 'failed';
  scheduled_date: string;
  created_at: string;
  is_recurring?: boolean;
  frequency?: 'weekly' | 'monthly' | 'yearly';
  duration?: number;
  remaining_payments?: number;
}

const BillPay: React.FC = () => {
  const { user } = useAuthStore();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBill, setNewBill] = useState({
    biller_name: '',
    account_number: '',
    amount: '',
    scheduled_date: new Date(),
    is_recurring: false,
    frequency: 'monthly' as 'weekly' | 'monthly' | 'yearly',
    duration: 12
  });

  useEffect(() => {
    if (user) {
      fetchBills();
    }
  }, [user]);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('bill_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('bill_payments')
        .insert([{
          user_id: user.id,
          biller_name: newBill.biller_name,
          account_number: newBill.account_number,
          amount: parseFloat(newBill.amount),
          scheduled_date: new Date(newBill.scheduled_date).toISOString(),
          status: 'scheduled',
          is_recurring: newBill.is_recurring,
          frequency: newBill.is_recurring ? newBill.frequency : null,
          duration: newBill.is_recurring ? newBill.duration : null,
          remaining_payments: newBill.is_recurring ? newBill.duration : null
        }]);

      if (error) throw error;

      toast.success('Bill scheduled successfully');
      setShowAddModal(false);
      setNewBill({
        biller_name: '',
        account_number: '',
        amount: '',
        scheduled_date: new Date(),
        is_recurring: false,
        frequency: 'monthly',
        duration: 12
      });
      fetchBills();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePayBill = async (billId: string) => {
    try {
      const { error } = await supabase.rpc('pay_bill', { target_bill_id: billId });
      if (error) throw error;
      toast.success('Bill paid successfully');
      fetchBills();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCancelBill = async (billId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled payment?')) return;
    try {
      const { error } = await supabase
        .from('bill_payments')
        .delete()
        .eq('id', billId);
      if (error) throw error;
      toast.success('Bill payment cancelled');
      fetchBills();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed': 
        return {
          label: 'Completed',
          classes: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
          icon: CheckCircle2
        };
      case 'scheduled': 
        return {
          label: 'Scheduled',
          classes: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
          icon: Clock
        };
      case 'pending': 
        return {
          label: 'Pending',
          classes: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
          icon: AlertCircle
        };
      case 'failed': 
        return {
          label: 'Failed',
          classes: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
          icon: AlertTriangle
        };
      default: 
        return {
          label: status,
          classes: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
          icon: AlertCircle
        };
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Bill Pay</h1>
          <p className="text-gray-400 text-sm">Manage and schedule your utility payments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#007856] text-white rounded-lg hover:bg-[#006347] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New Bill
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Cards */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Scheduled</p>
                <p className="text-xl font-bold text-white">
                  {bills.filter(b => b.status === 'scheduled').length} Bills
                </p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Paid This Month</p>
                <p className="text-xl font-bold text-white">
                  ${bills.filter(b => b.status === 'completed').reduce((acc, b) => acc + b.amount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Pending Actions</p>
                <p className="text-xl font-bold text-white">
                  {bills.filter(b => b.status === 'pending').length} Action Required
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Bills */}
        <div className="lg:col-span-3">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Upcoming Bills</h2>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full border border-blue-500/20">
                {bills.filter(b => ['scheduled', 'pending'].includes(b.status)).length} Total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Biller</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Account Number</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Due Date</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading bills...</td>
                    </tr>
                  ) : bills.filter(b => ['scheduled', 'pending'].includes(b.status)).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No upcoming bills</td>
                    </tr>
                  ) : (
                    bills.filter(b => ['scheduled', 'pending'].includes(b.status)).map((bill) => (
                      <tr key={bill.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg">
                              <Building2 className="w-4 h-4 text-gray-400" />
                            </div>
                            <span className="text-white font-medium">{bill.biller_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400 font-mono text-sm">
                          {bill.account_number}
                        </td>
                        <td className="px-6 py-4 text-white font-semibold">
                          ${bill.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {format(new Date(bill.scheduled_date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const info = getStatusInfo(bill.status);
                            const Icon = info.icon;
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${info.classes}`}>
                                <Icon className="w-3 h-3" />
                                {info.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {bill.status === 'scheduled' && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handlePayBill(bill.id)}
                                className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                title="Pay Now"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCancelBill(bill.id)}
                                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Past Payments */}
        <div className="lg:col-span-3">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Past Payments</h2>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                {bills.filter(b => ['completed', 'failed'].includes(b.status)).length} History
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Biller</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Account Number</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Payment Date</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading history...</td>
                    </tr>
                  ) : bills.filter(b => ['completed', 'failed'].includes(b.status)).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No payment history</td>
                    </tr>
                  ) : (
                    bills.filter(b => ['completed', 'failed'].includes(b.status)).map((bill) => (
                      <tr key={bill.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg">
                              <Building2 className="w-4 h-4 text-gray-400" />
                            </div>
                            <span className="text-white font-medium">{bill.biller_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400 font-mono text-sm">
                          {bill.account_number}
                        </td>
                        <td className="px-6 py-4 text-white font-semibold">
                          ${bill.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {format(new Date(bill.scheduled_date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const info = getStatusInfo(bill.status);
                            const Icon = info.icon;
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${info.classes}`}>
                                <Icon className="w-3 h-3" />
                                {info.label}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add Bill Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white">Schedule Bill</h2>
                  <p className="text-gray-400 text-sm mt-1">Set up a new utility payment</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)} 
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddBill} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Biller Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      required
                      value={newBill.biller_name}
                      onChange={(e) => setNewBill({ ...newBill, biller_name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-[#007856] focus:ring-1 focus:ring-[#007856] transition-all"
                      placeholder="e.g. Electric Company"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account Number</label>
                  <div className="relative">
                    <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      required
                      value={newBill.account_number}
                      onChange={(e) => setNewBill({ ...newBill, account_number: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-[#007856] focus:ring-1 focus:ring-[#007856] transition-all font-mono"
                      placeholder="e.g. 123456789"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={newBill.amount}
                        onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-[#007856] focus:ring-1 focus:ring-[#007856] transition-all font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Due Date</label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 z-10 pointer-events-none" />
                      <DatePicker
                        selected={newBill.scheduled_date}
                        onChange={(date: Date) => setNewBill({ ...newBill, scheduled_date: date })}
                        minDate={new Date()}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-[#007856] focus:ring-1 focus:ring-[#007856] transition-all"
                        dateFormat="MMM dd, yyyy"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Recurring Payment</p>
                      <p className="text-xs text-gray-400 font-medium">Automatically schedule future payments.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewBill(prev => ({ ...prev, is_recurring: !prev.is_recurring }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        newBill.is_recurring ? 'bg-[#007856]' : 'bg-white/10'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        newBill.is_recurring ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {newBill.is_recurring && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-4 border-t border-white/10"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Frequency</label>
                          <select 
                            value={newBill.frequency}
                            onChange={(e) => setNewBill(prev => ({ ...prev, frequency: e.target.value as any }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#007856]"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Duration (Payments)</label>
                          <input 
                            type="number"
                            min="1"
                            max="60"
                            value={newBill.duration}
                            onChange={(e) => setNewBill(prev => ({ ...prev, duration: Number(e.target.value) }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#007856]"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-6 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006347] transition-all shadow-lg shadow-emerald-900/20"
                  >
                    Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BillPay;
