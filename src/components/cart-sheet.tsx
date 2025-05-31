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
import { createBooking, getOrCreateUserDocument, redeemPoints } from '@/lib/firebase/firestoreService';
import type { UserDetails } from '@/types';
import { useState, useEffect, useRef } from 'react'; // Added useEffect and useRef
import { addDays, format, isToday, isTomorrow } from 'date-fns';
import React, { forwardRef } from 'react';

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SESSION_STORAGE_KEY_BOOKING_PENDING_MSG = 'bookingFinalizedForSuccessMessage';

// Custom input for DatePicker to prevent auto-focus/auto-open bug
const CustomDateInput = forwardRef<HTMLInputElement, any>(({ value, onClick, placeholder, disabled, ...props }, ref) => (
  <input
    ref={ref}
    value={value || ''}
    onClick={onClick}
    placeholder={placeholder}
    disabled={disabled}
    readOnly
    className="w-full rounded-lg border-2 border-blue-200 focus:border-blue-500 bg-white dark:bg-blue-950 text-blue-900 dark:text-blue-100 px-3 py-2 text-sm font-medium shadow-sm transition-all duration-200 cursor-pointer"
    style={{ background: disabled ? '#f3f4f6' : undefined }}
    {...props}
  />
));
CustomDateInput.displayName = 'CustomDateInput';

const TIME_SLOTS = [
  { start: '06:00', end: '07:00' },
  { start: '07:00', end: '08:00' },
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '09:30', end: '10:30' },
  { start: '10:00', end: '11:00' },
  { start: '10:30', end: '11:30' },
  { start: '11:00', end: '12:00' },
  { start: '11:30', end: '12:30' },
  { start: '12:00', end: '13:00' },
  { start: '12:30', end: '13:30' },
];

function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
}

