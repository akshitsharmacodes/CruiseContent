import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, QrCode } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import useApi from '../../hooks/useApi';

export default function WhatsAppSetup() {
  const navigate = useNavigate();
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Optionally check if already connected
    const checkConnection = async () => {
      try {
        const response = await api.get('platform/connected/');
        const platforms = response.data.connected_platforms || [];
        if (platforms.find(p => p.platform === 'WHATSAPP')) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error("Failed to check connection");
      }
    };
    checkConnection();
  }, [api]);

  const generateQRCode = async () => {
    setLoading(true);
    try {
      const response = await api.get('platform/whatsapp/qr/');
      if (response.data.qr_code) {
        // base64 qr code - Check if it already includes the data:image prefix
        let qrStr = response.data.qr_code;
        if (!qrStr.startsWith('data:image')) {
          qrStr = `data:image/png;base64,${qrStr}`;
        }
        setQrCode(qrStr);
        // Start polling or listening for connection success
        pollConnectionStatus();
      } else {
        toast.error('Failed to generate QR Code. Please try again.');
      }
    } catch (error) {
      console.error("WhatsApp QR Generation Error:", error);
      toast.error('Could not connect to WhatsApp service.');
    } finally {
      setLoading(false);
    }
  };

  const pollConnectionStatus = () => {
    // In a real implementation, we'd use WebSockets or poll
    // For demo, we just poll the connected endpoint every 5 seconds
    const interval = setInterval(async () => {
      try {
        const response = await api.get('platform/connected/');
        const platforms = response.data.connected_platforms || [];
        if (platforms.find(p => p.platform === 'WHATSAPP')) {
          setIsConnected(true);
          toast.success("WhatsApp Connected Successfully!");
          clearInterval(interval);
          setTimeout(() => navigate('/platforms'), 2000);
        }
      } catch (error) {
        // Ignore poll errors
      }
    }, 5000);
    
    // Clear after 2 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (!isConnected) {
        toast.error("QR Code expired or connection timed out. Please try again.");
        setQrCode(null);
      }
    }, 120000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
            Connect WhatsApp
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Publish statuses and broadcast messages via Evolution API.
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
              By connecting your WhatsApp account, SofricAI can automatically generate and publish status updates or broadcast messages.
            </p>
            
            <ul className="space-y-3">
              {[
                "AI-generated text and image statuses",
                "Automated scheduled broadcasts",
                "End-to-end encrypted via your device"
              ].map((feature, idx) => (
                <li key={idx} className="flex items-start space-x-3 text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* QR Code / Action Column */}
        <div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center min-h-[400px]">
            {isConnected ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Connected</h3>
                <p className="text-sm text-slate-500">Your WhatsApp is successfully linked.</p>
                <Button 
                  onClick={() => navigate('/platforms')}
                  className="mt-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-8"
                >
                  Return to Dashboard
                </Button>
              </div>
            ) : qrCode ? (
              <div className="flex flex-col items-center space-y-6">
                <h3 className="font-medium text-slate-900 dark:text-white">Scan to Connect</h3>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                </div>
                <div className="text-sm text-slate-500 space-y-2">
                  <p>1. Open WhatsApp on your phone</p>
                  <p>2. Tap Menu or Settings and select Linked Devices</p>
                  <p>3. Tap on Link a Device</p>
                  <p>4. Point your phone to this screen to capture the code</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-6">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-slate-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-slate-900 dark:text-white">WhatsApp Connection</h3>
                  <p className="text-sm text-slate-500 px-4">
                    Click the button below to generate a secure QR code to link your WhatsApp account.
                  </p>
                </div>
                <Button 
                  onClick={generateQRCode}
                  disabled={loading}
                  className="w-full rounded-full bg-[#0066cc] hover:bg-[#0055aa] text-white"
                >
                  {loading ? 'Generating...' : 'Generate Connection Code'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
