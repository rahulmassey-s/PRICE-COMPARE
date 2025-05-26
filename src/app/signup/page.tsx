
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from '@/lib/firebase/client'; // Ensure this path is correct
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from 'lucide-react';
import { getOrCreateUserDocument } from '@/lib/firebase/firestoreService';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  // Redirect if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/'); // Redirect to homepage if logged in
      } else {
        setIsCheckingAuth(false); // Auth check finished, user is not logged in
      }
    });
    return () => unsubscribe(); // Cleanup subscription
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Signup Failed",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // User document will be created by getOrCreateUserDocument called by onAuthStateChanged in AccountPage or other places
      // For signup, we can proactively create it here if needed for immediate profile setup.
      if (userCredential.user) {
        await getOrCreateUserDocument(userCredential.user);
      }

      toast({
        title: "Signup Successful",
        description: "Account created! Redirecting...",
      });
      // The onAuthStateChanged listener will handle the redirect
    } catch (error: any) {
      let errorMessage = "Signup failed. Please try again.";
      let logErrorToConsole = true;

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email address is already in use.';
          logErrorToConsole = false;
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          logErrorToConsole = false;
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. It should be at least 6 characters.';
          logErrorToConsole = false;
          break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            logErrorToConsole = false;
            break;
        default:
          errorMessage = 'An unexpected error occurred during signup. Please try again later.';
          break;
      }

      if (logErrorToConsole) {
        console.error("Signup error:", error);
      }
      
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 px-4">
      <Card className="w-full max-w-md shadow-2xl rounded-xl">
        <CardHeader className="text-center space-y-2 pt-8">
           <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full p-3 mb-4 shadow-lg mx-auto">
             <UserPlus className="h-6 w-6" />
           </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">Create an Account</CardTitle>
          <CardDescription>Join us to get the best lab test deals!</CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base py-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base py-3"
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="text-base py-3"
              />
            </div>
            <Button type="submit" className="w-full py-3 text-base" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating Account...
                </>
              ) : (
                 <>
                  <UserPlus className="mr-2 h-5 w-5" /> Sign Up
                </>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
