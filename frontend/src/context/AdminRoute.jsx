import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Loader2 } from 'lucide-react';

export default function AdminRoute({ children }) {
  const { user, adminLevel, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Secure route for MASTER and ADMIN levels coming directly from backend JWT
  if (!user || (adminLevel !== 'MASTER' && adminLevel !== 'ADMIN')) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