export default function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const { items, removeFromCart, clearCart, updateAppointmentDateTime, cartAppointmentDateTime, setCartAppointmentDateTime } = useCart();
  const { toast } = useToast();
  const [isBooking, setIsBooking] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [redeemError, setRedeemError] = useState('');
  const [userRole, setUserRole] = useState<'member' | 'non-member' | 'admin'>('non-member');

  const mounted = useRef(true); // Ref to track if component is mounted

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; // Set to false when component unmounts
    };
  }, []);

  // Fetch user points and role on open
  useEffect(() => {
    if (!open) return;
    const currentUser = auth.currentUser;
    if (currentUser) {
      getOrCreateUserDocument(currentUser).then(userDoc => {
        setUserPoints(userDoc?.pointsBalance || 0);
        setUserRole(userDoc?.role || 'non-member');
      });
    } else {
      setUserPoints(0);
      setUserRole('non-member');
    }
    setPointsToRedeem(0);
    setRedeemError('');
  }, [open]);

  // Calculate subtotal and member discount using memberPrice if available
  const subtotal = items.reduce((sum, item) => {
    if (userRole === 'member' && typeof item.memberPrice === 'number' && item.memberPrice > 0) {
      return sum + item.memberPrice * item.quantity;
    }
    return sum + item.price * item.quantity;
  }, 0);

  const originalTotal = items.reduce((sum, item) => {
    const original = item.originalPrice ?? (item.nonMemberPrice ?? item.price);
    return sum + original * item.quantity;
  }, 0);

  // Calculate member savings (total non-member price - member price)
  const nonMemberSubtotal = items.reduce((sum, item) => sum + (item.nonMemberPrice ?? item.price) * item.quantity, 0);
  const memberSavings = userRole === 'member' ? nonMemberSubtotal - subtotal : 0;

  // Calculate discount from points
  const pointsValue = 10; // 10 points = ₹1 (configurable)
  const maxRedeemable = Math.min(userPoints, Math.floor(subtotal * pointsValue));
  const redeemDiscount = pointsToRedeem > 0 ? (pointsToRedeem / pointsValue) : 0;
  const finalTotal = Math.max(0, subtotal - redeemDiscount);

  // --- Always calculate total savings as originalTotal - finalTotal ---
  const totalSavings = originalTotal - finalTotal;

  const handleProceedToBook = async () => {
    if (items.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to your cart before proceeding.",
        variant: "destructive",
      });
      return;
    }

    // --- Require date & time slot selection ---
    if (!cartAppointmentDateTime) {
      toast({
        title: "Select Date & Time",
        description: "Please select both date and time slot for sample collection.",
        variant: "destructive",
      });
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(cartAppointmentDateTime);
    } catch (e) {}
    if (!parsed || !parsed.date || !parsed.slot) {
      toast({
        title: "Select Date & Time",
        description: "Please select both date and time slot for sample collection.",
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
      if (!mounted.current) return;

      const bookingUserDetails: { displayName: string | null; phoneNumber: string | null } = {
        displayName: userDoc?.displayName ?? currentUser.displayName ?? null,
        phoneNumber: userDoc?.phoneNumber ?? currentUser.phoneNumber ?? null,
      };

      // --- Redeem points if any ---
      let redeemed = false;
      if (pointsToRedeem > 0) {
        if (pointsToRedeem > userPoints) throw new Error('You do not have enough points.');
        if (pointsToRedeem % 10 !== 0) throw new Error('Points must be in multiples of 10.');
        if (pointsToRedeem < 10) throw new Error('Minimum 10 points required to redeem.');
        await redeemPoints(currentUser.uid, pointsToRedeem);
        redeemed = true;
        setUserPoints(userPoints - pointsToRedeem);
      }

      // --- Ensure appointmentDateTime is set for each item from cartAppointmentDateTime ---
      console.log("cartAppointmentDateTime", cartAppointmentDateTime);
      console.log("items before mapping", items);
      let itemsWithDateTime = items.map(item => {
        if (item.appointmentDateTime) return item;
        if (cartAppointmentDateTime) {
          try {
            const parsed = JSON.parse(cartAppointmentDateTime);
            if (parsed.date && parsed.slot) {
              // Slot format: "6:00 AM - 7:00 AM" or "06:00 - 07:00"
              let startTime = parsed.slot.split(' - ')[0];
              // If AM/PM present, parse accordingly
              let dateTimeStr;
              if (/am|pm/i.test(startTime)) {
                // 12-hour format
                const [time, ampm] = startTime.split(' ');
                let [hour, minute] = time.split(':');
                hour = parseInt(hour, 10);
                minute = minute || '00';
                if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
                if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
                dateTimeStr = `${parsed.date}T${hour.toString().padStart(2, '0')}:${minute}:00`;
              } else {
                // 24-hour format
                dateTimeStr = `${parsed.date}T${startTime}:00`;
              }
              const isoString = new Date(dateTimeStr).toISOString();
              return { ...item, appointmentDateTime: isoString };
            }
          } catch (e) { console.error("Error parsing cartAppointmentDateTime", e); }
        }
        return item;
      });
      console.log("itemsWithDateTime", itemsWithDateTime);

      const bookingId = await createBooking(
        currentUser,
        itemsWithDateTime.map(item => ({
            testId: item.testDocId,
            testName: item.testName,
            testImageUrl: item.testImageUrl ?? null,
            labName: item.labName,
            price: item.price,
            originalPrice: item.originalPrice ?? null,
            appointmentDateTime: item.appointmentDateTime ?? null,
        })),
        finalTotal,
        totalSavings,
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
          if (item.appointmentDateTime) {
            const dt = new Date(item.appointmentDateTime);
            const dateStr = dt.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
            const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            message += `    🗓 ${dateStr} ${timeStr}\n`;
          }
        });
        message += `\n💰 *Total Amount:* ₹${finalTotal.toFixed(2)}\n`;
        if (memberSavings > 0) {
          message += `🎉 *You Saved:* ₹${memberSavings.toFixed(2)}\n`;
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

        if (redeemed) {
          toast({ title: 'Points Redeemed', description: `You redeemed ${pointsToRedeem} points (₹${redeemDiscount.toFixed(2)})!`, variant: 'success' });
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
      setRedeemError(error.message || 'Could not redeem points.');
    } finally {
      if (mounted.current) { // Check mounted state in finally block
        setIsBooking(false);
      }
    }
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-[90vh] max-h-[90vh] w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b flex-shrink-0">
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
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Single Date & Time Slot Picker for the whole cart */}
            <div className="p-4 border-b bg-white z-10 flex-shrink-0">
              <div className="mb-2 font-semibold text-blue-900 dark:text-blue-200 text-xs">Select date & time slot for sample collection</div>
              {/* Slot Picker UI (reuse previous logic, but use cartAppointmentDateTime and setCartAppointmentDateTime) */}
              {/* Date selector */}
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {getNext7Days().map((day) => {
                  const label = isToday(day)
                    ? 'Today'
                    : isTomorrow(day)
                    ? 'Tomorrow'
                    : format(day, 'd MMM');
                  const isSelected = cartAppointmentDateTime && JSON.parse(cartAppointmentDateTime).date === format(day, 'yyyy-MM-dd');
                  return (
                    <button
                      key={format(day, 'yyyy-MM-dd')}
                      className={`min-w-[80px] px-3 py-2 rounded-lg border text-center font-bold text-sm transition-all duration-150 ${isSelected ? 'bg-blue-100 border-blue-500 text-blue-900 shadow' : 'bg-white border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                      onClick={() => {
                        setCartAppointmentDateTime(JSON.stringify({ date: format(day, 'yyyy-MM-dd'), slot: null }));
                      }}
                      type="button"
                    >
                      <div>{format(day, 'd MMM')}</div>
                      <div className="text-xs font-medium text-blue-600">{label}</div>
                    </button>
                  );
                })}
              </div>
              {/* Time slot selector */}
              <div className="font-semibold text-blue-900 dark:text-blue-200 text-xs mt-2 mb-1">Select time slot</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TIME_SLOTS.map((slot) => {
                  const slotLabel = `${format(new Date(`1970-01-01T${slot.start}:00`), 'h:mm a')} - ${format(new Date(`1970-01-01T${slot.end}:00`), 'h:mm a')}`;
                  const isSelected = cartAppointmentDateTime && JSON.parse(cartAppointmentDateTime).slot === slotLabel;
                  const selectedDate = cartAppointmentDateTime ? JSON.parse(cartAppointmentDateTime).date : null;
                  return (
                    <button
                      key={slotLabel}
                      className={`px-2 py-2 rounded-lg border text-center text-xs font-semibold transition-all duration-150 ${isSelected ? 'bg-green-100 border-green-500 text-green-900 shadow' : 'bg-white border-gray-200 text-gray-700 hover:bg-green-50'}`}
                      onClick={() => {
                        if (!selectedDate) return;
                        setCartAppointmentDateTime(JSON.stringify({ date: selectedDate, slot: slotLabel }));
                      }}
                      type="button"
                      disabled={!selectedDate}
                    >
                      {slotLabel}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">Choose your preferred date & time slot for sample collection.</span>
              {cartAppointmentDateTime && JSON.parse(cartAppointmentDateTime).date && JSON.parse(cartAppointmentDateTime).slot && (
                <div className="mt-2 text-xs text-green-700 font-semibold">Selected: {format(new Date(JSON.parse(cartAppointmentDateTime).date), 'd MMM, yyyy')} | {JSON.parse(cartAppointmentDateTime).slot}</div>
              )}
            </div>
            {/* Cart Items always visible below */}
            <div className="space-y-4 p-4 border-b bg-white z-10 flex-shrink-0">
              {items.map((item) => (
                <div key={`${item.testDocId}-${item.labName}`} className="flex flex-col gap-2 p-3 border rounded-lg shadow-sm bg-card">
                  <div className="flex items-start gap-4">
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
                        {userRole === 'member' && typeof item.memberPrice === 'number' && item.memberPrice > 0 ? (
                          <span className="font-bold text-green-700 text-sm flex items-center">
                            <svg className="h-4 w-4 text-yellow-500 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ₹{item.memberPrice.toFixed(2)}
                            <span className="ml-2 text-xs text-muted-foreground line-through">₹{item.price.toFixed(2)}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-primary text-sm">₹{item.price.toFixed(2)}</span>
                        )}
                        {item.originalPrice && item.originalPrice > (userRole === 'member' && typeof item.memberPrice === 'number' && item.memberPrice > 0 ? item.memberPrice : item.price) && (
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
                </div>
              ))}
            </div>
            {/* Summary, wallet points, totals below */}
            <div className="p-4 w-full space-y-3 bg-green-100">
              {/* Member Discount Banner */}
              {userRole === 'member' && memberSavings > 0 && (
                <div className="border rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 mb-2 shadow" style={{ borderColor: '#bfa100', background: '#fffbe6', color: '#bfa100' }}>
                  <svg className="w-5 h-5" style={{ color: '#bfa100' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <span className="font-bold flex items-center gap-1" style={{ color: '#bfa100' }}><span className="mr-1">Crown Member Price</span> <span style={{ color: '#bfa100', fontWeight: 800 }}>You Saved ₹{memberSavings.toFixed(2)}</span></span>
                </div>
              )}
              {/* Wallet Points Redemption UI - Modern Enhanced */}
              {userPoints > 0 && (
                <div className="border rounded-xl p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 shadow-md mb-2 transition-all duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-blue-900 dark:text-blue-100 text-base flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 17v.01" /></svg>
                      Wallet Points
                    </span>
                    <span className="font-extrabold text-blue-800 dark:text-blue-200 text-lg">{userPoints} pts</span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
                    <input
                      type="number"
                      min={0}
                      max={maxRedeemable}
                      step={10}
                      value={pointsToRedeem}
                      onChange={e => {
                        let val = parseInt(e.target.value, 10) || 0;
                        if (val > maxRedeemable) val = maxRedeemable;
                        if (val < 0) val = 0;
                        setPointsToRedeem(val);
                        setRedeemError('');
                      }}
                      className="border-2 border-blue-300 focus:border-blue-500 rounded-lg px-3 py-2 w-28 text-right font-semibold text-blue-900 bg-white dark:bg-blue-950 dark:text-blue-100 transition-all duration-200 shadow-sm"
                      disabled={isBooking}
                    />
                    <span className="text-xs text-blue-700 dark:text-blue-200 font-medium">(10 pts = ₹1)</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2 border-blue-400 text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
                      onClick={() => setPointsToRedeem(maxRedeemable)}
                      disabled={isBooking || maxRedeemable === 0}
                    >
                      Max
                    </Button>
                  </div>
                  {redeemError && <div className="text-xs text-red-600 mt-1 animate-pulse">{redeemError}</div>}
                  {pointsToRedeem > 0 && (
                    <div className="mt-2 flex flex-col gap-1 animate-fade-in">
                      <div className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2l4 -4" /></svg>
                        Redeem: <span className="font-bold">-₹{redeemDiscount.toFixed(2)}</span>
                      </div>
                      <div className="text-sm font-bold text-blue-900 dark:text-blue-100 bg-blue-200 dark:bg-blue-800 rounded-lg px-3 py-1 mt-1 flex items-center gap-2 shadow-inner animate-fade-in">
                        New Total: <span className="text-lg text-green-700 dark:text-green-300 font-extrabold">₹{finalTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Modernized Savings Summary */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/40 p-3 mb-2 shadow-sm">
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                  <span>Total MRP</span>
                  <span>₹{originalTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                  <span>Subtotal (Non-Member Price)</span>
                  <span>₹{nonMemberSubtotal.toFixed(2)}</span>
                </div>
                {userRole === 'member' && (
                  <div className="flex justify-between items-center text-xs text-yellow-800 font-semibold mb-1 animate-fade-in">
                    <span>Member Price Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                )}
                {memberSavings > 0 && userRole === 'member' && (
                  <div className="flex justify-between items-center text-xs text-green-700 font-bold mb-1 animate-fade-in">
                    <span>Total Member Savings</span>
                    <span>-₹{memberSavings.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs text-green-700 font-bold mb-1 animate-fade-in">
                  <span>Total Savings (MRP - Final)</span>
                  <span>-₹{totalSavings.toFixed(2)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-lg font-extrabold text-foreground bg-gradient-to-r from-green-100 to-blue-50 dark:from-green-900 dark:to-blue-900 rounded-xl px-4 py-3 shadow-lg border border-blue-200 dark:border-blue-800 mb-1 transition-all duration-300 animate-fade-in">
                <span>Grand Total</span>
                <span className={pointsToRedeem > 0 ? "text-green-700 dark:text-green-300 animate-bounce" : ""}>₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
        {/* Sticky footer for actions/buttons */}
        <div className="flex-shrink-0 sticky bottom-0 bg-background p-4 border-t z-20">
          <Button
            size="lg"
            className="w-full mt-2 py-3 text-base bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold shadow-lg hover:from-blue-700 hover:to-green-600 transition-all duration-200"
            onClick={handleProceedToBook}
            disabled={isBooking}
          >
            {isBooking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageSquare size={18} className="mr-2" />}
            {isBooking ? 'Processing...' : 'Book & Confirm via WhatsApp'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-900 font-semibold"
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
          {/* Non-member: Membership Upsell Banner */}
          {userRole === 'non-member' && items.length > 0 && items.some(item => typeof item.memberPrice === 'number' && item.memberPrice > 0) && (
            <div className="border border-yellow-300 bg-yellow-50 text-yellow-900 rounded-lg px-3 py-3 text-sm font-semibold flex flex-col items-center gap-2 mb-3 animate-fade-in shadow animate-crown-shimmer">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-yellow-500 animate-crown-shimmer" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span className="font-bold text-yellow-700">Become a Member & Save More!</span>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white font-bold shadow hover:from-yellow-500 hover:to-yellow-700 transition-all duration-200 px-6 py-2 rounded-lg animate-bounce"
                onClick={() => {
                  const msg = encodeURIComponent('I want to join membership and get extra discounts on lab tests.');
                  window.open(`https://wa.me/${contactDetailsData.whatsapp.replace(/\D/g, '')}?text=${msg}`, '_blank');
                }}
              >
                Join Membership
              </Button>
              <span className="text-xs text-yellow-800 mt-1 text-center">
                As a member, you would pay only <span className="font-bold text-green-700">₹{items.reduce((sum, item) => typeof item.memberPrice === 'number' && item.memberPrice > 0 ? sum + item.memberPrice * item.quantity : sum, 0).toFixed(2)}</span> for these tests!
              </span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
