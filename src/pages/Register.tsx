import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Lock, Mail, User, Phone, CheckCircle2, XCircle } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../supabaseClient';
import { validateEmail, validatePassword, validatePhone, validateFullName } from '../utils/validation';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Enhanced Validation
    if (!validateFullName(formData.name)) {
      setError('Please enter your first and last name.');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    const passwordCheck = validatePassword(formData.password);
    if (!passwordCheck.isValid) {
      setError(passwordCheck.message);
      return;
    }

    setLoading(true);

    try {
      const { data, error: supabaseError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            phone: formData.phone,
          }
        }
      });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      // Log to audit log if user was created
      if (data.user) {
        const { auditService } = await import('../services/auditService');
        await auditService.log(data.user.id, 'registration', {
          email: formData.email,
          name: formData.name
        });
      }

      // Redirect to login with email and success flag
      navigate('/login', { state: { email: formData.email, signupSuccess: true } });
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const passwordStrength = validatePassword(formData.password);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-[#007856] rounded-xl flex items-center justify-center">
            <Building2 className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Create an account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[#007856] hover:text-[#006045]">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-lg py-2.5 border"
                  placeholder="John Doe"
                />
              </div>
              {formData.name && !validateFullName(formData.name) && (
                <p className="mt-1 text-xs text-red-500">Please enter at least two names.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-lg py-2.5 border"
                  placeholder="you@example.com"
                />
              </div>
              {formData.email && !validateEmail(formData.email) && (
                <p className="mt-1 text-xs text-red-500">Please enter a valid email address.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Phone Number (Optional)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-lg py-2.5 border"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              {formData.phone && !validatePhone(formData.phone) && (
                <p className="mt-1 text-xs text-red-500">Please enter a valid 10-digit phone number.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="focus:ring-[#007856] focus:border-[#007856] block w-full pl-10 sm:text-sm border-slate-300 rounded-lg py-2.5 border"
                  placeholder="••••••••"
                />
              </div>
              {formData.password && (
                <div className="mt-2 space-y-1">
                  <p className={`text-xs flex items-center gap-1 ${formData.password.length >= 8 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {formData.password.length >= 8 ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-slate-300 rounded-full" />}
                    At least 8 characters
                  </p>
                  <p className={`text-xs flex items-center gap-1 ${/[A-Z]/.test(formData.password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {/[A-Z]/.test(formData.password) ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-slate-300 rounded-full" />}
                    One uppercase letter
                  </p>
                  <p className={`text-xs flex items-center gap-1 ${/[0-9]/.test(formData.password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {/[0-9]/.test(formData.password) ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-slate-300 rounded-full" />}
                    One number
                  </p>
                  <p className={`text-xs flex items-center gap-1 ${/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-slate-300 rounded-full" />}
                    One special character
                  </p>
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#007856] hover:bg-[#006045] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#007856] disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
