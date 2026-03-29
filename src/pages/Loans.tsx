import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { 
  Banknote, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  TrendingUp,
  Calendar,
  DollarSign,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface Loan {
  id: string;
  amount: number;
  interest_rate: number;
  term_months: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'paid' | 'defaulted';
  monthly_payment: number;
  remaining_balance: number;
  next_payment_date: string;
  created_at: string;
}

export default function Loans() {
  const { user } = useAuthStore();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('12');
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  const fetchLoans = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (err) {
      console.error('Error fetching loans:', err);
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyPayment = (principal: number, annualRate: number, months: number) => {
    if (!principal || !months) return 0;
    const monthlyRate = annualRate / 12;
    if (monthlyRate === 0) return principal / months;
    const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    return payment;
  };

  const monthlyPayment = amount ? calculateMonthlyPayment(parseFloat(amount), 0.055, parseInt(term)) : 0;
  const totalRepayment = monthlyPayment * parseInt(term);
  const totalInterest = totalRepayment - (parseFloat(amount) || 0);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // We use direct insert because the RPC doesn't support the due date field yet
      const { data, error } = await supabase
        .from('loans')
        .insert([{
          user_id: user.id,
          amount: parseFloat(amount),
          term_months: parseInt(term),
          status: 'pending',
          remaining_balance: parseFloat(amount),
          next_payment_date: new Date(dueDate).toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Loan application submitted successfully!');
      setIsApplying(false);
      setAmount('');
      setDueDate(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
      fetchLoans();
    } catch (err: any) {
      console.error('Error applying for loan:', err);
      toast.error(err.message || 'Failed to submit loan application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
      case 'paid':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'pending':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'rejected':
      case 'defaulted':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
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
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Loans & Credit</h1>
          <p className="text-slate-500 font-medium">Manage your active loans and apply for new credit lines.</p>
        </div>
        <button 
          onClick={() => setIsApplying(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#007856] text-white rounded-2xl font-bold hover:bg-[#006347] transition-all shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" />
          Apply for Loan
        </button>
      </div>

      {/* Loan Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-[#007856]" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Active Credit</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            ${loans.filter(l => l.status === 'active').reduce((acc, curr) => acc + curr.remaining_balance, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Next Payment</span>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {loans.find(l => l.status === 'active')?.next_payment_date 
              ? format(new Date(loans.find(l => l.status === 'active')!.next_payment_date), 'MMM dd, yyyy')
              : 'No active loans'}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Pending Apps</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {loans.filter(l => l.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* Loan List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Your Loan History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loan Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Monthly</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Remaining</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Payment</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    You have no loan records yet.
                  </td>
                </tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                          <Banknote className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{loan.term_months} Months Term</span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{loan.interest_rate}% Interest Rate</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-slate-900">${loan.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-[#007856]">
                        ${(loan.monthly_payment || calculateMonthlyPayment(loan.amount, loan.interest_rate / 100, loan.term_months)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-slate-900">${loan.remaining_balance.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">
                          {loan.next_payment_date ? format(new Date(loan.next_payment_date), 'MMM dd, yyyy') : '-'}
                        </span>
                        {(loan.status === 'active' || (loan.status === 'pending' && loan.next_payment_date)) && (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {loan.status === 'active' ? 'Next Due Date' : 'Preferred Due Date'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {loan.status === 'active' && (
                        <button 
                          onClick={async () => {
                            try {
                              const amount = prompt('Enter repayment amount:');
                              if (!amount || isNaN(Number(amount))) return;
                              const { error } = await supabase.rpc('repay_loan', {
                                target_loan_id: loan.id,
                                repayment_amount: Number(amount)
                              });
                              if (error) throw error;
                              toast.success('Repayment successful');
                              fetchLoans();
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          }}
                          className="px-4 py-2 bg-emerald-50 text-[#007856] rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"
                        >
                          Repay
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Application Modal */}
      <AnimatePresence>
        {isApplying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50">
                <h2 className="text-2xl font-bold text-slate-900">Loan Application</h2>
                <p className="text-slate-500 text-sm font-medium mt-1">Fill in the details to apply for a new loan.</p>
              </div>

              <form onSubmit={handleApply} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Loan Amount ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="number"
                      required
                      min="500"
                      max="100000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g., 5000"
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Loan Term (Months)</label>
                  <select 
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold appearance-none"
                  >
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                    <option value="24">24 Months</option>
                    <option value="36">36 Months</option>
                    <option value="48">48 Months</option>
                    <option value="60">60 Months</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Preferred First Payment Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="date"
                      required
                      min={format(new Date(), 'yyyy-MM-dd')}
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Interest Rate (APR)</span>
                    <span className="text-[#007856] font-bold bg-emerald-50 px-3 py-1 rounded-full text-xs">5.50%</span>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-slate-200/60">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Monthly Payment</span>
                      <span className="text-slate-900 font-black text-lg">
                        ${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Total Interest</span>
                      <span className="text-slate-600 font-bold">${totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Total Repayment</span>
                      <span className="text-slate-600 font-bold">${totalRepayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsApplying(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-[#007856] text-white rounded-2xl font-bold hover:bg-[#006045] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpRight className="w-5 h-5" />}
                    Submit Application
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
