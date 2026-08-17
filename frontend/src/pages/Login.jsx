import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Ship, Loader2 } from 'lucide-react';
import { FaGithub, FaApple } from 'react-icons/fa';
import GoogleSignIn from '@/components/GoogleSignIn';
import AuthCarousel from '@/components/AuthCarousel';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { handleLoginSuccess } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      
      if (response.ok) {
        handleLoginSuccess(data.access_token);
        navigate('/dashboard');
        toast.success("Welcome back!");
      } else {
        toast.error(data.error || "Failed to sign in");
      }
    } catch (error) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex overflow-hidden font-sans">
      
      {/* Left Column - Auth */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center items-center p-8 lg:p-16 z-10">
        
        {/* Header Section */}
        <div className="w-full max-w-[400px] mb-10 text-center">
          <div className="flex justify-center items-center gap-2 mb-8 text-foreground">
            <Ship className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">CruiseContent</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-foreground mb-3" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
            Elevate your workflow
          </h1>
          <p className="text-muted-foreground text-lg">
            Your creative partner for infinite content
          </p>
        </div>

        {/* Auth Box */}
        <Card className="w-full max-w-[400px] border-border bg-card/40 backdrop-blur-sm shadow-2xl rounded-3xl">
          <CardHeader className="pb-6 pt-8 px-6 lg:px-8 space-y-3">
            <GoogleSignIn label="Continue with Google" />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-xl bg-background hover:bg-secondary border-border/50 transition-all text-foreground hover:-translate-y-0.5">
                <FaGithub className="w-5 h-5 mr-2" /> GitHub
              </Button>
              <Button variant="outline" className="h-11 rounded-xl bg-background hover:bg-secondary border-border/50 transition-all text-foreground hover:-translate-y-0.5">
                <FaApple className="w-5 h-5 mr-2" /> Apple
              </Button>
            </div>

            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground rounded-full">or</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-6 lg:px-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring rounded-xl"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring rounded-xl"
                />
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-medium mt-2 transition-colors"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue with email'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-center pb-8 px-6 lg:px-8">
            <div className="text-center w-full pt-2">
              <span className="text-sm text-muted-foreground">Don't have an account? </span>
              <Link to="/signup" className="text-sm text-foreground hover:text-primary hover:underline underline-offset-4 transition-colors">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
        
      </div>

      {/* Right Column - Carousel */}
      <div className="hidden lg:block lg:w-[55%] p-4 pl-0">
        <AuthCarousel />
      </div>
      
    </div>
  );
}

