import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Loader2 } from 'lucide-react';
import { PageTransition } from '../../components/ui/PageTransition';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

export default function MetaSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    page_id: '',
    access_token: '',
    page_name: ''
  });

  const handleOAuthLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = 'http://localhost:8000/api/platform/facebook/login/';
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post('http://localhost:8000/api/platform/facebook/connect-manual/', formData);
      toast.success("Successfully connected Facebook Page!");
      navigate('/platforms');
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to connect to Facebook");
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
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Share2 className="w-8 h-8 text-blue-600" />
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">Meta Setup</h1>
              </div>
            </div>
          </div>

          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle>Connect your Page</CardTitle>
              <CardDescription>
                Choose how you want to link your Meta accounts. OAuth is recommended for easiest setup and will link both your Facebook Pages and Instagram Business accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="oauth" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="oauth">OAuth Connection</TabsTrigger>
                  <TabsTrigger value="manual">Manual Developer Keys</TabsTrigger>
                </TabsList>
                
                <TabsContent value="oauth" className="space-y-6 pt-4 pb-8 flex flex-col items-center text-center">
                  <div className="bg-blue-50 p-6 rounded-full mb-4">
                    <Share2 className="w-12 h-12 text-blue-600" />
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h3 className="font-medium text-lg">Login with Meta</h3>
                    <p className="text-sm text-muted-foreground">
                      Click below to securely authenticate with Meta and grant access to publish on your Facebook Pages and Instagram Business accounts.
                    </p>
                  </div>
                  
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button onClick={handleOAuthLogin} className="bg-blue-600 hover:bg-blue-700 text-white px-8 mt-4">
                      Connect via Meta
                    </Button>
                  </motion.div>
                </TabsContent>
                
                <TabsContent value="manual">
                  <form onSubmit={handleManualSubmit} className="space-y-6 pt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="page_name">Display Name</Label>
                        <Input 
                          id="page_name" 
                          placeholder="e.g. My Awesome Page" 
                          value={formData.page_name}
                          onChange={(e) => setFormData({...formData, page_name: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="page_id">Facebook Page ID</Label>
                        <Input 
                          id="page_id" 
                          placeholder="123456789012345" 
                          required
                          value={formData.page_id}
                          onChange={(e) => setFormData({...formData, page_id: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="access_token">Page Access Token</Label>
                        <Input 
                          id="access_token" 
                          type="password"
                          placeholder="EAABw..." 
                          required
                          value={formData.access_token}
                          onChange={(e) => setFormData({...formData, access_token: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                      <motion.div whileTap={{ scale: 0.98 }}>
                        <Button type="submit" disabled={loading}>
                          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Connect Manually
                        </Button>
                      </motion.div>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
        </div>
      </div>
    </PageTransition>
  );
}
