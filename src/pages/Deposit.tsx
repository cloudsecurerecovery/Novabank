import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  Building2,
  ArrowRight,
  Camera,
  FileText,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function Deposit() {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [depositType, setDepositType] = useState<'check' | 'wire'>('check');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [checkFront, setCheckFront] = useState<File | null>(null);
  const [checkBack, setCheckBack] = useState<File | null>(null);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || isSubmitting) return;

    if (depositType === 'check' && (!checkFront || !checkBack)) {
      toast.error('Please upload both sides of the check');
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real app, we would upload the images to storage
      // For this demo, we'll just simulate the transaction
      
      const { error } = await supabase
        .from('transactions')
        .insert([{
          user_id: user.id,
          amount: parseFloat(amount),
          type: 'deposit',
          description: `${depositType === 'check' ? 'Mobile Check Deposit' : 'Wire Transfer Deposit'}`,
          status: 'pending'
        }]);

      if (error) throw error;

      const { auditService } = await import('../services/auditService');
      await auditService.log(user.id, 'deposit', {
        amount: parseFloat(amount),
        type: depositType
      });

      setStep(3);
      toast.success('Deposit request submitted successfully!');
    } catch (err: any) {
      console.error('Error during deposit:', err);
      toast.error(err.message || 'Failed to process deposit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Deposit Funds</h1>
          <p className="text-slate-500 font-medium">Add money to your NovaBank account.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-bold text-[#007856] bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
          <ShieldCheck className="w-4 h-4" />
          FDIC Insured
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-2 bg-slate-50 flex">
          <motion.div 
            initial={{ width: '33.33%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
            className="h-full bg-[#007856] transition-all duration-500"
          />
        </div>

        <div className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900">Select Deposit Method</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setDepositType('check')}
                      className={`p-6 rounded-3xl border-2 transition-all text-left flex flex-col gap-4 ${
                        depositType === 'check' ? 'border-[#007856] bg-emerald-50/50' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${depositType === 'check' ? 'bg-[#007856] text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Mobile Check Deposit</h3>
                        <p className="text-xs text-slate-500 mt-1">Snap a photo of your check to deposit instantly.</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setDepositType('wire')}
                      className={`p-6 rounded-3xl border-2 transition-all text-left flex flex-col gap-4 ${
                        depositType === 'wire' ? 'border-[#007856] bg-emerald-50/50' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${depositType === 'wire' ? 'bg-[#007856] text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Wire Transfer</h3>
                        <p className="text-xs text-slate-500 mt-1">Transfer funds from another bank account.</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Deposit Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                    <input 
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-14 pr-8 py-6 bg-slate-50 border-none rounded-3xl text-2xl font-bold text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="w-full py-5 bg-[#007856] text-white rounded-3xl font-bold hover:bg-[#006045] transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {depositType === 'check' ? (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-900">Upload Check Photos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Front of Check</p>
                        <label className="relative block h-48 rounded-3xl border-2 border-dashed border-slate-200 hover:border-[#007856] transition-all cursor-pointer overflow-hidden group">
                          {checkFront ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-50">
                              <FileText className="w-10 h-10 text-[#007856] mb-2" />
                              <span className="text-xs font-bold text-[#007856]">{checkFront.name}</span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <Camera className="w-8 h-8 text-slate-300 group-hover:text-[#007856] transition-colors" />
                              <span className="text-xs font-bold text-slate-400 mt-2">Click to capture front</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => setCheckFront(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Back of Check</p>
                        <label className="relative block h-48 rounded-3xl border-2 border-dashed border-slate-200 hover:border-[#007856] transition-all cursor-pointer overflow-hidden group">
                          {checkBack ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-50">
                              <FileText className="w-10 h-10 text-[#007856] mb-2" />
                              <span className="text-xs font-bold text-[#007856]">{checkBack.name}</span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <Camera className="w-8 h-8 text-slate-300 group-hover:text-[#007856] transition-colors" />
                              <span className="text-xs font-bold text-slate-400 mt-2">Click to capture back</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => setCheckBack(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-2xl p-4 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Please ensure the check is endorsed on the back with "For Mobile Deposit at NovaBank Only" and your signature.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-900">Wire Transfer Instructions</h2>
                    <div className="bg-slate-50 rounded-3xl p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Name</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">NovaBank N.A.</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Type</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">Checking</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing Number</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">021000021</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Number</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">{user?.id.slice(0, 10).toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="pt-6 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beneficiary Name</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{user?.full_name}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                      Wire transfers typically arrive within 1-2 business days.
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-3xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleDeposit}
                    disabled={isSubmitting}
                    className="flex-[2] py-5 bg-[#007856] text-white rounded-3xl font-bold hover:bg-[#006045] transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Submit Deposit
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-8"
              >
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-12 h-12 text-[#007856]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Deposit Submitted!</h2>
                  <p className="text-slate-500 mt-2">
                    Your deposit of <span className="text-slate-900 font-bold">${parseFloat(amount).toLocaleString()}</span> is being processed.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 text-left space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Method</span>
                    <span className="text-slate-900 font-bold">{depositType === 'check' ? 'Mobile Check' : 'Wire Transfer'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Estimated Availability</span>
                    <span className="text-slate-900 font-bold">1-2 Business Days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Reference Number</span>
                    <span className="text-slate-900 font-mono font-bold">DEP-{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                  </div>
                </div>
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="w-full py-5 bg-slate-900 text-white rounded-3xl font-bold hover:bg-slate-800 transition-all"
                >
                  Return to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm">
            <ShieldCheck className="w-6 h-6 text-[#007856]" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Deposit Limits & Security</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Daily mobile deposit limit: $5,000.00. Monthly limit: $25,000.00. All deposits are subject to verification and may be held for up to 2 business days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
