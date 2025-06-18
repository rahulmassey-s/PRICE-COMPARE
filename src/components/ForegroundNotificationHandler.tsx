"use client";

import { useEffect } from 'react';
import { onMessageListener } from '@/lib/firebase-messaging';
import { useToast } from "@/hooks/use-toast";

const ForegroundNotificationHandler = () => {
  const { toast } = useToast();

  const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  useEffect(() => {
    const unsubscribe = onMessageListener()
      .then((payload: any) => {
        if (isDev) console.log('Foreground message received:', payload);

        // --- Create and dispatch a custom event ---
        // This allows other components (like AppHeader) to listen for new notifications
        const newNotificationEvent = new CustomEvent('new-notification', {
          detail: payload.data, 
        });
        window.dispatchEvent(newNotificationEvent);
        
        // --- Show a toast notification ---
        toast({
          title: payload.data.title || "New Notification",
          description: payload.data.body || "You have a new update.",
          variant: 'default',
        });
      })
      .catch((err: any) => console.error('Failed to listen for foreground messages:', err));

    // The onMessageListener promise resolves only once. This setup is for a persistent listener.
    // A more robust solution might use a callback-based onMessageListener.
    // For now, this handles the first foreground message received after component mounts.

    return () => {
      // In a real implementation with a persistent listener, you'd unsubscribe here.
    };
  }, [toast]);

  return null; // This component does not render anything.
};

export default ForegroundNotificationHandler; 