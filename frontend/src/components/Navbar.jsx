import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Ship, Activity, Plus, ArrowLeft, Menu, X, LogOut, User } from 'lucide-react';
import { motion, useScroll, useSpring, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import WorkspaceSwitcher from './WorkspaceSwitcher';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const isLanding = location.pathname === '/';
  const isAuth = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/auth/callback';
  
  if (isAuth) {
    return null;
  }

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="fixed top-4 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 flex justify-center pointer-events-none">
      <nav className="pointer-events-auto flex flex-col w-full max-w-6xl border border-border/40 bg-background/70 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 transition-all relative overflow-hidden">
        
        {/* Main Navbar Row */}
        <div className="flex items-center justify-between px-6 py-3 w-full">
          <Link to="/" className="outline-none" onClick={closeMobileMenu}>
            <motion.div 
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 cursor-pointer"
            >
              <Ship className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold tracking-tight text-foreground">CruiseContent</span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive border border-destructive/20 ml-2">
                <Activity className="w-3 h-3 mr-1" /> Dev Mode
              </span>
            </motion.div>
          </Link>

          {isLanding && (
            <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-muted-foreground">
              <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
              <a href="#services" className="hover:text-foreground transition-colors">Features</a>
              <a href="#platforms" className="hover:text-foreground transition-colors">Integrations</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            </div>
          )}

          {/* Desktop Right Side Actions */}
          <div className="hidden lg:flex items-center gap-4">
            {isAuth ? (
               <Link to="/">
                  <Button variant="ghost" className="text-sm font-medium">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                  </Button>
               </Link>
            ) : !user ? (
              <>
                <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors text-foreground">
                  Log in
                </Link>
                <Link to="/signup">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5 h-9 shadow-md shadow-primary/25">
                    Start for free
                  </Button>
                </Link>
              </>
            ) : (
              // User is authenticated
              <>
                <div className="w-56 shrink-0 mr-4">
                  <WorkspaceSwitcher />
                </div>
                
                {/* <Link to="/dashboard">
                  <Button variant="outline" className="rounded-full h-9 px-4 shrink-0">
                    <Plus className="w-4 h-4 mr-2" /> Create Post
                  </Button>
                </Link> */}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="cursor-pointer shrink-0"
                    >
                      <Avatar className="h-9 w-9 border-2 border-primary/20 hover:border-primary/50 transition-all">
                        <AvatarImage 
                          src={user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                          referrerPolicy="no-referrer"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </motion.div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="lg:hidden flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden border-t border-border/40 bg-background/50 backdrop-blur-md"
            >
              <div className="flex flex-col gap-4 p-6">
                {isLanding && (
                  <div className="flex flex-col gap-4 text-sm font-medium text-muted-foreground pb-4 border-b border-border/40">
                    <a href="#workflow" onClick={closeMobileMenu} className="hover:text-foreground transition-colors">Workflow</a>
                    <a href="#services" onClick={closeMobileMenu} className="hover:text-foreground transition-colors">Features</a>
                    <a href="#platforms" onClick={closeMobileMenu} className="hover:text-foreground transition-colors">Integrations</a>
                    <a href="#pricing" onClick={closeMobileMenu} className="hover:text-foreground transition-colors">Pricing</a>
                  </div>
                )}
                
                {isAuth ? (
                  <Link to="/" onClick={closeMobileMenu}>
                    <Button variant="ghost" className="w-full justify-start">
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                    </Button>
                  </Link>
                ) : !user ? (
                  <div className="flex flex-col gap-3">
                    <Link to="/login" onClick={closeMobileMenu}>
                      <Button variant="outline" className="w-full">Log in</Button>
                    </Link>
                    <Link to="/signup" onClick={closeMobileMenu}>
                      <Button className="w-full bg-primary text-primary-foreground">Start for free</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 pt-2 mr-6">
                    <div className="w-full">
                      <WorkspaceSwitcher />
                    </div>
                    
                    <Link to="/dashboard" onClick={closeMobileMenu}>
                      <Button variant="outline" className="w-full justify-start rounded-full">
                        <Plus className="w-4 h-4 mr-2" /> Create Post
                      </Button>
                    </Link>
                    
                    <Button variant="ghost" onClick={() => { logout(); closeMobileMenu(); }} className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full mt-2">
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </Button>
                    
                    <Link to="/profile" onClick={closeMobileMenu} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border-2 border-primary/20">
                        <AvatarImage 
                          src={user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">Profile</span>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll Progress Line attached to bottom of floating navbar */}
        {isLanding && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary origin-left"
            style={{ scaleX }}
          />
        )}
      </nav>
    </div>
  );
}
