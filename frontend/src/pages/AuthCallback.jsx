import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Authentication Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="mt-6 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
      <h2 className="text-xl">Completing sign in...</h2>
      <p className="text-slate-400 mt-2">Please wait while we verify your credentials.</p>
    </div>
  );
};

export default AuthCallback;
