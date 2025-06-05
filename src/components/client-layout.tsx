'use client';

import { useEffect, useState, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import AppHeader from '@/components/AppHeader';
import BottomNavigation from '@/components/bottom-navigation';
import { CartProvider } from '@/context/CartContext';
import IntroAnimation from '@/components/intro-animation';
import { Loader2, PartyPopper } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation'; // Import usePathname
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import {
  setUserOnlineStatus,
  setUserOfflineStatus,
  updateUserActivity,
  incrementUserLoginCount,
  logUserActivity
} from '@/lib/firebase/firestoreService';

const SESSION_STORAGE_KEY_BOOKING_PENDING_MSG = 'bookingFinalizedForSuccessMessage';
const PENDING_MSG_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoadingIntroState, setIsLoadingIntroState] = useState(true);
  const [showIntroAnimation, setShowIntroAnimation] = useState(true);
  const [introAnimationFinished, setIntroAnimationFinished] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [postWhatsAppSuccessData, setPostWhatsAppSuccessData] = useState<{ name: string } | null>(null);
  const [isPostWhatsAppSuccessDialogOpen, setIsPostWhatsAppSuccessDialogOpen] = useState(false);

  const pathname = usePathname(); // Get the current pathname

  const handleAnimationComplete = useCallback(() => {
    setShowIntroAnimation(false);
    setIntroAnimationFinished(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        setIsLoadingIntroState(false);
        if (!showIntroAnimation) {
            setIntroAnimationFinished(true);
        }
    }, 100); 

    return () => clearTimeout(timer);
  }, [showIntroAnimation]);


  const checkPendingSuccessMessage = useCallback(() => {
    try {
      const pendingMsgDataString = sessionStorage.getItem(SESSION_STORAGE_KEY_BOOKING_PENDING_MSG);
      if (pendingMsgDataString) {
        const pendingMsgData = JSON.parse(pendingMsgDataString);
        if (pendingMsgData && pendingMsgData.name && pendingMsgData.timestamp) {
          const timeSinceBooking = Date.now() - pendingMsgData.timestamp;
          if (timeSinceBooking < PENDING_MSG_TIMEOUT_MS) { 
            setPostWhatsAppSuccessData({ name: pendingMsgData.name });
            setIsPostWhatsAppSuccessDialogOpen(true);
          }
        }
        sessionStorage.removeItem(SESSION_STORAGE_KEY_BOOKING_PENDING_MSG); 
      }
    } catch (error) {
      console.error("Error processing pending success message from sessionStorage:", error);
      sessionStorage.removeItem(SESSION_STORAGE_KEY_BOOKING_PENDING_MSG); 
    }
  }, []);


  useEffect(() => {
    if (introAnimationFinished) {
        checkPendingSuccessMessage();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPendingSuccessMessage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkPendingSuccessMessage);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkPendingSuccessMessage);
    };
  }, [introAnimationFinished, checkPendingSuccessMessage]);

  // --- USER PRESENCE & ACTIVITY TRACKING ---
  useEffect(() => {
    let userId: string | null = null;
    let activityTimeout: NodeJS.Timeout | null = null;
    let isOnline = false;

    // Throttle activity updates to once every 30 seconds
    const ACTIVITY_THROTTLE_MS = 30000;
    const safeUpdateUserActivity = () => {
      if (!userId) return;
      if (activityTimeout) return;
      updateUserActivity(userId).catch(() => {});
      activityTimeout = setTimeout(() => {
        activityTimeout = null;
      }, ACTIVITY_THROTTLE_MS);
    };

    const handleOnline = () => {
      if (userId && !isOnline) {
        setUserOnlineStatus(userId).catch(() => {});
        isOnline = true;
      }
    };
    const handleOffline = () => {
      if (userId && isOnline) {
        setUserOfflineStatus(userId).catch(() => {});
        isOnline = false;
      }
    };

    const setupActivityListeners = () => {
      window.addEventListener('mousemove', safeUpdateUserActivity);
      window.addEventListener('keydown', safeUpdateUserActivity);
      window.addEventListener('scroll', safeUpdateUserActivity);
      window.addEventListener('click', safeUpdateUserActivity);
    };
    const removeActivityListeners = () => {
      window.removeEventListener('mousemove', safeUpdateUserActivity);
      window.removeEventListener('keydown', safeUpdateUserActivity);
      window.removeEventListener('scroll', safeUpdateUserActivity);
      window.removeEventListener('click', safeUpdateUserActivity);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleOffline();
      if (document.visibilityState === 'visible') handleOnline();
    };

    const handleBeforeUnload = () => {
      handleOffline();
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.uid) {
        userId = user.uid;
        try {
          await setUserOnlineStatus(userId);
          isOnline = true;
          await incrementUserLoginCount(userId);
        } catch (e) {}
        setupActivityListeners();
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);
      } else {
        if (userId) {
          setUserOfflineStatus(userId).catch(() => {});
        }
        userId = null;
        isOnline = false;
        removeActivityListeners();
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    });

    return () => {
      if (userId) setUserOfflineStatus(userId).catch(() => {});
      removeActivityListeners();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (activityTimeout) clearTimeout(activityTimeout);
      unsubscribe();
    };
  }, []);

  // --- PAGE VIEW LOGGING ---
  useEffect(() => {
    let ignore = false;
    if (typeof window !== 'undefined') {
      // Get userId from Firebase Auth
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        try {
          const userId = user && user.uid ? user.uid : null;
          const userName = user && user.displayName ? user.displayName : null;
          const userEmail = user && user.email ? user.email : null;
          if (userId && pathname && !ignore) {
            logUserActivity(userId, 'page_view', { page: pathname }, userName, userEmail);
          }
        } catch (e) {
          // Never throw
        }
      });
      return () => {
        ignore = true;
        unsubscribe();
      };
    }
  }, [pathname]);

  if (isLoadingIntroState || (showIntroAnimation && !introAnimationFinished)) {
    return (
      <>
        {showIntroAnimation && <IntroAnimation onAnimationComplete={handleAnimationComplete} />}
        {(isLoadingIntroState && !showIntroAnimation && !introAnimationFinished) && ( 
           <div className="flex items-center justify-center min-h-screen bg-background">
             <Loader2 className="h-12 w-12 animate-spin text-primary" />
           </div>
        )}
      </>
    );
  }

  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen overflow-x-hidden" key={pathname}> {/* Added key={pathname} here */}
        <AppHeader 
          isCartOpen={isCartOpen} 
          onCartOpenChange={setIsCartOpen} 
        />
        <main className="flex-grow pb-20"> 
          {children}
        </main>
        <BottomNavigation 
          onCartIconClick={() => setIsCartOpen(true)} 
        />
        <footer className="w-full bg-gray-50 border-t text-xs text-gray-500 py-3 px-2 text-center">
          © 2024 SBHS. Smart Bharat Health Services (SBHS) is an independent health service platform. <a href="/disclaimer" className="underline hover:text-blue-600 transition">Disclaimer</a>
        </footer>
      </div>
      <Toaster />

      <Dialog open={isPostWhatsAppSuccessDialogOpen} onOpenChange={setIsPostWhatsAppSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl shadow-2xl overflow-hidden p-0">
          <DialogHeader className="bg-gradient-to-br from-primary to-teal-500 p-6 text-center">
            <PartyPopper className="h-16 w-16 text-primary-foreground mx-auto animate-success-icon-pop mb-4" />
            <DialogTitle className="text-2xl font-bold text-primary-foreground">
              Thank You, {postWhatsAppSuccessData?.name || 'Valued Customer'}!
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-3 text-center">
            <DialogDescription className="text-base text-muted-foreground">
              We hope you've sent your booking details via WhatsApp!
            </DialogDescription>
            <p className="text-sm text-muted-foreground">
              Our team will review your request shortly and contact you to confirm the next steps and payment. We appreciate you choosing us!
            </p>
          </div>
          <DialogFooter className="p-4 bg-muted/50">
            <Button onClick={() => setIsPostWhatsAppSuccessDialogOpen(false)} className="w-full">Okay, Got it!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style jsx global>{`
        @keyframes successIconPop {
          0% { transform: scale(0.5) rotate(-15deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(10deg); opacity: 1; }
          70% { transform: scale(0.9) rotate(-5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .animate-success-icon-pop {
          animation: successIconPop 0.7s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards;
        }
      `}</style>
    </CartProvider>
  );
}
