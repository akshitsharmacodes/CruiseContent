import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * Route guard that checks if the authenticated user has access to a specific software module, feature, or action.
 * If unauthorized, redirects to /403.
 */
export default function SoftwarePermissionRoute({
  software,
  feature,
  action,
  children
}) {
  const { user, isLoading, isLoadingPermissions, hasPermission, hasSoftwareAccess, adminLevel } = useAuth();
  const location = useLocation();

  if (isLoading || isLoadingPermissions) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // MASTER has unrestricted global access across all workspaces, software, and features
  if (adminLevel === 'MASTER') {
    return children;
  }

  // If specific software, feature, and action are specified
  if (software && feature && action) {
    if (!hasPermission(software, feature, action)) {
      return <Navigate to="/403" replace />;
    }
  } else if (software) {
    // If only software is specified, check if user has access to that software
    if (!hasSoftwareAccess(software)) {
      return <Navigate to="/403" replace />;
    }
  }

  return children;
}
