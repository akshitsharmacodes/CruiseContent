import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { FaFacebook, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { PageTransition } from '../../components/ui/PageTransition';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';
import useApi from '../../hooks/useApi';

const AVAILABLE_PLATFORMS = [
  {
    id: 'FACEBOOK_PAGE', // Keeps the backend ID for now, but represents Meta
    name: 'Meta (Facebook & Instagram)',
    icon: FaFacebook,
    route: '/platforms/meta',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    description: 'Connect your Facebook Page to auto-publish to Facebook and linked Instagram accounts.'
  },
  {
    id: 'TWITTER',
    name: 'Twitter / X',
    icon: FaXTwitter,
    route: '/platforms/twitter',
    color: 'text-slate-800 dark:text-slate-200',
    bg: 'bg-slate-100 dark:bg-slate-800',
    description: 'Connect your developer app to Tweet generated content instantly.'
  },
  {
    id: 'WHATSAPP',
    name: 'WhatsApp',
    icon: FaWhatsapp,
    route: '/platforms/whatsapp',
    color: 'text-green-600',
    bg: 'bg-green-50',
    description: 'Connect your WhatsApp using Evolution API to publish Statuses and Broadcasts.'
  }
];

export default function PlatformsDashboard() {
  const navigate = useNavigate();
  const api = useApi();
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await api.get('platform/connected/');
        setConnectedPlatforms(response.data.connected_platforms || []);
      } catch (error) {
        toast.error("Failed to load connected platforms");
      } finally {
        setLoading(false);
      }
    };
    fetchPlatforms();
  }, []);

  const isConnected = (platformId) => {
    return connectedPlatforms.some(p => p.platform === platformId);
  };

  const handleDisconnect = async (platformId) => {
    if (!window.confirm("Are you sure you want to disconnect this platform?")) return;
    
    try {
      const dbPlatformId = platformId === 'FACEBOOK_PAGE' ? 'FACEBOOK' : platformId;
      await api.delete(`platform/disconnect/${dbPlatformId}/`);
      setConnectedPlatforms(prev => prev.filter(p => p.platform !== platformId));
      toast.success("Successfully disconnected platform.");
    } catch (error) {
      toast.error("Failed to disconnect platform.");
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-6 lg:p-12">
        <div className="max-w-5xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-4 -ml-4 text-muted-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
              </Button>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-2">Platforms</h1>
              <p className="text-muted-foreground">Manage your connected social media integrations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AVAILABLE_PLATFORMS.map((platform, idx) => {
              const connected = isConnected(platform.id);
              
              return (
                <motion.div
                  key={platform.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="h-full"
                >
                  <Card className="h-full flex flex-col shadow-sm border-border hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-3 rounded-xl ${platform.bg}`}>
                          <platform.icon className={`h-6 w-6 ${platform.color}`} />
                        </div>
                        {loading ? (
                          <Skeleton className="h-6 w-20 rounded-full" />
                        ) : connected ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                            Not Connected
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-xl">{platform.name}</CardTitle>
                      <CardDescription className="pt-2">{platform.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {/* Optional extra content could go here */}
                    </CardContent>
                    <CardFooter>
                      <div className="w-full">
                        {connected ? (
                          <div className="flex gap-2 w-full">
                            <motion.div whileTap={{ scale: 0.98 }} className="flex-1">
                              <Button 
                                className="w-full" 
                                variant="outline"
                                onClick={() => navigate(platform.route)}
                              >
                                Manage Settings
                              </Button>
                            </motion.div>
                            <motion.div whileTap={{ scale: 0.98 }}>
                              <Button 
                                variant="destructive"
                                onClick={() => handleDisconnect(platform.id)}
                              >
                                Disconnect
                              </Button>
                            </motion.div>
                          </div>
                        ) : (
                          <motion.div whileTap={{ scale: 0.98 }} className="w-full">
                            <Button 
                              className="w-full" 
                              variant="default"
                              onClick={() => navigate(platform.route)}
                            >
                              Connect
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>
          
        </div>
      </div>
    </PageTransition>
  );
}
