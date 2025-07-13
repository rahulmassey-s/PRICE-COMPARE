'use client';

import { useEffect, useState, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import AppHeader from '@/components/AppHeader';
import BottomNavigation from '@/components/bottom-navigation';
import { CartProvider } from '@/context/CartContext';
import { Loader2, PartyPopper } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from 'next/navigation'; // Import usePathname and useRouter
import { onAuthStateChanged } from 'firebase/auth';
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
import ForegroundNotificationHandler from '@/components/ForegroundNotificationHandler';
// The OneSignalInit component is no longer needed, so we remove the dynamic import.
// import dynamic from 'next/dynamic';

// const OneSignalInit = dynamic(() => import('@/components/OneSignalInit'), {
//   ssr: false,
// });

const SESSION_STORAGE_KEY_BOOKING_PENDING_MSG = 'bookingFinalizedForSuccessMessage';
const PENDING_MSG_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Define the type for auth modal state
type AuthOnboardingData = {
  view: 'login' | 'signup' | 'forgot-password' | 'otp';
  mobile: string | null; // Keep it simple: string or null
};

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
  // useOneSignalSync(); // ❌ REMOVED: This hook was causing a conflict by re-initializing OneSignal.
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

  // --- OneSignal SDK Initialization and User Identification ---
  const initializeAndIdentifyOneSignal = useCallback(async (user: any) => {
    // Guard to ensure this only runs on the client
    if (typeof window === 'undefined' || !window.OneSignal) {
        // First, load the script if it doesn't exist
        if (!document.getElementById('onesignal-sdk-script')) {
            console.log('[OneSignal] Loading SDK script...');
            const script = document.createElement('script');
            script.id = 'onesignal-sdk-script';
            script.src = "https://cdn.onesignal.com/sdks/OneSignalSDK.js";
            script.async = true;
            document.head.appendChild(script);

            script.onload = () => {
                console.log('[OneSignal] SDK script loaded. Re-running identification.');
                initializeAndIdentifyOneSignal(user); // Re-run this function once the script is loaded
            };
            return; // Exit for now, the onload will trigger the logic again
        }
        // If the script is there but window.OneSignal isn't ready, wait a bit and retry.
        // This can happen due to race conditions.
        setTimeout(() => initializeAndIdentifyOneSignal(user), 1000);
        return;
    }

    window.OneSignal.push(async () => {
        const isInitialized = await window.OneSignal.isInitialized();
        if (!isInitialized) {
            console.log('[OneSignal] Initializing SDK...');
            await window.OneSignal.init({
                appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
                subdomainName: process.env.NEXT_PUBLIC_ONESIGNAL_SUBDOMAIN_NAME,
                allowLocalhostAsSecureOrigin: true,
            });
        }
        
        console.log(`[OneSignal] Now processing user: ${user ? user.uid : 'Logged Out'}`);

        if (user && user.uid) {
            const externalId = await window.OneSignal.getExternalUserId();
            if (externalId !== user.uid) {
                console.log(`[OneSignal] User detected. Identifying as ${user.uid}`);
                await window.OneSignal.setExternalUserId(user.uid);
                
                const profile = await getOrCreateUserDocument(user);
                if (profile) {
                    const tags = {
                        name: profile.displayName || '',
                        mobile: profile.phoneNumber || '',
                        user_type: profile.role === 'member' ? 'member' : 'non-member',
                    };
                    await window.OneSignal.sendTags(tags);
                    console.log('[OneSignal] User tags sent:', tags);
                }
            } else {
                console.log(`[OneSignal] User ${user.uid} is already identified.`);
            }
        } else {
            const externalId = await window.OneSignal.getExternalUserId();
            if (externalId) {
                console.log('[OneSignal] User logged out. Removing external user ID.');
                await window.OneSignal.removeExternalUserId();
            }
        }
    });
  }, []);


  // --- USER AUTHENTICATION LISTENER ---
  // This now also handles OneSignal identification.
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
      // Initialize or identify the user with OneSignal
      initializeAndIdentifyOneSignal(user);

      if (user) {
        userId = user.uid;
        setUserOnlineStatus(userId).catch(() => {});
        incrementUserLoginCount(userId).catch(() => {});
        isOnline = true;
        setupActivityListeners();
        safeUpdateUserActivity(); // Initial update
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Fetch user document for logging
        try {
          const userDoc = await getOrCreateUserDocument(user);
          console.log('[DEBUG] Profile received from Firestore:', userDoc); // Debug log
          logUserActivity(
            user.uid,
            'session_start',
            { userAgent: navigator.userAgent },
            user.displayName ?? undefined,
            user.email ?? undefined
          );
        } catch (error) {
          console.error('[DEBUG] Failed to process user for logging:', error);
        }
      } else {
        if (userId) {
          setUserOfflineStatus(userId).catch(() => {});
        }
        userId = null;
        isOnline = false;
        removeActivityListeners();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    });

    return () => {
      unsubscribe();
      if (userId) setUserOfflineStatus(userId).catch(() => {});
      removeActivityListeners();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (activityTimeout) clearTimeout(activityTimeout);
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
          <ForegroundNotificationHandler />
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
