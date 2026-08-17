import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { PageTransition } from '../../components/ui/PageTransition';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import useApi from '../../hooks/useApi';

export default function TwitterSetup() {
  const navigate = useNavigate();
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    api_key: '',
    api_secret: '',
    access_token: '',
    access_token_secret: '',
    account_name: ''
  });

  const handleOAuthLogin = async () => {
    try {
      setLoading(true);
      const response = await api.get('platform/twitter/login/');
      if (response.data && response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error("Failed to get Twitter login URL");
        setLoading(false);
      }
    } catch (error) {
      toast.error("Failed to initialize Twitter login");
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.post('platform/twitter/connect-manual/', formData);
      toast.success("Successfully connected Twitter Account!");
      navigate('/platforms');
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to connect to Twitter");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-6 lg:p-12">
        <div className="max-w-3xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between mb-8">
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/platforms')} className="mb-4 -ml-4 text-muted-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Platforms
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 rounded-xl">
                  <FaXTwitter className="w-8 h-8 text-slate-900" />
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">Twitter / X Setup</h1>
              </div>
            </div>
          </div>

          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle>Connect your Twitter App</CardTitle>
              <CardDescription>
                Choose how you want to link your Twitter Developer App to automate posts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="manual">Manual Developer Keys</TabsTrigger>
                  <TabsTrigger value="oauth">OAuth Connection</TabsTrigger>
                </TabsList>
                
                <TabsContent value="manual">
                  <form onSubmit={handleManualSubmit} className="space-y-6 pt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="account_name">Display Name</Label>
                        <Input 
                          id="account_name" 
                          placeholder="e.g. My Twitter App" 
                          value={formData.account_name}
                          onChange={(e) => setFormData({...formData, account_name: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="api_key">API Key (Consumer Key)</Label>
                        <Input 
                          id="api_key" 
                          placeholder="..." 
                          required
                          value={formData.api_key}
                          onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="api_secret">API Secret (Consumer Secret)</Label>
                        <Input 
                          id="api_secret" 
                          type="password"
                          placeholder="..." 
                          required
                          value={formData.api_secret}
                          onChange={(e) => setFormData({...formData, api_secret: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="access_token">Access Token</Label>
                        <Input 
                          id="access_token" 
                          placeholder="..." 
                          required
                          value={formData.access_token}
                          onChange={(e) => setFormData({...formData, access_token: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="access_token_secret">Access Token Secret</Label>
                        <Input 
                          id="access_token_secret" 
                          type="password"
                          placeholder="..." 
                          required
                          value={formData.access_token_secret}
                          onChange={(e) => setFormData({...formData, access_token_secret: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                      <motion.div whileTap={{ scale: 0.98 }}>
                        <Button type="submit" disabled={loading}>
                          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Connect Twitter App
                        </Button>
                      </motion.div>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="oauth" className="space-y-6 pt-4 pb-8 flex flex-col items-center text-center">
                  <div className="bg-slate-100 p-6 rounded-full mb-4">
                    <FaXTwitter className="w-12 h-12 text-slate-900" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h3 className="font-medium text-lg">Login with Twitter</h3>
                    <p className="text-sm text-muted-foreground">
                      Click below to securely authenticate with Twitter and grant access to publish on your behalf.
                    </p>
                  </div>
                  
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button onClick={handleOAuthLogin} className="bg-slate-900 hover:bg-slate-800 text-white px-8 mt-4">
                      <FaXTwitter className="w-4 h-4 mr-2" />
                      Connect via X
                    </Button>
                  </motion.div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
        </div>
      </div>
    </PageTransition>
  );
}
