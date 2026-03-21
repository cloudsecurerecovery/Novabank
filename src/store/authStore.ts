import { create } from 'zustand';

export interface User {
  id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  role?: string;
  avatar_url?: string;
  phone?: string;
  otp_code?: string;
  otp_expires_at?: string;
  balance?: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isOtpVerified: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setOtpVerified: (verified: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isOtpVerified: false,
  login: (user) => {
    set({ user, isAuthenticated: true, isOtpVerified: false });
  },
  logout: () => {
    set({ user: null, isAuthenticated: false, isOtpVerified: false });
  },
  updateUser: (updatedFields) => 
    set((state) => ({
      user: state.user ? { ...state.user, ...updatedFields } : null
    })),
  setOtpVerified: (verified) => set({ isOtpVerified: verified }),
}));
