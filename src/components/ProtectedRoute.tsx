import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { storageService } from '../services/storageService';

export const ProtectedRoute = () => {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const { login, logout } = useAuthStore();

  useEffect(() => {
    const fetchProfile = async (userId: string, email: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (data) {
        const signedAvatarUrl = await storageService.getSignedUrl(data.avatar_url);
        login({
          id: data.id,
          full_name: data.full_name || email.split('@')[0],
          email: email,
          is_admin: data.is_admin,
          avatar_url: signedAvatarUrl,
          phone: data.phone,
        });
      } else {
        // If profile doesn't exist yet, create a basic one in store
        login({
          id: userId,
          full_name: email.split('@')[0],
          email: email,
          is_admin: false,
        });
      }
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setHasSession(!!session);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || '');
      } else {
        logout();
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setHasSession(!!session);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || '');
      } else {
        logout();
      }
    });

    return () => subscription.unsubscribe();
  }, [login, logout]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!hasSession) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export const AdminRoute = () => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
