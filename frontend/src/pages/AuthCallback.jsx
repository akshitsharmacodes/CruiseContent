import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Ship } from 'lucide-react';


const AuthCallback = () => {
  const [error, setError] = useState(null);
  const { handleLoginSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessedCode = useRef(false);

  useEffect(() => {
    const processCode = async () => {
      if (hasProcessedCode.current) return;
      
      // 1. Get the 'code' parameter from the URL
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');

      if (!code) {
        setError("No authorization code found in URL.");
        return;
      }
      
      hasProcessedCode.current = true;

      try {
        // 2. Send the code to our Django backend to exchange for custom JWTs
        const response = await fetch('http://localhost:8000/api/auth/google/callback/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // Send credentials so the backend can set the HttpOnly cookie for the refresh token
          credentials: 'include',
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (response.ok && data.access_token) {
          // 3. Store the short-lived access token in AuthContext
          handleLoginSuccess(data.access_token);
          
          // 4. Check if onboarding is required
          try {
            const profileRes = await fetch('http://localhost:8000/api/workspaces/profile/', {
              headers: {
                'Authorization': `Bearer ${data.access_token}`
              }
            });
            
            if (profileRes.status === 404) {
              navigate('/onboarding', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          } catch (e) {
            navigate('/dashboard', { replace: true });
          }
        } else {
          setError(data.error || "Failed to authenticate with backend.");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError("An error occurred during authentication.");
      }
    };

    processCode();
  }, [location, navigate, handleLoginSuccess]);

  if (error) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-[400px] border-border bg-card/40 backdrop-blur-sm shadow-2xl rounded-3xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-3">Authentication Error</h2>
          <p className="text-muted-foreground mb-8">{error}</p>
          <Button 
            onClick={() => navigate('/')}
            className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium transition-colors"
          >
            Return Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 font-sans">
      <div className="flex justify-center items-center gap-2 mb-8 text-foreground">
        <Ship className="w-6 h-6 text-primary" />
        <span className="text-xl font-bold tracking-tight">CruiseContent</span>
      </div>
      
      <Card className="w-full max-w-[400px] border-border bg-card/40 backdrop-blur-sm shadow-2xl rounded-3xl p-10 text-center">
        <div className="flex flex-col items-center justify-center space-y-6">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="space-y-2">
            <h2 className="text-xl font-medium text-foreground">Completing sign in...</h2>
            <p className="text-sm text-muted-foreground">Please wait while we verify your credentials.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AuthCallback;
