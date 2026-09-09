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
import Forbidden403 from './pages/Forbidden403';
import NotFound404 from './pages/NotFound404';
import AdminRoute from './context/AdminRoute';
import SoftwarePermissionRoute from './context/SoftwarePermissionRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminUsers from './pages/admin/AdminUsers';
import AdminWorkspaces from './pages/admin/AdminWorkspaces';
import AdminAdmins from './pages/admin/AdminAdmins';
import AdminPlans from './pages/admin/AdminPlans';
import AdminRoles from './pages/admin/AdminRoles';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import Pricing from './pages/Pricing';
import { AuthProvider, useAuth } from './context/AuthContext';

import PlatformsDashboard from './pages/platforms/PlatformsDashboard';
import MetaSetup from './pages/platforms/MetaSetup';
import TwitterSetup from './pages/platforms/TwitterSetup';
import WhatsAppSetup from './pages/platforms/WhatsAppSetup';
import WhatsAppCampaignPage from './pages/client/WhatsAppCampaignPage';
import GenericSoftwareModulePage from './pages/client/GenericSoftwareModulePage';
import SocialMediaManager from './pages/client/SocialMediaManager';

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
          
          {/* Main Workspace Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* 1. Social Media Manager */}
          <Route 
            path="/client/social-manager" 
            element={
              <SoftwarePermissionRoute software="SOCIAL_MEDIA_MANAGER">
                <SocialMediaManager />
              </SoftwarePermissionRoute>
            } 
          />

          
          {/* 2. WhatsApp Campaign */}
          <Route 
            path="/client/whatsapp" 
            element={
              <SoftwarePermissionRoute software="WHATSAPP_CAMPAIGN">
                <WhatsAppCampaignPage />
              </SoftwarePermissionRoute>
            } 
          />

          {/* 3. WhatsHook */}
          <Route 
            path="/client/whatshook" 
            element={
              <SoftwarePermissionRoute software="WHATSHOOK">
                <GenericSoftwareModulePage 
                  softwareCode="WHATSHOOK" 
                  softwareName="WhatsHook" 
                  description="Incoming & Outgoing Webhook Event Streams"
                  features={[
                    { code: "WEBHOOKS", name: "Webhooks", description: "Incoming & Outgoing webhook endpoints" },
                    { code: "LOGS", name: "Event Logs", description: "Realtime webhook transmission events" }
                  ]}
                />
              </SoftwarePermissionRoute>
            } 
          />

          {/* 4. AI Calling */}
          <Route 
            path="/client/ai-calling" 
            element={
              <SoftwarePermissionRoute software="AI_CALLING">
                <GenericSoftwareModulePage 
                  softwareCode="AI_CALLING" 
                  softwareName="AI Calling" 
                  description="Voice Sessions, Call Automations & Recordings"
                  features={[
                    { code: "CALL_SESSIONS", name: "Voice Sessions", description: "Autonomous AI caller sessions" },
                    { code: "RECORDINGS", name: "Recordings & Transcripts", description: "Stored voice audio & text transcripts" }
                  ]}
                />
              </SoftwarePermissionRoute>
            } 
          />

          {/* 5. ChatBot */}
          <Route 
            path="/client/chatbot" 
            element={
              <SoftwarePermissionRoute software="CHATBOT">
                <GenericSoftwareModulePage 
                  softwareCode="CHATBOT" 
                  softwareName="ChatBot" 
                  description="Interactive AI Assistant Flows & Live Chats"
                  features={[
                    { code: "BOT_FLOWS", name: "Automation Flows", description: "Custom decision trees and prompt flows" },
                    { code: "CONVERSATIONS", name: "Conversations", description: "Active user messaging sessions" }
                  ]}
                />
              </SoftwarePermissionRoute>
            } 
          />

          {/* 6. Datext */}
          <Route 
            path="/client/datext" 
            element={
              <SoftwarePermissionRoute software="DATEXT">
                <GenericSoftwareModulePage 
                  softwareCode="DATEXT" 
                  softwareName="Datext" 
                  description="Intelligent Document & Data Extraction Engine"
                  features={[
                    { code: "EXTRACTION", name: "Extraction Tasks", description: "Automated OCR & unstructured data parsing" },
                    { code: "RULES", name: "Extraction Rules", description: "Regex and schema validation rules" }
                  ]}
                />
              </SoftwarePermissionRoute>
            } 
          />

          {/* 7. Share & Care */}
          <Route 
            path="/client/share-care" 
            element={
              <SoftwarePermissionRoute software="SHARE_AND_CARE">
                <GenericSoftwareModulePage 
                  softwareCode="SHARE_AND_CARE" 
                  softwareName="Share & Care" 
                  description="Community Resource Hub & Program Outreach"
                  features={[
                    { code: "COMMUNITY", name: "Community Programs", description: "Group programs & initiatives" },
                    { code: "RESOURCES", name: "Resource Library", description: "Shared toolkits & guide documentation" }
                  ]}
                />
              </SoftwarePermissionRoute>
            } 
          />

          <Route path="/profile" element={<Profile />} />
          <Route path="/platforms" element={<PlatformsDashboard />} />
          <Route path="/platforms/meta" element={<MetaSetup />} />
          <Route path="/platforms/twitter" element={<TwitterSetup />} />
          <Route path="/platforms/whatsapp" element={<WhatsAppSetup />} />
        </Route>
        
        {/* Admin Console Routes */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="workspaces" element={<AdminWorkspaces />} />
          <Route path="admins" element={<AdminAdmins />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="roles" element={<AdminRoles />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
        </Route>
        
        {/* Pricing Route */}
        <Route path="/pricing" element={<ProtectedRoute><AppLayout><Pricing /></AppLayout></ProtectedRoute>} />
        
        {/* Error Pages */}
        <Route path="/403" element={<Forbidden403 />} />
        <Route path="*" element={<NotFound404 />} />
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

