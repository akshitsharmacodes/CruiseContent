import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AnimatePresence } from 'framer-motion';

import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import Landing from './pages/Landing';
import AuthCallback from './pages/AuthCallback';
import AdminDashboard from './pages/AdminDashboard';
import Pricing from './pages/Pricing';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminRoute from './context/AdminRoute';

import PlatformsDashboard from './pages/platforms/PlatformsDashboard';
import MetaSetup from './pages/platforms/MetaSetup';
import TwitterSetup from './pages/platforms/TwitterSetup';

import AppLayout from './components/AppLayout';

const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes key={location.pathname} location={location}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/platforms" element={<PlatformsDashboard />} />
          <Route path="/platforms/meta" element={<MetaSetup />} />
          <Route path="/platforms/twitter" element={<TwitterSetup />} />
        </Route>
        
        {/* Super Admin Route */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        
        {/* Pricing Route */}
        <Route path="/pricing" element={<ProtectedRoute><AppLayout><Pricing /></AppLayout></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Navbar />
        <AnimatedRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
