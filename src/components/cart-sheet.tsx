
'use client';

import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Trash2, ShoppingCart, Info, MessageSquare, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { contactDetailsData } from '@/data/app-data';
import { auth } from '@/lib/firebase/client';
import { createBooking, getOrCreateUserDocument } from '@/lib/firebase/firestoreService';
import type { UserDetails } from '@/types';
import { useState, useEffect, useRef } from 'react'; // Added useEffect and useRef

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SESSION_STORAGE_KEY_BOOKING_PENDING_MSG = 'bookingFinalizedForSuccessMessage';

export default function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const { items, removeFromCart, clearCart } = useCart();
  const { toast } = useToast();
  const [isBooking, setIsBooking] = useState(false);

  const mounted = useRef(true); // Ref to track if component is mounted

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; // Set to false when component unmounts
    };
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const originalTotal = items.reduce((sum, item) => {
    const original = item.originalPrice ?? item.price;
    return sum + original * item.quantity;
  }, 0);
  const savings = originalTotal - subtotal;

  const handleProceedToBook = async () => {
    if (items.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to your cart before proceeding.",
        variant: "destructive",
      });
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "Please log in to proceed with your booking.",
        variant: "destructive",
      });
      if (mounted.current) {
        onOpenChange(false);
      }
      return;
    }

    setIsBooking(true);

    try {
      const userDoc = await getOrCreateUserDocument(currentUser);
      if (!mounted.current) return; // Check mounted state after await

      const bookingUserDetails: { displayName: string | null; phoneNumber: string | null } = {
        displayName: userDoc?.displayName ?? currentUser.displayName ?? null,
        phoneNumber: userDoc?.phoneNumber ?? currentUser.phoneNumber ?? null,
      };

      const bookingId = await createBooking(
        currentUser,
        items.map(item => ({
            testId: item.testDocId,
            testName: item.testName,
            testImageUrl: item.testImageUrl ?? null,
            labName: item.labName,
            price: item.price,
            originalPrice: item.originalPrice ?? null,
        })),
        subtotal,
        savings,
        bookingUserDetails
      );
      if (!mounted.current) return; // Check mounted state after await

      if (bookingId) {
        const customerName = bookingUserDetails.displayName?.split(' ')[0] || currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0] || "Valued Customer";

        let message = `Hello Lab Price Compare Team,\n\nI would like to confirm my booking.\n\n`;
        message += `👤 *Name:* ${bookingUserDetails.displayName || 'N/A'}\n`;
        if (bookingUserDetails.phoneNumber) {
          message += `📞 *Phone:* ${bookingUserDetails.phoneNumber}\n`;
        }
        if (currentUser.email) {
           message += `📧 *Email:* ${currentUser.email}\n`;
        }
        message += `🆔 *Booking ID:* ${bookingId}\n\n`;
        message += `📝 *Booked Tests:*\n`;
        items.forEach(item => {
          message += `  - ${item.testName} (${item.labName}) - ₹${item.price.toFixed(2)}\n`;
        });
        message += `\n💰 *Total Amount:* ₹${subtotal.toFixed(2)}\n`;
        if (savings > 0) {
          message += `🎉 *You Saved:* ₹${savings.toFixed(2)}\n`;
        }
        message += `\nPlease confirm my booking and let me know the next steps.\n\nThank you!`;

        const whatsappUrl = `https://wa.me/${contactDetailsData.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        
        sessionStorage.setItem(SESSION_STORAGE_KEY_BOOKING_PENDING_MSG, JSON.stringify({ 
          name: customerName, 
          timestamp: Date.now() 
        }));

        window.open(whatsappUrl, '_blank'); 
        clearCart(); 
        if (mounted.current) {
          onOpenChange(false); 
        }

      } else {
        throw new Error("Failed to save booking to database.");
      }
    } catch (error: any) {
      if (!mounted.current) return; // Check mounted state in catch block
      console.error("Booking process error:", error);
      let description = "Could not process your booking. Please try again.";
       if (error.name === 'FirebaseError' && error.code === 'unavailable') {
        description = 'Booking failed: Connection to our servers failed. Please check your internet connection and try again.';
      } else if (error.message && error.message.includes("Booking data contains undefined")) {
        description = `Booking failed: ${error.message} Please ensure all test items have required details.`;
      }
      toast({
        title: "Booking Failed",
        description: description,
        variant: "destructive",
      });
    } finally {
      if (mounted.current) { // Check mounted state in finally block
        setIsBooking(false);
      }
    }
  };


  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center text-lg">
              <ShoppingCart className="mr-2 h-5 w-5" /> Your Cart
            </SheetTitle>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-foreground">Your cart is empty</p>
              <p className="text-muted-foreground">Add some tests to get started!</p>
              <SheetClose asChild>
                  <Button variant="link" className="mt-4 text-primary">Continue Shopping</Button>
              </SheetClose>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-grow [&>div]:p-4">
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={`${item.testDocId}-${item.labName}`} className="flex items-start gap-4 p-3 border rounded-lg shadow-sm bg-card">
                      <div className="relative h-16 w-16 rounded-md overflow-hidden border bg-muted shrink-0">
                        <Image
                          src={item.testImageUrl || `https://placehold.co/80x80.png`}
                          alt={item.testName}
                          fill
                          style={{ objectFit: "cover" }}
                          data-ai-hint="medical test small"
                        />
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-semibold text-sm text-foreground">{item.testName}</h3>
                        <p className="text-xs text-muted-foreground">{item.labName}</p>
                        <div className="flex items-center mt-1">
                          <span className="font-bold text-primary text-sm">₹{item.price.toFixed(2)}</span>
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="ml-2 text-xs text-muted-foreground line-through">
                              ₹{item.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                        onClick={() => {
                          removeFromCart(item.testDocId, item.labName);
                          toast({ title: "Item Removed", description: `${item.testName} from ${item.labName} removed from cart.` });
                        }}
                        disabled={isBooking}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove item</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <SheetFooter className="p-4 border-t bg-background sticky bottom-0">
                <div className="w-full space-y-3">
                  <div className="flex justify-between text-sm font-medium text-foreground">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>You Save</span>
                      <span>₹{savings.toFixed(2)}</span>
                    </div>
                  )}
                   <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Total MRP</span>
                      <span>₹{originalTotal.toFixed(2)}</span>
                    </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold text-foreground">
                    <span>Grand Total</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <Button
                    size="lg"
                    className="w-full mt-2 py-3 text-base"
                    onClick={handleProceedToBook}
                    disabled={isBooking}
                  >
                    {isBooking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageSquare size={18} className="mr-2" />}
                    {isBooking ? 'Processing...' : 'Book & Confirm via WhatsApp'}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      if (!isBooking) clearCart();
                    }}
                    disabled={isBooking}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Cart
                  </Button>
                   <div className="text-xs text-muted-foreground mt-2 text-center p-2 border border-dashed rounded-md bg-secondary/30">
                    <Info size={14} className="inline mr-1 mb-0.5" />
                    Your booking request will be saved. Click 'Book & Confirm via WhatsApp' to finalize with our team.
                  </div>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
