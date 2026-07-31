import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AnimatePresence } from 'framer-motion';

import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Landing from './pages/Landing';

import PlatformsDashboard from './pages/platforms/PlatformsDashboard';
import MetaSetup from './pages/platforms/MetaSetup';
import TwitterSetup from './pages/platforms/TwitterSetup';

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes key={location.pathname} location={location}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        <Route path="/platforms" element={<PlatformsDashboard />} />
        <Route path="/platforms/meta" element={<MetaSetup />} />
        <Route path="/platforms/twitter" element={<TwitterSetup />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Navbar />
      <AnimatedRoutes />
    </Router>
  );
}

export default App;
