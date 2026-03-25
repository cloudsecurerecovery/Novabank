import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../supabaseClient';
import { ArrowRight, CheckCircle2, AlertCircle, Building2, User, DollarSign, Text, ShieldCheck, History, Search, ArrowLeft, Loader2, Mail, Upload, Globe, Plus, Bell, Send, XCircle } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { auditService } from '../services/auditService';
import { notificationService } from '../services/notificationService';
import { storageService } from '../services/storageService';
import { validateEmail, validateAmount, validateRoutingNumber, validateAccountNumber } from '../utils/validation';

interface RecentRecipient {
  id: string;
  email: string;
  full_name: string;
}

type Step = 'details' | 'confirm' | 'otp' | 'success';
type TransferType = 'standard' | 'deposit' | 'wire';

export default function Transfer() {
  const { user, updateUser, isOtpVerified, setOtpVerified } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine initial type from URL or default to standard
  const getInitialType = (): TransferType => {
    if (location.pathname === '/deposit') return 'deposit';
    if (location.pathname === '/wire-transfer') return 'wire';
    return 'standard';
  };

  const [transferType, setTransferType] = useState<TransferType>(getInitialType());
  const [step, setStep] = useState<Step>('details');

  // Sync transferType with URL changes
  useEffect(() => {
    setTransferType(getInitialType());
    setStep('details'); // Reset to details step when switching types via URL
  }, [location.pathname]);

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(user?.balance || 0);

  // Standard Transfer State
  const [receiverEmail, setReceiverEmail] = useState('');
  const [description, setDescription] = useState('');
  const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [saveBeneficiary, setSaveBeneficiary] = useState(false);
  const [beneficiaryNickname, setBeneficiaryNickname] = useState('');

  // Deposit State
  const [depositMethod, setDepositMethod] = useState<'check' | 'ach'>('check');
  const [checkFront, setCheckFront] = useState<File | null>(null);
  const [checkBack, setCheckBack] = useState<File | null>(null);

  // Wire State
  const [wireType, setWireType] = useState<'domestic' | 'international'>('domestic');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [purpose, setPurpose] = useState('');
  const [beneficiaryAddress, setBeneficiaryAddress] = useState('');
  const [bankAddress, setBankAddress] = useState('');

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    
    // Fetch directly from profiles table for the most accurate balance
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (!profileError && profileData) {
      setBalance(profileData.balance || 0);
      updateUser({ balance: profileData.balance || 0 });
      return;
    }

    // Fallback to transaction calculation if profile balance fails
    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('status', 'released');
      
    if (!error && data) {
      const calcBalance = data.reduce((sum, tx) => sum + Number(tx.amount), 0);
      setBalance(calcBalance);
      updateUser({ balance: calcBalance });
    }
  }, [user, updateUser]);

  const fetchRecentRecipients = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('description')
        .eq('user_id', user.id)
        .ilike('description', 'Transfer to %')
        .limit(20);

      if (error) throw error;

      if (data) {
        const emails = data
          .map(tx => {
            const match = tx.description.match(/Transfer to ([^ ]+)/);
            return match ? match[1] : null;
          })
          .filter((email): email is string => !!email);

        const uniqueEmails = Array.from(new Set(emails)).slice(0, 5);

        if (uniqueEmails.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .in('email', uniqueEmails);

          if (!profilesError && profiles) {
            setRecentRecipients(profiles);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching recent recipients:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchBalance();
    fetchRecentRecipients();
  }, [fetchBalance, fetchRecentRecipients]);

  const validateStep = async () => {
    setError('');
    
    if (!validateAmount(amount)) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (user?.account_status && user.account_status !== 'active') {
      setError(`Your account is currently ${user.account_status.replace('_', ' ')}. Transfers are restricted.`);
      return;
    }

    if (transferType === 'standard') {
      if (!validateEmail(receiverEmail)) {
        setError('Please enter a valid recipient email address.');
        return;
      }
      
      setLoading(true);
      try {
        const { data, error: recipientError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('email', receiverEmail.toLowerCase())
          .single();

        if (recipientError || !data) {
          throw new Error('Recipient not found. Please check the email address.');
        }

        if (data.id === user?.id) {
          throw new Error('You cannot transfer money to yourself.');
        }

        if (parseFloat(amount) > balance) {
          throw new Error('Insufficient balance for this transfer.');
        }

        // Check daily limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: todayTxs, error: limitError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', user?.id)
          .gte('created_at', today.toISOString())
          .lt('amount', 0); // Only outgoing

        if (!limitError && todayTxs) {
          const dailyTotal = Math.abs(todayTxs.reduce((sum, tx) => sum + Number(tx.amount), 0));
          const limit = user?.daily_limit || 5000;
          if (dailyTotal + parseFloat(amount) > limit) {
            throw new Error(`Daily transfer limit exceeded. Remaining: $${(limit - dailyTotal).toLocaleString()}`);
          }
        }

        setRecipientName(data.full_name);
        setStep('confirm');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else if (transferType === 'deposit') {
      if (depositMethod === 'check' && (!checkFront || !checkBack)) {
        setError('Please upload both front and back images of the check.');
        return;
      }
      setStep('confirm');
    } else if (transferType === 'wire') {
      if (!beneficiaryName || !accountNumber || !routingNumber || !bankName) {
        setError('Please fill in all required beneficiary and bank details.');
        return;
      }
      if (!validateRoutingNumber(routingNumber)) {
        setError('Routing number must be exactly 9 digits.');
        return;
      }
      if (!validateAccountNumber(accountNumber)) {
        setError('Account number must be between 8 and 17 digits.');
        return;
      }
      if (wireType === 'international' && !swiftCode) {
        setError('SWIFT/BIC code is required for international wires.');
        return;
      }
      if (parseFloat(amount) > balance) {
        setError('Insufficient balance for this wire transfer.');
        return;
      }
      setStep('confirm');
    }
  };

  const handleProcess = async () => {
    setError('');
    
    // Check for large transfer and require Portal Code if not already verified for this action
    if (parseFloat(amount) > 1000 && step !== 'otp' && !isOtpVerified) {
      setStep('otp');
      toast.success('Please enter your Portal Code to authorize this large transfer');
      return;
    }

    setLoading(true);

    const txAmount = parseFloat(amount);
    const wireFee = (transferType === 'wire' && wireType === 'international') ? 25 : 0;
    const totalAmount = txAmount + wireFee;

    try {
      if (transferType === 'standard') {
        if (!validateEmail(receiverEmail)) throw new Error('Please enter a valid email address.');
        if (!validateAmount(amount)) throw new Error('Please enter a valid amount.');
        if (txAmount > balance) throw new Error('Insufficient funds.');

        const { data: receiverData, error: receiverError } = await supabase
          .from('profiles')
          .select('id, balance')
          .eq('email', receiverEmail.toLowerCase())
          .single();

        if (receiverError || !receiverData) throw new Error('Recipient not found.');

        const { error: txError } = await supabase.rpc('transfer_funds', {
          sender_id: user?.id,
          receiver_id: receiverData.id,
          transfer_amount: txAmount,
          sender_description: `Transfer to ${receiverEmail} - ${description || 'Funds Transfer'}`,
          receiver_description: `Transfer from ${user?.email} - ${description || 'Funds Transfer'}`
        });

        if (txError) throw txError;

        if (saveBeneficiary) {
          await supabase.rpc('add_beneficiary', {
            target_beneficiary_id: receiverData.id,
            target_nickname: beneficiaryNickname || recipientName
          });
        }

        await auditService.log(user?.id!, 'transfer_sent', { amount: txAmount, to: receiverEmail });
        await auditService.log(receiverData.id, 'transfer_received', { amount: txAmount, from: user?.email });
        await notificationService.notify(user?.id!, 'transfer_sent', `Sent ${txAmount.toLocaleString()} to ${receiverEmail}`);
        await notificationService.notify(receiverData.id, 'transfer_received', `Received ${txAmount.toLocaleString()} from ${user?.email}`);
      } 
      else if (transferType === 'deposit') {
        if (!validateAmount(amount)) throw new Error('Please enter a valid amount.');
        if (depositMethod === 'check' && (!checkFront || !checkBack)) {
          throw new Error('Please upload both the front and back of the check.');
        }

        let frontPath = '';
        let backPath = '';

        const { data: txData, error: txError } = await supabase.from('transactions').insert({
          user_id: user?.id,
          amount: txAmount,
          status: 'pending',
          description: `Mobile Deposit - ${depositMethod === 'check' ? 'Check' : 'ACH'}`,
          created_at: new Date().toISOString()
        }).select().single();

        if (txError) throw txError;

        if (depositMethod === 'check' && checkFront && checkBack && txData) {
          const txId = txData.id;
          frontPath = await storageService.uploadFile(user?.id!, 'deposits', txId, checkFront);
          backPath = await storageService.uploadFile(user?.id!, 'deposits', txId, checkBack);

          // Store document metadata linked to transaction
          await supabase.from('user_documents').insert([
            { user_id: user?.id, transaction_id: txId, file_name: 'Check Front', file_path: frontPath, file_type: 'check_deposit' },
            { user_id: user?.id, transaction_id: txId, file_name: 'Check Back', file_path: backPath, file_type: 'check_deposit' }
          ]);
        }

        await auditService.log(user?.id!, 'deposit', { amount: txAmount, method: depositMethod, frontPath, backPath, transaction_id: txData?.id });
        await notificationService.notify(user?.id!, 'deposit', `Deposit of ${txAmount.toLocaleString()} is pending review.`);
      }
      else if (transferType === 'wire') {
        if (!validateAmount(amount)) throw new Error('Please enter a valid amount.');
        if (!beneficiaryName) throw new Error('Please enter the beneficiary name.');
        if (!validateAccountNumber(accountNumber)) throw new Error('Please enter a valid account number.');
        if (wireType === 'domestic' && !validateRoutingNumber(routingNumber)) throw new Error('Please enter a valid routing number.');
        if (wireType === 'international' && !swiftCode) throw new Error('Please enter a SWIFT/BIC code.');
        if (totalAmount > balance) throw new Error('Insufficient funds (including fees).');

        const { data: txData, error: txError } = await supabase.from('transactions').insert({
          user_id: user?.id,
          amount: -totalAmount,
          status: 'pending',
          description: `Wire Transfer (${wireType}) to ${beneficiaryName}${wireFee > 0 ? ' (Includes $25.00 fee)' : ''}`,
          created_at: new Date().toISOString()
        }).select().single();

        if (txError) throw txError;

        if (txData) {
          const { error: wireDetailsError } = await supabase.from('wire_transfer_details').insert({
            transaction_id: txData.id,
            bank_name: bankName,
            swift_bic: swiftCode || 'N/A',
            account_number: accountNumber,
            routing_number: routingNumber,
            recipient_address: beneficiaryAddress,
            bank_address: bankAddress,
            wire_type: wireType
          });

          if (wireDetailsError) console.error('Error saving wire details:', wireDetailsError);
        }

        await auditService.log(user?.id!, 'wire_transfer', { amount: totalAmount, to: beneficiaryName, type: wireType, fee: wireFee });
        await notificationService.notify(user?.id!, 'wire_transfer', `Wire transfer of ${totalAmount.toLocaleString()} to ${beneficiaryName} initiated.`);
      }

      if (txAmount > 1000) {
        await notificationService.notify(user?.id!, 'large_transaction', `A large transaction of $${txAmount.toLocaleString()} was processed.`);
      }

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'An error occurred during processing.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Please enter your 6-digit Portal Code.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');

    try {
      // Fetch the portal code from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('otp_code')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.otp_code === otp) {
        // Portal Code verified, proceed with the transfer
        setOtpVerified(true);
        await handleProcess();
      } else {
        setOtpError('Invalid Portal Code. Please try again.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Failed to verify Portal Code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const selectRecipient = (recipient: RecentRecipient) => {
    setReceiverEmail(recipient.email);
    setRecipientName(recipient.full_name);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Transfer Funds</h1>
        <p className="text-slate-500 mt-2 font-medium">Move money securely with NovaBank's advanced payment options.</p>
      </div>

      {error && step !== 'details' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3"
        >
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </motion.div>
      )}

      {step === 'details' && (
        <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
          <button
            onClick={() => setTransferType('standard')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              transferType === 'standard' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Send className="w-4 h-4" />
            Send Money
          </button>
          <button
            onClick={() => setTransferType('deposit')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              transferType === 'deposit' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            Deposit
          </button>
          <button
            onClick={() => setTransferType('wire')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              transferType === 'wire' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            Wire Transfer
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Balance Summary */}
            <div className="bg-gradient-to-br from-[#007856] to-[#006045] rounded-3xl p-6 text-white shadow-lg shadow-emerald-100">
              <div className="flex items-center gap-3 opacity-80">
                <Building2 className="w-5 h-5" />
                <span className="text-sm font-bold uppercase tracking-wider">Primary Checking</span>
              </div>
              <div className="mt-4">
                <p className="text-4xl font-bold">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p className="text-white/60 text-xs mt-1 font-medium uppercase tracking-widest">Available Balance</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-8">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3"
                  >
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </motion.div>
                )}

                <div className="space-y-8">
                  {transferType === 'standard' && (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Recipient Email</label>
                          <div className="flex items-center gap-1.5 text-[#007856]">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Verified Secure</span>
                          </div>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-slate-400" />
                          </div>
                          <input
                            type="email"
                            value={receiverEmail}
                            onChange={(e) => setReceiverEmail(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all placeholder:text-slate-400 font-medium"
                            placeholder="recipient@novabank.com"
                          />
                        </div>

                        {recentRecipients.length > 0 && (
                          <div className="pt-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <History className="w-3 h-3" /> Recent Recipients
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {recentRecipients.map((recipient) => (
                                <button
                                  key={recipient.id}
                                  onClick={() => selectRecipient(recipient)}
                                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                                    receiverEmail === recipient.email 
                                      ? 'bg-emerald-50 border-[#007856] text-[#007856]' 
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-[#007856] hover:text-[#007856]'
                                  }`}
                                >
                                  {recipient.full_name.split(' ')[0]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-4 flex items-center gap-3">
                          <label className="relative flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={saveBeneficiary}
                              onChange={(e) => setSaveBeneficiary(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007856]"></div>
                            <span className="ml-3 text-sm font-bold text-slate-600">Save as Beneficiary</span>
                          </label>
                        </div>

                        {saveBeneficiary && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="pt-2"
                          >
                            <input
                              type="text"
                              value={beneficiaryNickname}
                              onChange={(e) => setBeneficiaryNickname(e.target.value)}
                              className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20"
                              placeholder="Nickname (e.g. Mom, Rent)"
                            />
                          </motion.div>
                        )}
                      </div>
                    </>
                  )}

                  {transferType === 'deposit' && (
                    <div className="space-y-6">
                      <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                          onClick={() => setDepositMethod('check')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            depositMethod === 'check' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          Mobile Check
                        </button>
                        <button
                          onClick={() => setDepositMethod('ach')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            depositMethod === 'ach' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          ACH Transfer
                        </button>
                      </div>

                      {depositMethod === 'check' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Front of Check</label>
                            <div className="relative group">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setCheckFront(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className={`aspect-[3/2] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                                checkFront ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                              }`}>
                                {checkFront ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Upload className="w-6 h-6 text-slate-300" />}
                                <span className="text-[10px] font-bold text-slate-400 mt-2">{checkFront ? 'Uploaded' : 'Upload Front'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Back of Check</label>
                            <div className="relative group">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setCheckBack(e.target.files?.[0] || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div className={`aspect-[3/2] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                                checkBack ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                              }`}>
                                {checkBack ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Upload className="w-6 h-6 text-slate-300" />}
                                <span className="text-[10px] font-bold text-slate-400 mt-2">{checkBack ? 'Uploaded' : 'Upload Back'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                          <div className="flex items-center gap-2 text-[#007856]">
                            <Building2 className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">ACH Instructions</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing</p>
                              <p className="text-sm font-bold text-slate-900">021000021</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account</p>
                              <p className="text-sm font-bold text-slate-900">8829304122</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {transferType === 'wire' && (
                    <div className="space-y-6">
                      <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                          onClick={() => setWireType('domestic')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            wireType === 'domestic' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          Domestic
                        </button>
                        <button
                          onClick={() => setWireType('international')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            wireType === 'international' ? 'bg-white text-[#007856] shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          International
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beneficiary Name</label>
                          <input
                            type="text"
                            value={beneficiaryName}
                            onChange={(e) => setBeneficiaryName(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20"
                            placeholder="Full Legal Name"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Number / IBAN</label>
                          <input
                            type="text"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20"
                            placeholder="Account Number"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing / Sort Code</label>
                          <input
                            type="text"
                            value={routingNumber}
                            onChange={(e) => setRoutingNumber(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20"
                            placeholder="Routing Number"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Name</label>
                          <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20"
                            placeholder="Bank Name"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beneficiary Address</label>
                          <input
                            type="text"
                            value={beneficiaryAddress}
                            onChange={(e) => setBeneficiaryAddress(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20"
                            placeholder="Street, City, Country"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Address</label>
                          <input
                            type="text"
                            value={bankAddress}
                            onChange={(e) => setBankAddress(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20"
                            placeholder="Bank Branch Address"
                          />
                        </div>
                        {wireType === 'international' && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SWIFT / BIC Code</label>
                            <input
                              type="text"
                              value={swiftCode}
                              onChange={(e) => setSwiftCode(e.target.value)}
                              className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20"
                              placeholder="SWIFT Code"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Amount & Memo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Amount</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-slate-400 font-bold">$</span>
                        </div>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-12 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all placeholder:text-slate-400 font-bold text-xl"
                          placeholder="0.00"
                        />
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <span className="text-slate-400 text-xs font-bold">USD</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Memo (Optional)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Text className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all placeholder:text-slate-400 font-medium"
                          placeholder="What is this for?"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={validateStep}
                      disabled={loading || !amount || (transferType === 'standard' && !receiverEmail)}
                      className="w-full flex items-center justify-center gap-3 py-5 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          Review {transferType === 'deposit' ? 'Deposit' : transferType === 'wire' ? 'Wire' : 'Transfer'}
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setStep('details')}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-900">Review {transferType.charAt(0).toUpperCase() + transferType.slice(1)}</h2>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 rounded-3xl p-8 space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        {transferType === 'deposit' ? 'Depositing to' : 'Sending to'}
                      </p>
                      <p className="text-lg font-bold text-slate-900">
                        {transferType === 'standard' ? recipientName : 
                         transferType === 'wire' ? beneficiaryName : 
                         'Primary Checking'}
                      </p>
                      <p className="text-sm text-slate-500 font-medium">
                        {transferType === 'standard' ? receiverEmail : 
                         transferType === 'wire' ? `${bankName} (${accountNumber})` : 
                         `NovaBank Account ending in ${user?.id.slice(-4)}`}
                      </p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-[#007856]/10 flex items-center justify-center text-[#007856]">
                      {transferType === 'standard' ? <User className="w-7 h-7" /> : 
                       transferType === 'wire' ? <Globe className="w-7 h-7" /> : 
                       <Plus className="w-7 h-7" />}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-6 border-t border-slate-200">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                      <p className="text-3xl font-bold text-slate-900">${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fee</p>
                      <p className="text-lg font-bold text-emerald-600">
                        {transferType === 'wire' && wireType === 'international' ? '$25.00' : '$0.00'}
                      </p>
                    </div>
                  </div>

                  {description && (
                    <div className="pt-6 border-t border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Memo</p>
                      <p className="text-sm text-slate-700 font-medium italic">"{description}"</p>
                    </div>
                  )}
                </div>

                <div className="bg-emerald-50 rounded-2xl p-4 flex items-start gap-3 border border-emerald-100">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                    {transferType === 'deposit' 
                      ? "Deposits are subject to verification. Funds are typically available within 1-3 business days."
                      : "This transfer is protected by NovaBank's SecurePay technology. Funds are typically available instantly once released."}
                  </p>
                </div>

                <button
                  onClick={handleProcess}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-5 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Confirm & {transferType === 'deposit' ? 'Deposit' : 'Process'}
                      <CheckCircle2 className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'otp' && (
          <motion.div
            key="otp"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setStep('confirm')}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-900">Security Verification</h2>
              </div>

              <div className="space-y-6">
                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-start gap-4">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Large Transfer Protection</p>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      For your security, transfers over $1,000.00 require your 6-digit Portal Code to confirm the transaction.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {otpError && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-2 text-red-600 text-xs font-medium">
                      <AlertCircle className="w-4 h-4" />
                      {otpError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portal Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-50 border-none rounded-2xl py-4 text-center text-3xl font-bold tracking-[0.5em] focus:ring-2 focus:ring-[#007856]/20"
                      placeholder="000000"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otp.length !== 6}
                    className="w-full flex items-center justify-center gap-3 py-5 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
                  >
                    {otpLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Verify & Complete Transfer
                        <CheckCircle2 className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-12 text-center"
          >
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </motion.div>
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              {transferType === 'deposit' ? 'Deposit Received!' : 'Transfer Successful!'}
            </h2>
            <p className="text-slate-500 font-medium mb-10 max-w-sm mx-auto">
              Your {transferType} of <span className="text-slate-900 font-bold">${parseFloat(amount).toLocaleString()}</span> has been initiated.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => {
                  setStep('details');
                  setAmount('');
                  setReceiverEmail('');
                  setDescription('');
                  setBeneficiaryName('');
                  setAccountNumber('');
                }}
                className="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all"
              >
                Make Another Transaction
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
