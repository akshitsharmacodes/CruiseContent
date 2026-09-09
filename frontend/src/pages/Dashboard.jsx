import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingCheck } from '@/hooks/useOnboardingCheck';
import { SOFTWARE_DEFINITIONS } from '@/lib/softwareDefinitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles } from 'lucide-react';

/**
 * Intelligent Client Landing Dispatcher for /dashboard.
 * Automatically resolves and redirects to the first entitled client software module
 * according to canonical SOFTWARE_DEFINITIONS ordering.
 * If no entitled software exists in the active workspace, displays the zero-entitlement state.
 */
export default function Dashboard() {
  useOnboardingCheck();
  const navigate = useNavigate();
  const {
    adminLevel,
    isLoadingPermissions,
    hasSoftwareAccess
  } = useAuth();

  // Determine the first software from the existing canonical SOFTWARE_DEFINITIONS ordering
  const firstAccessibleSoftware = SOFTWARE_DEFINITIONS.find(sw => hasSoftwareAccess(sw.code));

  // 1. Loading State: avoid redirecting prematurely before permissions resolve
  if (isLoadingPermissions) {
    return (
      <div className="space-y-4 p-6 animate-pulse">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  // 2. If at least one entitled client software exists, redirect to it immediately
  if (firstAccessibleSoftware) {
    return <Navigate to={firstAccessibleSoftware.path} replace />;
  }

  // 3. If zero accessible software products in this workspace, preserve/show the no-software state
  return (
    <div className="space-y-8 p-6">
      <Card className="shadow-none border-border bg-card/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Welcome to Your Workspace</CardTitle>
              <CardDescription>
                No software products are currently entitled or assigned to your role in this workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your workspace is active, but does not have any software products enabled yet. Contact your workspace administrator to activate software subscriptions (such as Social Media Manager, WhatsApp Campaigns, AI Calling, or ChatBots) or to assign custom roles.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/pricing')}>
              View Available Plans
            </Button>
            {(adminLevel === 'MASTER' || adminLevel === 'ADMIN') && (
              <Button variant="secondary" onClick={() => navigate('/admin')}>
                Open Admin Console
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
