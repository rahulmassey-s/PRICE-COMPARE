
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
