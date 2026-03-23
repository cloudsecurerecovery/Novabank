import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Building2, Lock, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';

export default function VerifyOtp() {
  const { user, isAuthenticated, isOtpVerified, setOtpVerified, logout } = useAuthStore();
  const [otp, setOtp] = useState('');
  const [currentOtp, setCurrentOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isOtpVerified && user) {
      handleResendOtp(true);
    }
  }, [isAuthenticated, isOtpVerified]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isOtpVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.rpc('verify_otp', {
        target_user_id: user?.id,
        input_otp: otp
      });

      if (verifyError) throw verifyError;

      if (data === true) {
        setOtpVerified(true);
        toast.success('Identity verified successfully');
        navigate('/dashboard');
      } else {
        setError('Invalid or expired OTP code. Please try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (silent = false) => {
    if (!user) return;
    
    if (!silent) setResending(true);
    setError('');

    try {
      const { data: newOtp, error: resendError } = await supabase.rpc('generate_otp', {
        target_user_id: user.id
      });

      if (resendError) throw resendError;

      if (newOtp) {
        setCurrentOtp(newOtp);
      }

      if (!silent) {
        toast.success('A new security code has been generated');
      }
    } catch (err: any) {
      console.error('Resend error:', err);
      if (!silent) {
        toast.error('Failed to generate new code');
      }
    } finally {
      if (!silent) setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-[#007856] rounded-xl flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Security Verification
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          We've sent a 6-digit security code to your registered device.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleVerify}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Verification Code
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 text-2xl tracking-[0.5em] font-mono border-slate-300 rounded-lg py-3 border text-center"
                  placeholder="000000"
                />
              </div>
              {currentOtp && (
                <p className="mt-2 text-center text-xs font-bold text-[#007856] bg-emerald-50 py-2 rounded-lg border border-emerald-100 animate-pulse">
                  DEMO MODE: Your code is <span className="text-lg">{currentOtp}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-[#007856] hover:bg-[#006045] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#007856] disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Identity'}
              </button>

              <button
                type="button"
                onClick={() => handleResendOtp()}
                disabled={resending || loading}
                className="w-full flex justify-center py-2 px-4 text-sm font-medium text-[#007856] hover:text-[#006045] transition-colors disabled:opacity-50"
              >
                {resending ? 'Generating code...' : "Didn't receive a code? Resend"}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              onClick={() => logout()}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel and sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
