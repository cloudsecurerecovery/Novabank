import { Link } from 'react-router-dom';
import { Home, AlertTriangle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-amber-100 shadow-xl shadow-amber-100/20">
          <AlertTriangle className="w-12 h-12 text-amber-600" />
        </div>
        
        <h1 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter">404</h1>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Page Not Found</h2>
        <p className="text-slate-500 font-medium mb-10 leading-relaxed">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-2 px-8 py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-100"
          >
            <Home className="w-5 h-5" />
            Back to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-700 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>
        
        <div className="mt-16 pt-8 border-t border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">NovaBank Secure Infrastructure</p>
        </div>
      </motion.div>
    </div>
  );
}
