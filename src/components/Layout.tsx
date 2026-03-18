import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Building2, LogOut, LayoutDashboard, UserCircle, Users, MessageSquare, DollarSign, Clock, Menu, X, Shield, ArrowDownLeft, Globe } from 'lucide-react';
import { useState } from 'react';

import { AvatarImage } from './AvatarImage';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = user?.is_admin 
    ? [
        { name: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'Transactions', path: '/admin/transactions', icon: Building2 },
        { name: 'Support Chat', path: '/admin/chat', icon: MessageSquare },
        { name: 'Audit Logs', path: '/admin/audit', icon: Shield },
      ]
    : [
        { name: 'Accounts', path: '/dashboard', icon: Building2 },
        { name: 'Transfer', path: '/transfer', icon: DollarSign },
        { name: 'Deposit', path: '/deposit', icon: ArrowDownLeft },
        { name: 'Wire', path: '/wire-transfer', icon: Globe },
        { name: 'Support', path: '/support', icon: MessageSquare },
        { name: 'Profile', path: '/profile', icon: UserCircle },
      ];

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col font-sans">
      {/* Top Header - M&T Green */}
      <header className="bg-[#007856] text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo area */}
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-[#FFB612]" />
              <span className="text-xl font-bold tracking-tight">NovaBank</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/admin' && location.pathname === '/admin');
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`text-sm font-medium transition-colors hover:text-[#FFB612] ${
                      isActive ? 'text-[#FFB612] border-b-2 border-[#FFB612] pb-1' : 'text-white'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User Actions */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
                  <AvatarImage 
                    avatarUrl={user?.avatar_url} 
                    fullName={user?.full_name} 
                  />
                </div>
                <span className="text-sm font-medium">Welcome, {user?.full_name?.split(' ')[0]}</span>
                {user?.is_admin && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FFB612] text-[#007856]">
                    Admin
                  </span>
                )}
              </div>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 text-sm font-medium text-white hover:text-[#FFB612] transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-white hover:text-[#FFB612] focus:outline-none"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#006045] border-t border-[#007856]">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActive ? 'bg-[#007856] text-[#FFB612]' : 'text-white hover:bg-[#007856] hover:text-[#FFB612]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-[#007856] hover:text-[#FFB612]"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-5 w-5" />
                  Log Out
                </div>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? 'text-[#007856]' : 'text-slate-400'
              }`}
            >
              <item.icon className={`h-6 w-6 ${isActive ? 'fill-emerald-50' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.name.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer - Hidden on mobile to save space for bottom nav if needed, or kept simple */}
      <footer className="hidden md:block bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-slate-500">
            © {new Date().getFullYear()} NovaBank. Equal Housing Lender. Member FDIC.
          </p>
        </div>
      </footer>
    </div>
  );
}
