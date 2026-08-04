import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Ship, Activity, LogOut, Plus, User as UserIcon, ArrowLeft, Settings, Crown } from 'lucide-react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import WorkspaceSwitcher from './WorkspaceSwitcher';


export default function Navbar() {
  const { user, tier, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const isLanding = location.pathname === '/';
  const isAuth = location.pathname === '/login' || location.pathname === '/signup';
  
  return (
    <div className="fixed top-4 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 flex justify-center pointer-events-none">
      <nav className="pointer-events-auto flex items-center justify-between px-6 py-3 w-full max-w-6xl border border-border/40 bg-background/70 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 transition-all relative overflow-hidden">
        
        <Link to="/" className="outline-none">
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
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#services" className="hover:text-foreground transition-colors">Features</a>
            <a href="#platforms" className="hover:text-foreground transition-colors">Integrations</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
        )}

        <div className="flex items-center gap-4">
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
              <div className="w-[200px] hidden md:block">
                <WorkspaceSwitcher />
              </div>
              
              <Link to="/dashboard">
                <Button variant="outline" className="hidden sm:flex rounded-full h-9 px-4">
                  <Plus className="w-4 h-4 mr-2" /> Create Post
                </Button>
              </Link>

              <Link to="/profile">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="cursor-pointer"
                >
                  <Avatar className="h-9 w-9 border-2 border-primary/20 hover:border-primary/50 transition-all">
                    <AvatarImage 
                      src={user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                      referrerPolicy="no-referrer"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              </Link>
            </>
          )}
        </div>

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
