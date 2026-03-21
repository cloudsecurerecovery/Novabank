import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function VerifyOtp() {
  const { user, isAuthenticated, isOtpVerified, setOtpVerified, logout } = useAuthStore();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  const generateAndSendOtp = async () => {
    if (!user) return;
    
    setSending(true);
    setError('');
    try {
      const { data: code, error: rpcError } = await supabase
        .rpc('generate_otp', { target_user_id: user.id });

      if (rpcError) throw rpcError;

      // SIMULATION: In a real app, you'd call an edge function or email service here.
      console.log(`[OTP SIMULATION] Code for ${user.email}: ${code}`);
      setSuccess('A verification code has been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isOtpVerified) {
      generateAndSendOtp();
    }
  }, [isAuthenticated, isOtpVerified]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !otp) return;

    setLoading(true);
    setError('');
    try {
      const { data: isValid, error: rpcError } = await supabase
        .rpc('verify_otp', { target_user_id: user.id, input_otp: otp });

      if (rpcError) throw rpcError;

      if (!isValid) {
        throw new Error('Invalid or expired verification code.');
      }

      setOtpVerified(true);
      if (user.is_admin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isOtpVerified) {
    return user?.is_admin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-[#007856] p-3 rounded-2xl shadow-lg shadow-emerald-100">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Verify your identity
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          We've sent a 6-digit code to <span className="font-bold text-slate-900">{user?.email}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-xl shadow-slate-200 sm:rounded-3xl sm:px-10 border border-slate-100"
        >
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-600 p-4 rounded-r-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-r-md flex items-start">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">{success}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleVerify}>
            <div>
              <label htmlFor="otp" className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                Verification Code
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 text-2xl tracking-[0.5em] font-mono sm:text-2xl border-slate-300 rounded-xl py-3 border text-center"
                  placeholder="000000"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 text-center">
                Enter the 6-digit code sent to your email.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-[#007856] hover:bg-[#006045] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#007856] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Verify & Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Didn't receive the code?</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={generateAndSendOtp}
                disabled={sending}
                className="text-sm font-bold text-[#007856] hover:text-[#006045] disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => logout()}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Sign out and try again
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
