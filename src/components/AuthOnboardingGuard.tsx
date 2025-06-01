"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import OnboardingStepper from '@/components/OnboardingStepper';
import { usePathname } from 'next/navigation';

export default function AuthOnboardingGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const onboardingSeen = localStorage.getItem('onboardingSeen');
    if (!onboardingSeen) {
      setShowOnboarding(true);
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsAuthChecked(true);
    });
    return () => unsubscribe();
  }, [isClient]);

  useEffect(() => {
    const isAuthPage = ['/login', '/signup', '/forgot-password'].includes(pathname);
    if (!isLoggedIn && !showOnboarding && !redirected && isClient && isAuthChecked && !isAuthPage) {
      setRedirected(true);
      window.location.href = '/login';
    }
  }, [isLoggedIn, showOnboarding, redirected, isClient, isAuthChecked, pathname]);

  // SSR/CSR hydration fix
  if (!isClient) return null;

  // If on login, signup, or forgot-password page, skip guard and never redirect
  if (['/login','/signup','/forgot-password'].includes(pathname)) {
    return <>{children}</>;
  }

  if (!isAuthChecked) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isLoggedIn) {
    if (showOnboarding) {
      return <OnboardingStepper onFinish={() => {
        localStorage.setItem('onboardingSeen', 'true');
        setShowOnboarding(false);
      }} />;
    }
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return <>{children}</>;
} 