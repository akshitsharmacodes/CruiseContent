import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield
} from 'lucide-react';
import { SOFTWARE_DEFINITIONS } from '@/lib/softwareDefinitions';

export default function ClientSidebar({
  isCollapsed = false,
  setIsCollapsed,
  onNavigate
}) {
  const location = useLocation();
  const {
    currentWorkspaceName,
    role,
    userCustomRole,
    adminLevel,
    hasSoftwareAccess,
    isLoadingPermissions,
    logout
  } = useAuth();

  // Entitled software filtered dynamically via existing authorization system
  const visibleSoftware = SOFTWARE_DEFINITIONS.filter(sw => hasSoftwareAccess(sw.code));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col gap-4 py-4 select-none">
        {/* Workspace Role Header */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-6 py-2 border-b pb-3">
            <div className="overflow-hidden min-w-0 pr-2">
              <h2 className="text-lg font-semibold tracking-tight truncate">
                {currentWorkspaceName || "Workspace"}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {userCustomRole?.name || (adminLevel === 'MASTER' ? "Master Admin" : (role || "Member"))}
              </p>
            </div>
            {setIsCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center p-2 border-b pb-3">
            {setIsCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                title="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Navigation List */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1">

            {/* Software Section Divider */}
            {!isCollapsed && (
              <div className="pt-3 pb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Software Products
              </div>
            )}

            {/* Loading State: avoid authorization flash when permissions are loading */}
            {isLoadingPermissions ? (
              <div className="space-y-2 pt-1 px-1">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ) : visibleSoftware.length === 0 ? (
              !isCollapsed && (
                <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-lg mt-2 mx-1">
                  <p>No software products entitled to your role in this workspace.</p>
                </div>
              )
            ) : (
              visibleSoftware.map((item) => {
                const isItemActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                const softwareItem = (
                  <Link
                    key={item.code}
                    to={item.path}
                    onClick={onNavigate}
                    className={cn(
                      buttonVariants({ variant: isItemActive ? "secondary" : "ghost" }),
                      "w-full justify-start whitespace-nowrap",
                      isItemActive && "bg-muted font-medium",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", !isCollapsed && "mr-2")} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.code}>
                      <TooltipTrigger asChild>{softwareItem}</TooltipTrigger>
                      <TooltipContent side="right">
                        <span>{item.name}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return softwareItem;
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer Area */}
        <div className="mt-auto px-4 border-t pt-3 space-y-1">
          {/* Quick link to Admin Console if user has Master or Admin role */}
          {(adminLevel === 'MASTER' || adminLevel === 'ADMIN') && (
            (() => {
              const adminLinkItem = (
                <Link
                  to="/admin"
                  onClick={onNavigate}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "w-full justify-start text-xs text-muted-foreground hover:text-foreground whitespace-nowrap",
                    isCollapsed && "justify-center px-0"
                  )}
                  title="Admin Console"
                >
                  <Shield className={cn("h-3.5 w-3.5 shrink-0 text-primary", !isCollapsed && "mr-2")} />
                  {!isCollapsed && <span className="truncate">Admin Console</span>}
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key="admin-console">
                    <TooltipTrigger asChild>{adminLinkItem}</TooltipTrigger>
                    <TooltipContent side="right">
                      <span>Admin Console</span>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return adminLinkItem;
            })()
          )}

          {/* Logout Button */}
          {(() => {
            const logoutItem = (
              <Button
                variant="ghost"
                size={isCollapsed ? "icon" : "default"}
                className={cn(
                  "w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10 whitespace-nowrap",
                  isCollapsed && "justify-center px-0"
                )}
                onClick={logout}
                title="Logout"
              >
                <LogOut className={cn("h-4 w-4 shrink-0", !isCollapsed && "mr-2")} />
                {!isCollapsed && <span className="truncate">Logout</span>}
              </Button>
            );

            if (isCollapsed) {
              return (
                <Tooltip key="logout">
                  <TooltipTrigger asChild>{logoutItem}</TooltipTrigger>
                  <TooltipContent side="right">
                    <span>Logout</span>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return logoutItem;
          })()}
        </div>
      </div>
    </TooltipProvider>
  );
}
