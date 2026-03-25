import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Wallet, 
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
  Target,
  TrendingUp,
  Edit3,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { auditService } from '../../services/auditService';
import { useAuthStore } from '../../store/authStore';

interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface Contribution {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function AdminSavings() {
  const { user: currentUser } = useAuthStore();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editGoalData, setEditGoalData] = useState({
    name: '',
    target_amount: 0,
    current_amount: 0,
    deadline: ''
  });
  const [updatingGoal, setUpdatingGoal] = useState(false);
  const [activeTab, setActiveTab] = useState<'goals' | 'contributions'>('goals');

  useEffect(() => {
    if (activeTab === 'goals') {
      fetchGoals();
    } else {
      fetchContributions();
    }
  }, [page, activeTab]);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('savings_goals')
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
      setGoals(data || []);
    } catch (err) {
      console.error('Error fetching savings goals:', err);
      toast.error('Failed to load savings goals');
    } finally {
      setLoading(true);
      setTimeout(() => setLoading(false), 500);
    }
  };

  const fetchContributions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('savings_contributions')
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
      setContributions(data || []);
    } catch (err) {
      console.error('Error fetching contributions:', err);
      toast.error('Failed to load contributions');
    } finally {
      setLoading(false);
    }
  };

  const filteredGoals = goals.filter(goal => 
    goal.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    goal.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    goal.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProgress = (current: number, target: number) => {
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const openEditModal = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setEditGoalData({
      name: goal.name,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      deadline: goal.deadline ? goal.deadline.split('T')[0] : ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateGoal = async () => {
    if (!selectedGoal) return;

    try {
      setUpdatingGoal(true);
      const { error } = await supabase
        .from('savings_goals')
        .update({
          name: editGoalData.name,
          target_amount: editGoalData.target_amount,
          current_amount: editGoalData.current_amount,
          deadline: editGoalData.deadline || null
        })
        .eq('id', selectedGoal.id);

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'savings_goal_update', {
          goal_id: selectedGoal.id,
          action: 'edit',
          updates: editGoalData
        });
      }

      toast.success('Savings goal updated successfully');
      setIsEditModalOpen(false);
      fetchGoals();
    } catch (err) {
      console.error('Error updating goal:', err);
      toast.error('Failed to update goal');
    } finally {
      setUpdatingGoal(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!window.confirm('Are you sure you want to delete this savings goal? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('savings_goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;

      if (currentUser) {
        await auditService.log(currentUser.id, 'savings_goal_update', {
          goal_id: goalId,
          action: 'delete'
        });
      }

      toast.success('Savings goal deleted successfully');
      fetchGoals();
    } catch (err) {
      console.error('Error deleting goal:', err);
      toast.error('Failed to delete goal');
    }
  };

  if (loading && goals.length === 0) {
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
          <h1 className="text-3xl font-bold text-slate-900">Savings Management</h1>
          <p className="text-slate-500 font-medium">Monitor and manage user savings goals and contributions.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by user or goal..."
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
          onClick={() => { setActiveTab('goals'); setPage(0); }}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'goals' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Goals
        </button>
        <button
          onClick={() => { setActiveTab('contributions'); setPage(0); }}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'contributions' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Contributions
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'goals' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Goal Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deadline</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredGoals.map((goal) => (
                  <tr key={goal.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs">
                          {goal.profiles?.full_name?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900">{goal.profiles?.full_name}</span>
                          <span className="text-[10px] text-slate-500">{goal.profiles?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{goal.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400">{getProgress(goal.current_amount, goal.target_amount)}%</span>
                          <span className="text-[10px] font-bold text-slate-400">${goal.current_amount.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#007856] rounded-full transition-all duration-500"
                            style={{ width: `${getProgress(goal.current_amount, goal.target_amount)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">${goal.target_amount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Calendar className="w-3 h-3" />
                        {goal.deadline ? format(new Date(goal.deadline), 'MMM dd, yyyy') : 'No Deadline'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(goal)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title="Edit Goal"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Delete Goal"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setSelectedGoal(goal)}
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
                {contributions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No contributions found.
                    </td>
                  </tr>
                ) : (
                  contributions.map((contribution) => (
                    <tr key={contribution.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs">
                            {contribution.profiles?.full_name?.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900">{contribution.profiles?.full_name}</span>
                            <span className="text-[10px] text-slate-500">{contribution.profiles?.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-emerald-600">${contribution.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(contribution.created_at), 'MMM dd, yyyy HH:mm')}
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
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, (page * pageSize) + (activeTab === 'goals' ? filteredGoals.length : contributions.length))} items
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
              disabled={filteredGoals.length < pageSize}
              className="p-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Goal Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Edit Savings Goal</h2>
                  <p className="text-slate-500 text-sm font-medium mt-1">Modifying goal for {selectedGoal.profiles.full_name}</p>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Goal Name</label>
                  <input 
                    type="text"
                    value={editGoalData.name}
                    onChange={(e) => setEditGoalData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Amount</label>
                    <input 
                      type="number"
                      value={editGoalData.target_amount}
                      onChange={(e) => setEditGoalData(prev => ({ ...prev, target_amount: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Amount</label>
                    <input 
                      type="number"
                      value={editGoalData.current_amount}
                      onChange={(e) => setEditGoalData(prev => ({ ...prev, current_amount: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deadline</label>
                  <input 
                    type="date"
                    value={editGoalData.deadline}
                    onChange={(e) => setEditGoalData(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                  />
                </div>

                <button
                  onClick={handleUpdateGoal}
                  disabled={updatingGoal}
                  className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingGoal ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Save Goal Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Goal Details Modal */}
      <AnimatePresence>
        {selectedGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Goal Details</h2>
                  <p className="text-slate-500 text-sm font-medium mt-1">Reviewing savings goal for {selectedGoal.profiles.full_name}</p>
                </div>
                <button 
                  onClick={() => setSelectedGoal(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Goal Name</p>
                    <p className="text-xl font-bold text-slate-900">{selectedGoal.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Amount</p>
                    <p className="text-xl font-bold text-slate-900">${selectedGoal.target_amount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Savings</p>
                    <p className="text-xl font-bold text-emerald-600">${selectedGoal.current_amount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</p>
                    <p className="text-xl font-bold text-blue-600">{getProgress(selectedGoal.current_amount, selectedGoal.target_amount)}%</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{selectedGoal.profiles.full_name}</p>
                      <p className="text-[10px] text-slate-500">{selectedGoal.profiles.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Deadline</p>
                      <p className="text-[10px] text-slate-500">
                        {selectedGoal.deadline ? format(new Date(selectedGoal.deadline), 'MMMM dd, yyyy') : 'No Deadline Set'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setSelectedGoal(null)}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Close Details
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
