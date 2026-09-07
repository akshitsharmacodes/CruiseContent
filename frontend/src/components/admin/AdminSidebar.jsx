import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  ShieldCheck, 
  CreditCard, 
  Activity,
  LogOut,
  ChevronDown,
  ChevronRight
} from "lucide-react"

export function AdminSidebar() {
  const location = useLocation()
  const { adminLevel, logout } = useAuth()
  
  // Track which dropdowns are open
  const [openDropdowns, setOpenDropdowns] = useState({
    users: location.pathname.startsWith('/admin/users'),
    workspaces: location.pathname.startsWith('/admin/workspaces'),
    admins: location.pathname.startsWith('/admin/admins'),
    plans: location.pathname.startsWith('/admin/plans')
  })

  const toggleDropdown = (key) => {
    setOpenDropdowns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Define navigation structure
  const navigation = [
    {
      key: 'overview',
      title: "Overview",
      href: "/admin",
      icon: LayoutDashboard,
      roles: ["MASTER", "ADMIN"],
      type: 'link'
    },
    {
      key: 'users',
      title: "Users",
      href: "/admin/users",
      icon: Users,
      roles: ["MASTER", "ADMIN"],
      type: 'dropdown',
      children: [
        { label: "All Users", href: "/admin/users", exact: true },
        // Create User is not implemented yet as there is no backend CREATE endpoint 
        // that supports HasAdminPermission(USERS, CREATE).
        // It is omitted from the UI as per "only implement if verified backend endpoint exists"
        // and "do not implement missing APIs".
      ]
    },
    {
      key: 'workspaces',
      title: "Workspaces",
      href: "/admin/workspaces",
      icon: Building2,
      roles: ["MASTER", "ADMIN"],
      type: 'dropdown',
      children: [
        { label: "All Workspaces", href: "/admin/workspaces", exact: true },
        // Create Workspace backend capability does not exist in Phase 6D-2
      ]
    },
    {
      key: 'admins',
      title: "Admins",
      href: "/admin/admins",
      icon: ShieldCheck,
      roles: ["MASTER"],
      type: 'dropdown',
      children: [
        { label: "All Admins", href: "/admin/admins", exact: true },
        // Permission Matrix is integrated inside AdminAdmins.jsx via Sheet
      ]
    },
    {
      key: 'plans',
      title: "Plans",
      href: "/admin/plans",
      icon: CreditCard,
      roles: ["MASTER"],
      type: 'dropdown',
      children: [
        { label: "All Plans", href: "/admin/plans", exact: true },
        // Create Plan is integrated inside AdminPlans.jsx via Dialog
      ]
    },
    {
      key: 'roles',
      title: "Custom Roles",
      href: "/admin/roles",
      icon: ShieldCheck,
      roles: ["MASTER", "ADMIN"],
      type: 'link'
    },
    {
      key: 'audit_logs',
      title: "Audit Logs",
      href: "/admin/audit-logs",
      icon: Activity,
      roles: ["MASTER"], // Hidden from ADMIN because they lack backend capability in the current implementation
      type: 'link'
    },
  ]

  const navItems = navigation.filter((item) => item.roles.includes(adminLevel))

  return (
    <div className="flex h-full flex-col gap-4 py-4">
      <div className="px-6 py-2">
        <h2 className="text-lg font-semibold tracking-tight">Admin Console</h2>
        <p className="text-sm text-muted-foreground">{adminLevel}</p>
      </div>
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isParentActive = location.pathname === item.href || (item.type === 'dropdown' && location.pathname.startsWith(item.href))
            
            if (item.type === 'link') {
              return (
                <Button
                  key={item.href}
                  variant={isParentActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start whitespace-nowrap",
                    isParentActive && "bg-muted font-medium"
                  )}
                  asChild
                >
                  <Link to={item.href} className="flex items-center">
                    <item.icon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </Button>
              )
            }

            // Dropdown type
            const isOpen = openDropdowns[item.key]
            
            return (
              <div key={item.key} className="space-y-1">
                <Button
                  variant={isParentActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-between whitespace-nowrap",
                    isParentActive && "bg-muted font-medium"
                  )}
                  onClick={() => toggleDropdown(item.key)}
                >
                  <div className="flex items-center truncate">
                    <item.icon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                </Button>
                
                {isOpen && (
                  <div className="ml-6 space-y-1 border-l pl-2">
                    {item.children.map(child => {
                      const isChildActive = child.exact 
                        ? location.pathname === child.href 
                        : location.pathname.startsWith(child.href)
                        
                      return (
                        <Button
                          key={child.label}
                          variant={isChildActive ? "secondary" : "ghost"}
                          className={cn(
                            "w-full justify-start h-8 text-sm whitespace-nowrap",
                            isChildActive && "bg-muted/50 font-medium"
                          )}
                          asChild
                        >
                          <Link to={child.href || item.href} className="flex items-center">
                            <span className="truncate">{child.label}</span>
                          </Link>
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
      <div className="mt-auto px-4">
        <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10 whitespace-nowrap" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">Logout</span>
        </Button>
      </div>
    </div>
  )
}
