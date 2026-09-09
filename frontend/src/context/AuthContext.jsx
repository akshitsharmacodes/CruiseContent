import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from "jwt-decode";
import { API_BASE_URL } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [tier, setTier] = useState(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [adminLevel, setAdminLevel] = useState(null);
  const [adminProfileId, setAdminProfileId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic Workspace Permissions State
  const [userPermissions, setUserPermissions] = useState([]);
  const [userSoftwareModules, setUserSoftwareModules] = useState([]);
  const [userCustomRole, setUserCustomRole] = useState(null);
  const [currentWorkspaceName, setCurrentWorkspaceName] = useState(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

  // In-memory access token
  const [accessToken, setAccessToken] = useState(null);

  const fetchUserPermissions = useCallback(async (token) => {
    const activeToken = token || accessToken;
    if (!activeToken) {
      setUserPermissions([]);
      setUserSoftwareModules([]);
      setUserCustomRole(null);
      setCurrentWorkspaceName(null);
      return;
    }
    setIsLoadingPermissions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/workspaces/user-permissions/`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUserPermissions(data.permissions || []);
        setUserSoftwareModules(data.software_modules || []);
        setUserCustomRole(data.custom_role || null);
        setCurrentWorkspaceName(data.workspace_name || null);
      } else {
        setUserPermissions([]);
        setUserSoftwareModules([]);
        setUserCustomRole(null);
        setCurrentWorkspaceName(null);
      }
    } catch (err) {
      console.error("Failed to fetch user permissions", err);
      setUserPermissions([]);
      setUserSoftwareModules([]);
      setUserCustomRole(null);
      setCurrentWorkspaceName(null);
    } finally {
      setIsLoadingPermissions(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // Only attempt silent refresh on app load if there is an active session indicator.
    // This prevents unauthenticated pages (such as /login) from firing unnecessary
    // refresh requests that result in "No refresh token provided" errors.
    const hasSession = localStorage.getItem('cc_has_session') === 'true';
    if (hasSession) {
      refreshAccessToken();
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchUserPermissions(accessToken);
    }

    const handleWorkspaceUpdated = () => {
      if (accessToken) {
        fetchUserPermissions(accessToken);
      }
    };
    window.addEventListener('workspace-updated', handleWorkspaceUpdated);
    return () => window.removeEventListener('workspace-updated', handleWorkspaceUpdated);
  }, [accessToken, currentWorkspaceId, fetchUserPermissions]);

  const refreshAccessToken = async () => {
    try {
      // Primary authentication mechanism is the HttpOnly refresh_token cookie.
      // Optional request body fallback is supplied if available for cross-origin compatibility.
      const fallbackRefreshToken = localStorage.getItem('cc_refresh_token');
      const bodyPayload = fallbackRefreshToken ? JSON.stringify({ refresh_token: fallbackRefreshToken }) : undefined;
      const headers = fallbackRefreshToken ? { 'Content-Type': 'application/json' } : undefined;

      const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
        method: 'POST',
        headers,
        credentials: 'include', // Sends HttpOnly cookie
        body: bodyPayload
      });
      
      if (response.ok) {
        const data = await response.json();
        handleLoginSuccess(data.access_token, data.refresh_token);
        return data.access_token;
      } else {
        // Refresh token missing, invalid, or expired: cleanly reset auth state
        localStorage.removeItem('cc_has_session');
        localStorage.removeItem('cc_refresh_token');
        setAccessToken(null);
        setUser(null);
        setRole(null);
        setTier(null);
        setCurrentWorkspaceId(null);
        setCurrentWorkspaceName(null);
        setAdminLevel(null);
        setAdminProfileId(null);
        setUserPermissions([]);
        setUserSoftwareModules([]);
        setUserCustomRole(null);
        setIsLoading(false);
        return null;
      }
    } catch (error) {
      console.error("Silent refresh failed:", error);
      localStorage.removeItem('cc_has_session');
      localStorage.removeItem('cc_refresh_token');
      setAccessToken(null);
      setUser(null);
      setIsLoading(false);
      return null;
    }
  };

  const handleLoginSuccess = (token, refreshToken) => {
    if (!token) return;
    setAccessToken(token);
    localStorage.setItem('cc_has_session', 'true');
    if (refreshToken) {
      localStorage.setItem('cc_refresh_token', refreshToken);
    }
    try {
      const decoded = jwtDecode(token);
      setUser({ id: decoded.user_id, email: decoded.email, picture: decoded.picture });
      setRole(decoded.role);
      setTier(decoded.tier);
      setCurrentWorkspaceId(decoded.workspace_id);
      setAdminLevel(decoded.admin_level || null);
      setAdminProfileId(decoded.admin_profile_id || null);
      fetchUserPermissions(token);
    } catch (e) {
      console.error("Invalid token:", e);
    }
    setIsLoading(false);
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout/`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      localStorage.removeItem('cc_has_session');
      localStorage.removeItem('cc_refresh_token');
      setAccessToken(null);
      setUser(null);
      setRole(null);
      setTier(null);
      setCurrentWorkspaceId(null);
      setCurrentWorkspaceName(null);
      setAdminLevel(null);
      setAdminProfileId(null);
      setUserPermissions([]);
      setUserSoftwareModules([]);
      setUserCustomRole(null);
    }
  };

  /**
   * Central permission check helper:
   * hasPermission('SOCIAL_MEDIA_MANAGER', 'POSTS', 'CREATE') -> boolean
   */
  const hasPermission = useCallback((software, feature, action) => {
    if (adminLevel === 'MASTER') {
      return true;
    }
    if (!userPermissions || userPermissions.length === 0) {
      return false;
    }
    return userPermissions.some(p => 
      p.software === software &&
      p.feature === feature &&
      Array.isArray(p.actions) &&
      p.actions.includes(action)
    );
  }, [adminLevel, userPermissions]);

  /**
   * Checks if user has access to at least one feature/action in a software module:
   * hasSoftwareAccess('SOCIAL_MEDIA_MANAGER') -> boolean
   */
  const hasSoftwareAccess = useCallback((software) => {
    if (adminLevel === 'MASTER') {
      return true;
    }
    return userSoftwareModules.includes(software);
  }, [adminLevel, userSoftwareModules]);

  const can = hasPermission;

  return (
    <AuthContext.Provider value={{
      user,
      role,
      tier,
      currentWorkspaceId,
      currentWorkspaceName,
      adminLevel,
      adminProfileId,
      accessToken,
      isLoading,
      isLoadingPermissions,
      userPermissions,
      userSoftwareModules,
      userCustomRole,
      hasPermission,
      hasSoftwareAccess,
      can,
      refetchPermissions: () => fetchUserPermissions(accessToken),
      refreshAccessToken,
      handleLoginSuccess,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

