'use client';

import { useEffect, useState, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import AppHeader from '@/components/AppHeader';
import BottomNavigation from '@/components/bottom-navigation';
import { CartProvider } from '@/context/CartContext';
import { Loader2, PartyPopper } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth'; // Import User type
import { auth } from '@/lib/firebase/client';
import {
  setUserOnlineStatus,
  setUserOfflineStatus,
  updateUserActivity,
  incrementUserLoginCount,
  logUserActivity,
  getOrCreateUserDocument,
} from '@/lib/firebase/firestoreService';
import { siteConfig } from '@/config/site';

// Cleaned up: All OneSignal, ForegroundNotificationHandler, and related logic is removed.

const SESSION_STORAGE_KEY_BOOKING_PENDING_MSG = 'bookingFinalizedForSuccessMessage';
const PENDING_MSG_TIMEOUT_MS = 5 * 60 * 1000;

type AuthOnboardingData = {
  view: 'login' | 'signup' | 'forgot-password' | 'otp';
  mobile: string | null;
};

// --- Start: Custom Push Notification Logic ---
const VAPID_SERVER_URL = process.env.NEXT_PUBLIC_VAPID_SERVER_URL || 'http://localhost:4000';

async function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const subscribeToPushNotifications = async (user: User) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return;
  }
  try {
    console.log('[Push] Starting subscription process...');
    const swRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push] Service Worker registered.');
    
    let permission = Notification.permission;
    if (permission === 'default') {
      console.log('[Push] Requesting notification permission...');
      permission = await Notification.requestPermission();
    }
    
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission not granted.');
      return;
    }
    console.log('[Push] Notification permission granted.');
    
    // Unsubscribe from any old subscription to be safe, though the layout cleaner should handle this.
    const existingSubscription = await swRegistration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('[Push] Found existing subscription. Unsubscribing as a safeguard...');
      await existingSubscription.unsubscribe();
      console.log('[Push] Unsubscribed successfully.');
    }

    // Get VAPID key from our server
    const response = await fetch(`${VAPID_SERVER_URL}/vapid-public-key`);
    if (!response.ok) {
        throw new Error('Failed to fetch VAPID public key from server.');
    }
    const vapidPublicKey = await response.text();
    const applicationServerKey = await urlBase64ToUint8Array(vapidPublicKey);

    // Create a new subscription
    const newSubscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    console.log('[Push] New subscription created:', newSubscription);

    // Send the new subscription to our server
    await fetch(`${VAPID_SERVER_URL}/subscribe`, {
      method: 'POST',
      body: JSON.stringify({
        userId: user.uid,
        subscription: newSubscription,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('[Push] Subscription sent to server.');
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
  }
};
// --- End: Custom Push Notification Logic ---


function SplashScreen() {
  const router = useRouter();
  const handleLogoClick = () => {
    router.push('/');
  };
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-cyan-400 to-teal-400 animate-bg-move">
      <button onClick={handleLogoClick} aria-label="Go to Home" className="focus:outline-none">
        <img
          src="/icons/icon-192x192.png"
          alt="App Logo"
          width={110}
          height={110}
          className="mb-6 drop-shadow-xl animate-bounce-in hover:scale-105 transition-transform"
          style={{ animationDelay: '0.2s' }}
        />
      </button>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow mb-2 text-center animate-fade-in" style={{ animationDelay: '0.6s' }}>
        Smart Bharat Health Services
      </h1>
      <p className="text-lg text-white/80 font-medium text-center animate-fade-in" style={{ animationDelay: '1s' }}>
        Finding the best lab test prices for you...
      </p>
      <div className="flex mt-6 gap-1">
        <span className="w-2 h-2 bg-white/80 rounded-full animate-blink"></span>
        <span className="w-2 h-2 bg-white/60 rounded-full animate-blink" style={{ animationDelay: '0.2s' }}></span>
        <span className="w-2 h-2 bg-white/40 rounded-full animate-blink" style={{ animationDelay: '0.4s' }}></span>
      </div>
      <style jsx global>{`
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.7) translateY(40px);}
          60% { opacity: 1; transform: scale(1.1) translateY(-10px);}
          100% { opacity: 1; transform: scale(1) translateY(0);}
        }
        .animate-bounce-in {
          animation: bounceIn 0.8s cubic-bezier(0.68,-0.55,0.27,1.55) both;
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(20px);}
          100% { opacity: 1; transform: translateY(0);}
        }
        .animate-fade-in {
          animation: fadeIn 0.7s ease both;
        }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
        .animate-blink {
          animation: blink 1.4s infinite both;
        }
        @keyframes bgMove {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        .animate-bg-move {
          background-size: 200% 200%;
          animation: bgMove 4s linear infinite alternate;
        }
      `}</style>
    </div>
  );
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoadingIntroState, setIsLoadingIntroState] = useState(true);
  const [showIntroAnimation, setShowIntroAnimation] = useState(true);
  const [introAnimationFinished, setIntroAnimationFinished] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>(siteConfig.logo || '/smart-bharat-logo.png');

  const [postWhatsAppSuccessData, setPostWhatsAppSuccessData] = useState<{ name: string } | null>(null);
  const [isPostWhatsAppSuccessDialogOpen, setIsPostWhatsAppSuccessDialogOpen] = useState(false);

  const pathname = usePathname(); // Get the current pathname

  const [authOnboardingData, setAuthOnboardingData] = useState<AuthOnboardingData | null>(null);

  const handleOpenAuthModal = (initialState: 'login' | 'signup' | 'forgot-password' = 'login') => {
    setAuthOnboardingData({ view: initialState, mobile: null });
  };

  const handleOpenAuthModalWithMobile = (mobile: string) => {
    // Ensure this matches the type definition
    setAuthOnboardingData({ view: 'login', mobile: mobile || null });
  };

  const handleAnimationComplete = useCallback(() => {
    setShowIntroAnimation(false);
    setIntroAnimationFinished(true);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let unsub: (() => void) | undefined;
    async function fetchLogo() {
      try {
        const { db } = await import('@/lib/firebase/client');
        const { doc, onSnapshot } = await import('firebase/firestore');
        const siteSettingsRef = doc(db, 'siteConfiguration', 'main');
        unsub = onSnapshot(siteSettingsRef, (docSnap) => {
          if (docSnap.exists()) {
            const settings = docSnap.data();
            if (settings.logoUrl && typeof settings.logoUrl === 'string' && settings.logoUrl.trim() !== '') {
              setLogoUrl(settings.logoUrl);
            } else {
              setLogoUrl('/smart-bharat-logo.png');
            }
          } else {
            setLogoUrl('/smart-bharat-logo.png');
          }
        });
      } catch (e) {
        setLogoUrl('/smart-bharat-logo.png');
      }
    }
    fetchLogo();
    timer = setTimeout(() => {
        setIsLoadingIntroState(false);
    }, 2500); // 2.5 seconds minimum
    return () => {
      clearTimeout(timer);
      if (unsub) unsub();
    };
  }, []);

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

  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isOnline, setIsOnline] = useState(true);

  // --- Start: New UseEffect for Push Subscription ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in, try to subscribe them to push notifications.
        // The cleaner script in layout.tsx should have already run.
        setTimeout(() => subscribeToPushNotifications(user), 5000); 
      }
    });

    return () => unsubscribe(); // Cleanup on unmount
  }, []);
  // --- End: New UseEffect for Push Subscription ---

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
            logUserActivity(userId, 'page_view', { page: pathname }, userName ?? undefined, userEmail ?? undefined);
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

  // Effect to clean up old PWA service workers from previous versions
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          // Check if there's an active worker and its script URL is not the OneSignal one.
          // This will target old service workers from 'next-pwa' (e.g., sw.js, me.js).
          if (registration.active && !registration.active.scriptURL.includes('OneSignalSDKWorker.js')) {
            registration.unregister().then(unregistered => {
              if (unregistered) {
                console.log(`[SW Cleanup] Unregistered conflicting service worker: ${registration.active?.scriptURL}`);
                // Force a reload to ensure the new service worker takes control immediately.
                window.location.reload();
              }
            });
          }
        }
      }).catch(error => {
        console.error('[SW Cleanup] Error during service worker cleanup:', error);
      });
    }
  }, []);


  if (isLoadingIntroState) {
    return <SplashScreen />;
  }

  return (
    <>
      {/* The OneSignalInit component has been removed from here */}
      <CartProvider>
        <div className="relative flex min-h-screen flex-col bg-background">
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
          {/* ForegroundNotificationHandler has been removed */}
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
    </>
  );
}
