
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from 'firebase/auth'; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from '@/lib/firebase/client'; 
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, Mail, KeyRound, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/'); 
      } else {
        setIsCheckingAuth(false); 
      }
    });
    return () => unsubscribe(); 
  }, [router]);

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoadingEmail(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Login Successful",
        description: "Redirecting to your dashboard...",
      });
      // The onAuthStateChanged listener will handle the redirect
    } catch (error: any) {
      let errorMessage = "Login failed. Please check your credentials and try again.";
      let logErrorToConsole = true;

      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          logErrorToConsole = false;
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': 
          errorMessage = 'Invalid email or password. Please try again.';
          logErrorToConsole = false;
          break;
        case 'auth/too-many-requests':
           errorMessage = 'Access temporarily disabled due to too many failed login attempts. Please reset your password or try again later.';
           logErrorToConsole = false; 
           break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            logErrorToConsole = false; 
            break;
        default:
          // For unexpected errors, we might still want to log them in development
          // or if specific logging for unknown errors is desired in production.
          // For now, let's assume generic message is enough for user.
          errorMessage = 'An unexpected error occurred. Please try again later.';
          break; 
      }
      
      if (logErrorToConsole && process.env.NODE_ENV === 'development') { 
        console.error("Login error details (dev only):", error); 
      } else if (logErrorToConsole && process.env.NODE_ENV !== 'development' && error.code !== 'auth/invalid-credential' && error.code !== 'auth/user-not-found' && error.code !== 'auth/wrong-password' && error.code !== 'auth/invalid-email' && error.code !== 'auth/too-many-requests' && error.code !== 'auth/network-request-failed') {
        // Log unexpected errors in production
        console.error("Login error (unexpected):", error.code, error.message);
      }

      toast({
        title: "Login Failed",
        description: errorMessage, 
        variant: "destructive",
      });
    } finally {
      setIsLoadingEmail(false);
    }
  };
  
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-slate-50 to-secondary/5 p-4 selection:bg-primary/20 selection:text-primary">
      <Card className="w-full max-w-md shadow-2xl rounded-xl overflow-hidden transform transition-all hover:scale-[1.01] duration-300 ease-in-out">
        <CardHeader className="text-center space-y-3 p-6 sm:p-8 bg-gradient-to-b from-primary/10 to-transparent">
           <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full p-4 mb-3 shadow-lg mx-auto ring-4 ring-primary/20">
             <LogIn className="h-8 w-8" />
           </div>
          <CardTitle className="text-3xl sm:text-4xl font-bold text-foreground">Welcome Back!</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Securely access your lab services account.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground flex items-center">
                <Mail className="mr-2.5 h-5 w-5 text-primary/80" /> Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base py-3 px-4 rounded-lg border-border focus:ring-2 focus:ring-primary focus:border-primary transition-shadow duration-200 shadow-sm hover:shadow-md"
                disabled={isLoadingEmail}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground flex items-center">
                <KeyRound className="mr-2.5 h-5 w-5 text-primary/80" /> Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base py-3 px-4 rounded-lg border-border focus:ring-2 focus:ring-primary focus:border-primary transition-shadow duration-200 shadow-sm hover:shadow-md"
                disabled={isLoadingEmail}
              />
            </div>
            <div className="text-right text-sm mt-2">
              <Link href="/forgot-password" className="font-medium text-primary hover:underline hover:text-primary/80 transition-colors">
                  Forgot Password?
              </Link>
            </div>
            <Button 
              type="submit" 
              className="w-full py-3.5 text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-0.5 active:scale-[0.98]" 
              disabled={isLoadingEmail}
            >
              {isLoadingEmail ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Logging In...
                </>
              ) : (
                <>
                 <LogIn className="mr-2 h-5 w-5"/> Secure Login
                </>
              )}
            </Button>
          </form>
          <div className="mt-8 text-center text-sm">
            <p className="text-muted-foreground">
              New to our lab services?{' '}
              <Link href="/signup" className="font-semibold text-primary hover:underline hover:text-primary/80 transition-colors">
                Create an Account
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
    
