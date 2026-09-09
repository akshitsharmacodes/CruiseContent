import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Share2,
  MessageSquare,
  Webhook,
  PhoneCall,
  Bot,
  FileSearch,
  HeartHandshake,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

const SOFTWARE_DEFINITIONS = [
  {
    code: 'SOCIAL_MEDIA_MANAGER',
    name: 'Social Media Manager',
    path: '/client/social-manager',
    icon: Share2,
    badge: 'Social'
  },
  {
    code: 'WHATSAPP_CAMPAIGN',
    name: 'WhatsApp Campaign',
    path: '/client/whatsapp',
    icon: MessageSquare,
    badge: 'Campaigns'
  },
  {
    code: 'WHATSHOOK',
    name: 'WhatsHook',
    path: '/client/whatshook',
    icon: Webhook,
    badge: 'Webhooks'
  },
  {
    code: 'AI_CALLING',
    name: 'AI Calling',
    path: '/client/ai-calling',
    icon: PhoneCall,
    badge: 'Voice'
  },
  {
    code: 'CHATBOT',
    name: 'ChatBot',
    path: '/client/chatbot',
    icon: Bot,
    badge: 'Automation'
  },
  {
    code: 'DATEXT',
    name: 'Datext',
    path: '/client/datext',
    icon: FileSearch,
    badge: 'Extraction'
  },
  {
    code: 'SHARE_AND_CARE',
    name: 'Share & Care',
    path: '/client/share-care',
    icon: HeartHandshake,
    badge: 'Community'
  }
];

export default function ClientSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { userSoftwareModules, userCustomRole, adminLevel } = useAuth();

  // Filter software definitions by user's effective entitlement + role access (MASTER has all)
  const visibleSoftware = SOFTWARE_DEFINITIONS.filter(sw =>
    adminLevel === 'MASTER' || userSoftwareModules.includes(sw.code)
  );

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 select-none z-30",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Workspace Role Header */}
        <div className="p-3 border-b flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <div className="truncate">
                <p className="text-xs font-semibold truncate">
                  {userCustomRole?.name || (adminLevel === 'MASTER' ? "Master Admin" : "Member")}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {visibleSoftware.length} Software Entitled
                </p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 w-7 ml-auto text-muted-foreground hover:text-foreground"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {/* Main Workspace Dashboard Link */}
          {(() => {
            const isDashboardActive = location.pathname === '/dashboard';
            const dashboardLink = (
              <NavLink
                to="/dashboard"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative",
                  isDashboardActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <LayoutDashboard className={cn("h-4 w-4 shrink-0", isDashboardActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                {!isCollapsed && (
                  <span className="truncate">Dashboard</span>
                )}
              </NavLink>
            );

            if (isCollapsed) {
              return (
                <Tooltip key="dashboard">
                  <TooltipTrigger asChild>
                    {dashboardLink}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
                    <span>Dashboard</span>
                  </TooltipContent>
                </Tooltip>
              );
            }
            return dashboardLink;
          })()}

          {visibleSoftware.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              {!isCollapsed && (
                <p>No software products entitled to your role.</p>
              )}
            </div>
          ) : (
            visibleSoftware.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

              const navLink = (
                <NavLink
                  key={item.code}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isCollapsed && "justify-center px-0"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                  {!isCollapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </NavLink>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.code}>
                    <TooltipTrigger asChild>
                      {navLink}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-2">
                      <span>{item.name}</span>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return navLink;
            })
          )}
        </div>

        {/* Footer info */}
        {!isCollapsed && (
          <div className="p-3 border-t text-[11px] text-muted-foreground text-center">
            <span>SofricAI Platform</span>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
