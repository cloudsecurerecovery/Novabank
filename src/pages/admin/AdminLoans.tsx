import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Banknote, 
  Search,
  Filter,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  DollarSign,
  Edit3,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { auditService } from '../../services/auditService';
import { useAuthStore } from '../../store/authStore';

interface Loan {
  id: string;
  user_id: string;
  amount: number;
  interest_rate: number;
  term_months: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'paid' | 'defaulted';
  monthly_payment: number;
  remaining_balance: number;
  next_payment_date: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface Repayment {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function AdminLoans() {
  const { user: currentUser } = useAuthStore();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLoanData, setEditLoanData] = useState({
    amount: 0,
    interest_rate: 0,
    term_months: 0,
    status: ''
  });
  const [updatingLoan, setUpdatingLoan] = useState(false);
  const [activeTab, setActiveTab] = useState<'applications' | 'repayments'>('applications');

  useEffect(() => {
    if (activeTab === 'applications') {
      fetchLoans();
    } else {
      fetchRepayments();
    }
  }, [page, activeTab]);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      setLoans(data || []);
    } catch (err) {
      console.error('Error fetching loans:', err);
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('loan_repayments')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      setRepayments(data || []);
    } catch (err) {
      console.error('Error fetching repayments:', err);
      toast.error('Failed to load repayments');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, status: string) => {
    try {
      if (status === 'approved') {
        // 1. Get loan details
        const { data: loan, error: fetchError } = await supabase
          .from('loans')
          .select('*, profiles(balance)')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        if (!loan) throw new Error('Loan not found');

        // 2. Update loan status to 'active' and set remaining balance
        const { error: loanError } = await supabase
          .from('loans')
          .update({ 
            status: 'active',
            remaining_balance: loan.amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (loanError) throw loanError;

        // 3. Create transaction records - This will trigger the balance update via update_profile_balance trigger
        // 3a. Disbursement to checking
        const { error: txError } = await supabase
          .from('transactions')
          .insert([
            {
              user_id: loan.user_id,
              amount: loan.amount,
              description: `Loan Disbursement: ${loan.amount.toLocaleString()} USD`,
              status: 'released',
              type: 'credit',
              balance_type: 'checking'
            },
            // 3b. Record the debt in loan balance
            {
              user_id: loan.user_id,
              amount: loan.amount,
              description: `Loan Debt Recorded: ${loan.amount.toLocaleString()} USD`,
              status: 'released',
              type: 'credit',
              balance_type: 'loan'
            }
          ]);

        if (txError) throw txError;

        if (currentUser) {
          await auditService.log(currentUser.id, 'loan_application_update', {
            loan_id: id,
            new_status: 'active',
            amount: loan.amount,
            action: 'approved_and_disbursed'
          });
        }

        toast.success('Loan approved and funds disbursed');
      } else {
        const { error } = await supabase
          .from('loans')
          .update({ status })
          .eq('id', id);

        if (error) throw error;
        
        if (currentUser) {
          await auditService.log(currentUser.id, 'loan_application_update', {
            loan_id: id,
            new_status: status
          });
        }

        toast.success(`Loan application ${status}`);
      }

      fetchLoans();
      setSelectedLoan(null);
    } catch (err: any) {
      console.error('Error updating loan status:', err);
      toast.error(err.message || 'Failed to update loan status');
    }
  };

  const openEditModal = (loan: Loan) => {
    setSelectedLoan(loan);
    setEditLoanData({
      amount: loan.amount,
      interest_rate: loan.interest_rate,
      term_months: loan.term_months,
      status: loan.status
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateLoan = async () => {
    if (!selectedLoan) return;

    try {
      setUpdatingLoan(true);
      const { error } = await supabase
        .from('loans')
        .update({
          amount: editLoanData.amount,
          interest_rate: editLoanData.interest_rate,
          term_months: editLoanData.term_months,
          status: editLoanData.status
        })
        .eq('id', selectedLoan.id);

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'admin_update_loan', {
          loan_id: selectedLoan.id,
          action: 'edit',
          updates: editLoanData
        });
      }

      toast.success('Loan updated successfully');
      setIsEditModalOpen(false);
      fetchLoans();
    } catch (err) {
      console.error('Error updating loan:', err);
      toast.error('Failed to update loan');
    } finally {
      setUpdatingLoan(false);
    }
  };

  const handleDeleteLoan = async (loanId: string) => {
    if (!window.confirm('Are you sure you want to delete this loan? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loanId);

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'loan_application_update', {
          loan_id: loanId,
          action: 'delete'
        });
      }

      toast.success('Loan deleted successfully');
      fetchLoans();
    } catch (err) {
      console.error('Error deleting loan:', err);
      toast.error('Failed to delete loan');
    }
  };

  const filteredLoans = loans.filter(loan => 
    loan.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  if (loading && loans.length === 0) {
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
          <h1 className="text-3xl font-bold text-slate-900">Loan Management</h1>
          <p className="text-slate-500 font-medium">Review and manage user loan applications and repayments.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all w-full md:w-64"
            />
          </div>
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        <button
          onClick={() => { setActiveTab('applications'); setPage(0); }}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'applications' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Applications
        </button>
        <button
          onClick={() => { setActiveTab('repayments'); setPage(0); }}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'repayments' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Repayments
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'applications' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Term</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs">
                          {loan.profiles?.full_name?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900">{loan.profiles?.full_name}</span>
                          <span className="text-[10px] text-slate-500">{loan.profiles?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">${loan.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 font-medium">{loan.term_months} Months</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(loan.created_at), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {loan.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleAction(loan.id, 'rejected')}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleAction(loan.id, 'approved')}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                              title="Approve"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => openEditModal(loan)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title="Edit Loan"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteLoan(loan.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Delete Loan"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setSelectedLoan(loan)}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {repayments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No repayments found.
                    </td>
                  </tr>
                ) : (
                  repayments.map((repayment) => (
                    <tr key={repayment.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs">
                            {repayment.profiles?.full_name?.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{repayment.profiles?.full_name}</span>
                            <span className="text-[10px] text-slate-500">{repayment.profiles?.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-emerald-600">${repayment.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(repayment.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, (page * pageSize) + (activeTab === 'applications' ? filteredLoans.length : repayments.length))} items
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={filteredLoans.length < pageSize}
              className="p-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Loan Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Edit Loan</h2>
                  <p className="text-slate-500 text-sm font-medium mt-1">Modifying loan for {selectedLoan.profiles.full_name}</p>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</label>
                    <input 
                      type="number"
                      value={editLoanData.amount}
                      onChange={(e) => setEditLoanData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interest Rate (%)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={editLoanData.interest_rate}
                      onChange={(e) => setEditLoanData(prev => ({ ...prev, interest_rate: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Term (Months)</label>
                    <input 
                      type="number"
                      value={editLoanData.term_months}
                      onChange={(e) => setEditLoanData(prev => ({ ...prev, term_months: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                    <select 
                      value={editLoanData.status}
                      onChange={(e) => setEditLoanData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all appearance-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="active">Active</option>
                      <option value="paid">Paid</option>
                      <option value="defaulted">Defaulted</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleUpdateLoan}
                  disabled={updatingLoan}
                  className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingLoan ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Save Loan Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loan Details Modal */}
      <AnimatePresence>
        {selectedLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Loan Details</h2>
                  <p className="text-slate-500 text-sm font-medium mt-1">Reviewing application for {selectedLoan.profiles.full_name}</p>
                </div>
                <button 
                  onClick={() => setSelectedLoan(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Requested</p>
                    <p className="text-xl font-bold text-slate-900">${selectedLoan.amount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Term</p>
                    <p className="text-xl font-bold text-slate-900">{selectedLoan.term_months} Months</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interest Rate</p>
                    <p className="text-xl font-bold text-slate-900">{selectedLoan.interest_rate}% APR</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(selectedLoan.status)}`}>
                      {selectedLoan.status}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{selectedLoan.profiles.full_name}</p>
                      <p className="text-[10px] text-slate-500">{selectedLoan.profiles.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Applied On</p>
                      <p className="text-[10px] text-slate-500">{format(new Date(selectedLoan.created_at), 'MMMM dd, yyyy')}</p>
                    </div>
                  </div>
                </div>

                {selectedLoan.status === 'pending' && (
                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => handleAction(selectedLoan.id, 'rejected')}
                      className="flex-1 py-4 bg-rose-50 text-rose-600 rounded-2xl font-bold hover:bg-rose-100 transition-all"
                    >
                      Reject Application
                    </button>
                    <button 
                      onClick={() => handleAction(selectedLoan.id, 'approved')}
                      className="flex-1 py-4 bg-[#007856] text-white rounded-2xl font-bold hover:bg-[#006045] transition-all shadow-lg shadow-emerald-100"
                    >
                      Approve Application
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
