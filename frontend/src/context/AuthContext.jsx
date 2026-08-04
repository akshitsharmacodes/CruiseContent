import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode"; // Needs to be installed

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [tier, setTier] = useState(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // We only store the access token in memory, not localStorage, for security
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    // Attempt to silently refresh token on app load if we have an HttpOnly cookie
    refreshAccessToken();
  }, []);

  const refreshAccessToken = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/token/refresh/', {
        method: 'POST',
        // Important: this sends the HttpOnly refresh cookie to the backend
        credentials: 'include' 
      });
      
      if (response.ok) {
        const data = await response.json();
        handleLoginSuccess(data.access_token);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Silent refresh failed:", error);
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (token) => {
    setAccessToken(token);
    try {
      const decoded = jwtDecode(token);
      setUser({ id: decoded.user_id, email: decoded.email, picture: decoded.picture });
      setRole(decoded.role);
      setTier(decoded.tier);
      setCurrentWorkspaceId(decoded.workspace_id);
    } catch (e) {
      console.error("Invalid token:", e);
    }
    setIsLoading(false);
  };

  const logout = async () => {
    try {
      await fetch('http://localhost:8000/api/auth/logout/', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      setAccessToken(null);
      setUser(null);
      setRole(null);
      setTier(null);
      setCurrentWorkspaceId(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, tier, currentWorkspaceId, accessToken, isLoading, handleLoginSuccess, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
