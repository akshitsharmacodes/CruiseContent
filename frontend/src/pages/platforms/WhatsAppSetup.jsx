import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Phone, Building2, Key } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import useApi from '../../hooks/useApi';

export default function WhatsAppSetup() {
  const navigate = useNavigate();
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [connectionData, setConnectionData] = useState(null);
  
  const [formData, setFormData] = useState({
    phone_number_id: '',
    business_account_id: '',
    system_user_token: ''
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await api.get('platform/whatsapp/status/');
      if (response.data.is_connected) {
        setConnectionData(response.data);
      } else {
        setConnectionData(null);
      }
    } catch (error) {
      console.error("Failed to check WhatsApp status:", error);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!formData.phone_number_id || !formData.business_account_id || !formData.system_user_token) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      await api.post('platform/whatsapp/connect/', formData);
      toast.success("WhatsApp Connected Successfully!");
      
      // Clear sensitive form data
      setFormData({
        phone_number_id: '',
        business_account_id: '',
        system_user_token: ''
      });
      
      await checkStatus();
    } catch (error) {
      const errMsg = error.response?.data?.error || 'Failed to connect. Please check your credentials.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect WhatsApp?")) return;
    
    setLoading(true);
    try {
      await api.delete('platform/whatsapp/disconnect/');
      toast.success("WhatsApp Disconnected Successfully.");
      setConnectionData(null);
    } catch (error) {
      toast.error("Failed to disconnect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 lg:p-12">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/platforms')}
          className="rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Connect Meta WhatsApp Business
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Publish messages via the official Meta WhatsApp Business API.
          </p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid md:grid-cols-[1fr,400px] gap-8"
      >
        {/* Info Column */}
        <div className="space-y-6">
          <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800/80">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <FaWhatsapp className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              WhatsApp Integration
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Connect your own WhatsApp Business API to send AI-generated messages directly to your customers.
            </p>
            
            <ul className="space-y-3">
              {[
                "Direct API Integration (BYOK)",
                "Secure credential storage",
                "Automated scheduled broadcasts"
              ].map((feature, idx) => (
                <li key={idx} className="flex items-start space-x-3 text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action Column */}
        <div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[400px]">
            {statusLoading ? (
              <div className="text-sm text-slate-500">Checking connection status...</div>
            ) : connectionData ? (
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Connected</h3>
                
                <div className="w-full mt-6 space-y-3 text-left bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                  <div className="text-sm">
                    <span className="text-slate-500">Phone Number ID:</span>
                    <div className="font-medium text-slate-900 dark:text-white">{connectionData.phone_number_id}</div>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Business Account ID:</span>
                    <div className="font-medium text-slate-900 dark:text-white">{connectionData.business_account_id}</div>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Status:</span>
                    <div className="font-medium text-green-600">Active</div>
                  </div>
                </div>

                <div className="flex w-full space-x-3 mt-6">
                  <Button 
                    onClick={() => navigate('/platforms')}
                    className="flex-1 rounded-xl bg-slate-100 text-slate-900 hover:bg-slate-200"
                    variant="outline"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleDisconnect}
                    disabled={loading}
                    variant="destructive"
                    className="flex-1 rounded-xl"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConnect} className="w-full space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Phone Number ID
                    </label>
                    <Input 
                      name="phone_number_id"
                      value={formData.phone_number_id}
                      onChange={handleInputChange}
                      placeholder="e.g. 123456789012345"
                      className="rounded-xl"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Business Account ID
                    </label>
                    <Input 
                      name="business_account_id"
                      value={formData.business_account_id}
                      onChange={handleInputChange}
                      placeholder="e.g. 123456789012345"
                      className="rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                      <Key className="w-4 h-4" /> System User Token
                    </label>
                    <Input 
                      name="system_user_token"
                      type="password"
                      value={formData.system_user_token}
                      onChange={handleInputChange}
                      placeholder="EAA..."
                      className="rounded-xl font-mono text-sm"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Token is securely encrypted and never displayed after saving.
                    </p>
                  </div>
                </div>

                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[#0066cc] hover:bg-[#0055aa] text-white py-6"
                >
                  {loading ? 'Validating Connection...' : 'Connect & Save'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
