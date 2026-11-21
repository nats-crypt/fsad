import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: Role | Role[];
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
          <p className="text-runway font-heading tracking-widest uppercase text-sm animate-pulse">
            Loading
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
