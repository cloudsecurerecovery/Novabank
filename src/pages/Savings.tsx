import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { 
  PiggyBank, 
  Plus, 
  Target, 
  TrendingUp, 
  Calendar,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  category: string;
  is_completed: boolean;
  created_at: string;
}

export default function Savings() {
  const { user } = useAuthStore();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('Travel');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  const fetchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (err) {
      console.error('Error fetching savings goals:', err);
      toast.error('Failed to load savings goals');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !targetAmount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('savings_goals')
        .insert([{
          user_id: user.id,
          name,
          target_amount: parseFloat(targetAmount),
          deadline: deadline || null,
          category
        }]);

      if (error) throw error;

      toast.success('Savings goal created successfully!');
      setIsAdding(false);
      setName('');
      setTargetAmount('');
      setDeadline('');
      fetchGoals();
    } catch (err: any) {
      console.error('Error adding savings goal:', err);
      toast.error(err.message || 'Failed to create savings goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      const { error } = await supabase
        .from('savings_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setGoals(goals.filter(g => g.id !== id));
      toast.success('Goal deleted');
    } catch (err) {
      console.error('Error deleting goal:', err);
      toast.error('Failed to delete goal');
    }
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min(Math.round((current / target) * 100), 100);
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
          <h1 className="text-3xl font-bold text-slate-900">Savings Goals</h1>
          <p className="text-slate-500 font-medium">Set and track your financial milestones.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#007856] text-white rounded-2xl font-bold hover:bg-[#006347] transition-all shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" />
          Create New Goal
        </button>
      </div>

      {/* Savings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <PiggyBank className="w-6 h-6 text-[#007856]" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Saved</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            ${goals.reduce((acc, curr) => acc + curr.current_amount, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Active Goals</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {goals.filter(g => !g.is_completed).length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Avg. Progress</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {goals.length > 0 
              ? Math.round(goals.reduce((acc, curr) => acc + calculateProgress(curr.current_amount, curr.target_amount), 0) / goals.length)
              : 0}%
          </p>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {goals.map((goal) => (
            <motion.div
              key={goal.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-bold">
                    {goal.category.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{goal.name}</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{goal.category}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Progress</span>
                  <span className="text-slate-900 font-bold">{calculateProgress(goal.current_amount, goal.target_amount)}%</span>
                </div>
                <div className="h-3 bg-slate-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${calculateProgress(goal.current_amount, goal.target_amount)}%` }}
                    className="h-full bg-gradient-to-r from-[#007856] to-emerald-400"
                  />
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                  <span className="text-slate-400">${goal.current_amount.toLocaleString()} saved</span>
                  <span className="text-slate-900">Target: ${goal.target_amount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Calendar className="w-4 h-4" />
                  {goal.deadline ? format(new Date(goal.deadline), 'MMM dd, yyyy') : 'No deadline'}
                </div>
                {goal.is_completed ? (
                  <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </div>
                ) : (
                  <button 
                    onClick={async () => {
                      try {
                        const amount = prompt('Enter contribution amount:');
                        if (!amount || isNaN(Number(amount))) return;
                        const { error } = await supabase.rpc('contribute_to_savings', {
                          target_goal_id: goal.id,
                          contribution_amount: Number(amount)
                        });
                        if (error) throw error;
                        toast.success('Contribution successful');
                        fetchGoals();
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                    className="text-[#007856] font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-1"
                  >
                    Add Funds <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {goals.length === 0 && !isAdding && (
          <div className="md:col-span-2 bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <PiggyBank className="w-10 h-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">No savings goals yet</h2>
            <p className="text-slate-500 mt-2 mb-8">Start saving for your dreams. Create a goal and track your progress.</p>
            <button 
              onClick={() => setIsAdding(true)}
              className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
            >
              Create My First Goal
            </button>
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50">
                <h2 className="text-2xl font-bold text-slate-900">New Savings Goal</h2>
                <p className="text-slate-500 text-sm font-medium mt-1">What are you saving for today?</p>
              </div>

              <form onSubmit={handleAddGoal} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Goal Name</label>
                  <input 
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., New Car, Vacation, Emergency Fund"
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Target Amount ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number"
                        required
                        value={targetAmount}
                        onChange={(e) => setTargetAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Category</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold appearance-none"
                    >
                      <option value="Travel">Travel</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Emergency">Emergency</option>
                      <option value="Education">Education</option>
                      <option value="Home">Home</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Target Date (Optional)</label>
                  <input 
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-[#007856] text-white rounded-2xl font-bold hover:bg-[#006045] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Create Goal
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
