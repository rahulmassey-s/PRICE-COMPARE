"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import OnboardingStepper from '@/components/OnboardingStepper';
import { usePathname, useRouter } from 'next/navigation'; // Import useRouter
import useAuth from '@/hooks/useAuth';

const publicPaths = ['/auth']; // The new unified auth page

export default function AuthOnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, isOnboardingComplete, isCheckingAuth } = useAuth();
  const pathname = usePathname();
  const router = useRouter(); // Initialize router
  const [isClient, setIsClient] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    // Check if onboarding has been seen
    const onboardingSeen = localStorage.getItem('onboardingSeen');
    if (!onboardingSeen) {
      setShowOnboarding(true);
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsAuthChecked(true);
    });
    return () => unsubscribe();
  }, [isClient]);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    
    if (!user && !isPublicPath) {
      router.replace('/auth');
    } else if (user && !isOnboardingComplete) {
      // Handle onboarding logic if needed in the future
      // For now, we assume login means onboarding is done or not required.
    } else if (user && isPublicPath) {
      router.replace('/');
    }
  }, [user, isOnboardingComplete, isCheckingAuth, pathname, router]);

  // --- Render Logic ---
  if (isCheckingAuth) {
    // Show a loading state until everything is initialized
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  
  // If we are showing the one-time onboarding, render it and nothing else.
  if (showOnboarding) {
      return <OnboardingStepper onFinish={() => {
        localStorage.setItem('onboardingSeen', 'true');
        setShowOnboarding(false);
      }} />;
  }

  // If user is logged in OR on the OTP login page, show the children.
  if (user || publicPaths.some(path => pathname.startsWith(path))) {
      return <>{children}</>;
  }

  // Fallback loading state, should be rare
  return <div className="flex h-screen items-center justify-center">Loading...</div>;
} 