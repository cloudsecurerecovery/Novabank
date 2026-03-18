import { create } from 'zustand';

export interface User {
  id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  avatar_url?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => {
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
  updateUser: (updatedFields) => 
    set((state) => ({
      user: state.user ? { ...state.user, ...updatedFields } : null
    })),
}));
