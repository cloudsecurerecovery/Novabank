import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/login" className="h-12 w-12 bg-[#007856] rounded-xl flex items-center justify-center hover:bg-[#006045] transition-colors">
            <Building2 className="h-8 w-8 text-white" />
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100"
        >
          {submitted ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Check your email</h3>
                <p className="text-sm text-slate-600">
                  We've sent a password reset link to <span className="font-semibold text-slate-900">{email}</span>.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center text-sm font-semibold text-[#007856] hover:text-[#006045]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Email address
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-xl py-3 border font-medium"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#007856] hover:bg-[#006045] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#007856] disabled:opacity-50 transition-all"
                >
                  {loading ? 'Sending link...' : 'Send reset link'}
                </button>
              </div>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-[#007856] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
