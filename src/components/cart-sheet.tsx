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
import { createBooking, getOrCreateUserDocument, redeemPoints, logUserActivity } from '@/lib/firebase/firestoreService';
import type { UserDetails } from '@/types';
import { useState, useEffect, useRef } from 'react'; // Added useEffect and useRef
import { addDays, format, isToday, isTomorrow } from 'date-fns';
import React, { forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import MembershipAnimation from '@/components/membership-animation';

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
  { start: '13:00', end: '14:00' },
  { start: '13:30', end: '14:30' },
  { start: '14:00', end: '15:00' },
  { start: '14:30', end: '15:30' },
  { start: '15:00', end: '16:00' },
  { start: '15:30', end: '16:30' },
  { start: '16:00', end: '17:00' },
];

function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
}

export default function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const { items, removeFromCart, clearCart, updateAppointmentDateTime, cartAppointmentDateTime, setCartAppointmentDateTime } = useCart();
  const { toast, dismiss } = useToast();
  const [isBooking, setIsBooking] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [redeemError, setRedeemError] = useState('');
  const [userRole, setUserRole] = useState<'member' | 'non-member' | 'admin'>('non-member');
  const [showCollectionPopup, setShowCollectionPopup] = useState(false);
  const [forceHomeCollection, setForceHomeCollection] = useState(false);
  const [showMembershipBanner, setShowMembershipBanner] = useState(false);

  const mounted = useRef(true); // Ref to track if component is mounted
  const grandTotalRef = useRef<HTMLDivElement>(null); // Ref for Grand Total section

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

  // Only dismiss toasts when cart transitions from closed to open
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      dismiss();
    }
    prevOpenRef.current = open;
  }, [open, dismiss]);

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

  // Calculate member savings (total non-member price - member price) for ACTUAL members
  const nonMemberSubtotal = items.reduce((sum, item) => sum + (item.nonMemberPrice ?? item.price) * item.quantity, 0);
  const memberSavings = userRole === 'member' ? nonMemberSubtotal - subtotal : 0;

  // Potential savings for non-members if they were to become a member
  const memberPriceCalculatedSubtotal = items.reduce((sum, item) => sum + (item.memberPrice ?? item.price) * item.quantity, 0);
  const potentialMemberSavings = nonMemberSubtotal - memberPriceCalculatedSubtotal;

  // Calculate discount from points
  const pointsValue = 10; // 10 points = ₹1 (configurable)
  const maxRedeemable = Math.min(userPoints, Math.floor(subtotal * pointsValue));
  const redeemDiscount = pointsToRedeem > 0 ? (pointsToRedeem / pointsValue) : 0;
  const finalTotal = Math.max(0, subtotal - redeemDiscount);

  // Calculate collection charge if applicable
  const collectionCharge = finalTotal < 350 && forceHomeCollection ? 100 : 0;
  const grandTotal = finalTotal + collectionCharge;

  // --- Always calculate total savings as originalTotal - finalTotal ---
  const totalSavings = originalTotal - finalTotal;

  // --- FIX: Add effect to show membership banner for non-members ---
  useEffect(() => {
    // Show banner if user is not a member
    if (userRole === 'non-member') {
      setShowMembershipBanner(true);
    } else {
      setShowMembershipBanner(false);
    }
  }, [userRole, potentialMemberSavings, items]);

  const handleProceedToBook = async () => {
    if (finalTotal < 350 && !forceHomeCollection) {
      setShowCollectionPopup(true);
      return;
    }

    try {
      const user = auth.currentUser;
      const userId = user?.uid || '';
      const userName = user?.displayName || null;
      const userEmail = user?.email || null;
      if (userId) {
        logUserActivity(userId, 'booking_attempt', {
          cartItems: items.map(i => ({
            testId: i.testDocId || '',
            testName: i.testName || '',
            labName: i.labName || '',
            price: i.price || 0
          })),
          totalAmount: subtotal || 0
        }, userName ?? undefined, userEmail ?? undefined);
      }
    } catch (e) {}

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

      const bookingUserDetails: { displayName: string; phoneNumber: string } = {
        displayName: userDoc?.displayName ?? currentUser.displayName ?? '',
        phoneNumber: userDoc?.phoneNumber ?? currentUser.phoneNumber ?? '',
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
                let [hours, minutes] = time.split(':').map(Number);
                if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
                if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0; // Midnight case
                const d = new Date(parsed.date);
                d.setHours(hours, minutes, 0, 0);
                dateTimeStr = d.toISOString();
              } else {
                // 24-hour format
                const [hours, minutes] = startTime.split(':').map(Number);
                const d = new Date(parsed.date);
                d.setHours(hours, minutes, 0, 0);
                dateTimeStr = d.toISOString();
              }
              return { ...item, appointmentDateTime: dateTimeStr };
            }
          } catch (e) {
            console.error("Error parsing cart appointment datetime:", e);
          }
        }
        return item; // return original item if something fails
      });

      // Map to correct booking item structure and debug log
      const bookingItems = itemsWithDateTime.map(item => ({
        testId: item.testDocId, // ensure testId is set
        testName: item.testName,
        testImageUrl: item.testImageUrl || null,
        labName: item.labName,
        price: item.price,
        originalPrice: item.originalPrice || null,
        appointmentDateTime: item.appointmentDateTime
      }));
      console.log("Booking bookingItems:", bookingItems);

      const bookingId = await createBooking(
        currentUser,
        bookingItems,
        grandTotal,
        totalSavings,
        bookingUserDetails
      );

      // --- WhatsApp Message: Professional, complete, and user-friendly ---
      const testNames = bookingItems.map(item => item.testName).join(', ');
      const bookingDateTime = (() => {
        if (bookingItems.length > 0 && bookingItems[0].appointmentDateTime) {
          try {
            const d = new Date(bookingItems[0].appointmentDateTime);
            return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
          } catch {}
        }
        return 'N/A';
      })();
      const bookingLink = `${window.location.origin}/account`;
      const whatsAppMessage =
        `Hello Team Smart Bharat,%0A%0A` +
        `I have just confirmed my booking. Here are my details:%0A` +
        `• Booking ID: ${bookingId}%0A` +
        `• Name: ${(bookingUserDetails.displayName || '')}%0A` +
        `• Mobile: ${(bookingUserDetails.phoneNumber || '')}%0A` +
        `• Total Amount: ₹${grandTotal.toFixed(2)}%0A` +
        `• Tests/Packages: ${testNames}%0A` +
        `• Preferred Date/Time: ${bookingDateTime}%0A` +
        `%0AYou can find my booking details here: ${bookingLink}%0A%0A` +
        `Please assist me with the next steps. Thank you!`;
      const whatsappUrl = `https://wa.me/${contactDetailsData.whatsapp}?text=${whatsAppMessage}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY_BOOKING_PENDING_MSG, JSON.stringify({ name: bookingUserDetails.displayName, timestamp: Date.now() }));
      window.location.href = whatsappUrl;

      if (mounted.current) {
        toast({ title: "Booking Successful!", description: "Redirecting to WhatsApp for confirmation.", variant: "default" });
        clearCart();
        onOpenChange(false);
      }

    } catch (error) {
      console.error("Booking failed:", error);
      if (mounted.current) {
        toast({
          title: "Booking Failed",
          description: error instanceof Error ? error.message : "An unknown error occurred.",
          variant: "destructive",
        });
      }
    } finally {
      if (mounted.current) {
        setIsBooking(false);
      }
    }
  };
  
  const handleVisitCollectionCenter = () => {
    setForceHomeCollection(true);
    setShowCollectionPopup(false);
    // Directly call the booking logic again
    handleProceedToBook();
  };
  const handlePayCollectionCharge = () => {
    setForceHomeCollection(true);
    setShowCollectionPopup(false);
    // Directly call the booking logic again
    handleProceedToBook();
  };

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const next7Days = getNext7Days();

  // JSX for the cart sheet
  return (
    <>
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
          <div className="flex-grow overflow-y-auto flex flex-col">
            {/* Date & Time Slot Picker */}
            <div className="p-4 bg-secondary/30 border-b">
              <h3 className="text-sm font-semibold mb-2">Select Sample Collection Date & Time</h3>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {next7Days.map((date) => {
                  const dayStr = format(date, 'yyyy-MM-dd');
                  const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dayStr;
                  return (
                    <button
                      key={dayStr}
                      className={`px-2 py-2 rounded-lg border text-center transition-all duration-150 ${isSelected ? 'bg-green-100 border-green-500 text-green-900 shadow' : 'bg-white border-gray-200 text-gray-700 hover:bg-green-50'}`}
                      onClick={() => setSelectedDate(date)}
                      type="button"
                    >
                      <span className="block text-xs font-semibold">{format(date, 'EEE')}</span>
                      <span className="block text-lg font-bold">{format(date, 'd')}</span>
                      <span className="block text-xs">{format(date, 'MMM')}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map(({ start, end }) => {
                  if (!selectedDate) return null;
                  const [startHour, startMinute] = start.split(':').map(Number);
                  const slotDateTime = new Date(selectedDate);
                  slotDateTime.setHours(startHour, startMinute, 0, 0);

                  const isPastSlot = new Date() > slotDateTime;
                  const slotLabel = `${start} - ${end}`;
                  const isSelected = cartAppointmentDateTime ? (JSON.parse(cartAppointmentDateTime).date === format(selectedDate, 'yyyy-MM-dd') && JSON.parse(cartAppointmentDateTime).slot === slotLabel) : false;

                  return (
                    <button
                      key={slotLabel}
                      className={`px-2 py-2 rounded-lg border text-center text-xs font-semibold transition-all duration-150 ${isSelected ? 'bg-green-100 border-green-500 text-green-900 shadow' : 'bg-white border-gray-200 text-gray-700 hover:bg-green-50'} ${isPastSlot ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => {
                        if (!selectedDate || isPastSlot) return;
                        setCartAppointmentDateTime(JSON.stringify({ date: selectedDate, slot: slotLabel }));
                          setTimeout(() => {
                            const val = JSON.stringify({ date: selectedDate, slot: slotLabel });
                            if (selectedDate && slotLabel) grandTotalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 100);
                      }}
                      type="button"
                      disabled={!selectedDate || isPastSlot}
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
                            ₹{(item.memberPrice).toFixed(2)}
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
              {userRole === 'member' && totalSavings > 0 && (
                <div className="border rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 mb-2 shadow" style={{ borderColor: '#bfa100', background: '#fffbe6', color: '#bfa100' }}>
                  <svg className="w-5 h-5" style={{ color: '#bfa100' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <span className="font-bold flex items-center gap-1" style={{ color: '#bfa100' }}>
                    Crown Member Price
                    <span style={{ color: '#bfa100', fontWeight: 800 }}>You Saved ₹{totalSavings.toFixed(2)}</span>
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground" title="Includes member discount and wallet points">(Total savings from MRP)</span>
                </div>
              )}

              {/* Membership animation for non-members */}
              {showMembershipBanner && userRole === 'non-member' && (
                <MembershipAnimation 
                  potentialSavings={potentialMemberSavings}
                  nonMemberPrice={nonMemberSubtotal}
                  memberPrice={memberPriceCalculatedSubtotal}
                  onJoinClick={() => {
                    const message = encodeURIComponent(
                      'Hi Team, I want to unlock the member price for my cart on Smart Bharat. Please help me proceed!'
                    );
                    window.open(`https://wa.me/8533855141?text=${message}`, '_blank');
                  }}
                />
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
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max={maxRedeemable}
                      step="10"
                      value={pointsToRedeem}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (val > maxRedeemable) {
                          setRedeemError(`Max ${maxRedeemable} points can be redeemed.`);
                          setPointsToRedeem(maxRedeemable);
                        } else {
                          setRedeemError('');
                          setPointsToRedeem(val);
                        }
                      }}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer dark:bg-blue-700"
                    />
                    <div className="flex justify-between text-xs text-blue-600 dark:text-blue-300 mt-1">
                      <span>0</span>
                      <span>{maxRedeemable}</span>
                    </div>
                  </div>
                  {redeemError && <p className="text-xs text-red-500 mt-1">{redeemError}</p>}
                  {pointsToRedeem > 0 && (
                    <div className="mt-2 flex flex-col gap-1 animate-fade-in">
                      <div className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2l4 -4" /></svg>
                        Redeem: <span className="font-bold">-₹{redeemDiscount.toFixed(2)}</span>
                      </div>
                      <div className="text-sm font-bold text-blue-900 dark:text-blue-100 bg-blue-200 dark:bg-blue-800 rounded-lg px-3 py-1 mt-1 flex items-center gap-2 shadow-inner animate-fade-in">
                          New Total: <span className="text-lg text-green-700 dark:text-green-300 font-extrabold">₹{grandTotal.toFixed(2)}</span>
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
                <div ref={grandTotalRef} className="flex justify-between items-center text-lg font-extrabold text-foreground bg-gradient-to-r from-green-100 to-blue-50 dark:from-green-900 dark:to-blue-900 rounded-xl px-4 py-3 shadow-lg border border-blue-200 dark:border-blue-800 mb-1 transition-all duration-300 animate-fade-in">
                <span>Grand Total</span>
                  <span className={pointsToRedeem > 0 ? "text-green-700 dark:text-green-300 animate-bounce" : ""}>₹{grandTotal.toFixed(2)}</span>
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
        </div>
      </SheetContent>
    </Sheet>
    {/* Pop-up for collection charge confirmation */}
    <Dialog open={showCollectionPopup} onOpenChange={setShowCollectionPopup}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>Confirm Home Sample Collection</DialogTitle>
            </DialogHeader>
            <div>
            <p>Your order total is less than ₹350. A ₹100 charge will be applied for home sample collection.</p>
            <p>Alternatively, you can visit a collection center to avoid this charge.</p>
            </div>
            <DialogFooter>
            <Button variant="outline" onClick={handleVisitCollectionCenter}>Visit Center</Button>
            <Button onClick={handlePayCollectionCharge}>Pay ₹100 Charge</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
