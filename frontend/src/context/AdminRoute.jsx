import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Loader2 } from 'lucide-react';

export default function AdminRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Strictly protect the route for the Super Admin only
  if (!user || user.email !== 'akshitsharmacodes@gmail.com') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
