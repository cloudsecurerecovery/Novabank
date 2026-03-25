import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Building2, Lock, ShieldCheck, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { notificationService } from '../services/notificationService';
import { toast } from 'react-hot-toast';

export default function PortalCode() {
  const { user, isAuthenticated, isOtpVerified, setOtpVerified, logout } = useAuthStore();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isOtpVerified || user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedData = value.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedData.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      // Focus last filled or next empty
      const nextIndex = Math.min(index + pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the full 6-digit Portal Code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch the stored portal code from the profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('otp_code')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.otp_code === fullOtp) {
        setOtpVerified(true);
        toast.success('Access granted');
        navigate('/dashboard');
      } else {
        setError('Invalid Portal Code. Please try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to verify Portal Code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-[#007856] rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Portal Access
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Please enter your 6-digit Portal Code to continue.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-4 shadow-2xl shadow-slate-200/50 sm:rounded-[32px] sm:px-10 border border-slate-100">
          <form className="space-y-8" onSubmit={handleVerify}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-start gap-2 animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <label className="block text-center text-sm font-bold text-slate-500 uppercase tracking-widest">
                Enter Portal Code
              </label>
              <div className="flex justify-between gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-[#007856] focus:ring-4 focus:ring-[#007856]/10 transition-all outline-none"
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-[#007856] hover:bg-[#006045] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#007856] disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Portal'}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <button
              onClick={() => logout()}
              className="w-full text-center text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel and sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
