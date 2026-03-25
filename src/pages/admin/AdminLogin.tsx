import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { validateEmail } from '../../utils/validation';
import { toast } from 'react-hot-toast';
import { auditService } from '../../services/auditService';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid admin email.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (supabaseError) {
        // Log failed login attempt
        await auditService.log('system', 'failed_login_attempt', { 
          email,
          portal: 'admin',
          error: supabaseError.message,
          timestamp: new Date().toISOString()
        });
        
        // Special case for the provided admin credentials if they don't exist in Auth yet
        if (email === 'ositalan5@gmail.com' && password === 'Longlife@1355') {
          toast.success('Admin credentials recognized. Initializing secure session...');
          // We can't force sign-in without Auth, but we can guide the user
          setError('Please ensure you have registered this account first. Once registered, it will be automatically granted admin privileges.');
        }
        throw supabaseError;
      }

      if (data.user) {
        // Check if user is actually an admin
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', data.user.id)
          .single();

        // Bootstrap admin if it's the specific email
        const isAdmin = profile?.is_admin || email === 'ositalan5@gmail.com';

        if (!isAdmin) {
          await auditService.log(data.user.id, 'unauthorized_access', {
            email: data.user.email,
            portal: 'admin',
            timestamp: new Date().toISOString()
          });
          await supabase.auth.signOut();
          throw new Error('Access denied: This account does not have administrative privileges.');
        }

        // Log successful admin login
        await auditService.log(data.user.id, 'admin_login', { 
          email: data.user.email,
          timestamp: new Date().toISOString()
        });

        toast.success('Admin access granted');
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/20">
            <Shield className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Admin Portal
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Secure access for NovaBank administrators
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-800 py-8 px-4 shadow-2xl sm:rounded-[32px] sm:px-10 border border-slate-700">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  placeholder="admin@novabank.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Security Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-all"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>

            <div className="mt-6 flex items-center justify-center">
              <Link
                to="/login"
                className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to User Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
