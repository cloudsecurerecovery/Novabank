import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const ProtectedRoute = () => {
  const { isAuthenticated, isOtpVerified } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isOtpVerified) {
    return <Navigate to="/verify-otp" replace />;
  }

  return <Outlet />;
};
