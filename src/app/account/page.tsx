'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User as FirebaseAuthUser } from 'firebase/auth'; 
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from '@/lib/firebase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, Mail, User as UserProfileIcon, Edit3, Save, Smartphone, ShoppingBag, CalendarDays, ExternalLink, AlertTriangle, BellRing } from 'lucide-react';
import type { UserDetails, Booking } from '@/types';
import { getOrCreateUserDocument, updateFirestoreUserDetails, getUserBookings } from '@/lib/firebase/firestoreService';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { requestForToken } from '@/lib/firebase-messaging';

export default function AccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isUserDetailsLoading, setIsUserDetailsLoading] = useState(false);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');

  const [isSyncingToken, setIsSyncingToken] = useState(false);

  const handleFirestoreError = useCallback((error: any, context: string) => {
    console.error(`Firestore error (${context}):`, error);
    let description = `Could not load ${context}. Please try again later.`;
    if (error.name === 'FirebaseError') {
      if (error.code === 'unavailable') {
        description = `Connection to our servers failed (${context}). Please check your internet connection and try again.`;
      } else if (error.code === 'permission-denied') {
        description = `Permission denied when fetching ${context}. Please check Firestore security rules.`;
      } else {
        description = `Firebase error (${context}): ${error.message} (Code: ${error.code}).`;
      }
    }
    setError(description); // Set general error state
    toast({ title: `Error Loading ${context}`, description, variant: "destructive" });
  }, [toast]);


  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        setError(null);

        setIsUserDetailsLoading(true);
        getOrCreateUserDocument(user)
          .then(fetchedUserDetails => {
            if (fetchedUserDetails) {
              setUserDetails(fetchedUserDetails);
              setEditDisplayName(fetchedUserDetails.displayName || '');
              setEditPhoneNumber(fetchedUserDetails.phoneNumber || '');
            } else {
              throw new Error("User details could not be fetched or created.");
            }
          })
          .catch(err => {
            handleFirestoreError(err, "Profile Data");
          })
          .finally(() => setIsUserDetailsLoading(false));

        setIsBookingsLoading(true);
        getUserBookings(user.uid)
          .then(fetchedBookings => {
            setBookings(fetchedBookings);
          })
          .catch(err => {
            handleFirestoreError(err, "Booking History");
          })
          .finally(() => setIsBookingsLoading(false));

      } else {
        router.push('/login'); 
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router, toast, handleFirestoreError]);

  const handleLogout = async () => {
    setIsAuthLoading(true); 
    try {
      await firebaseSignOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error: any) {
      console.error("Logout error:", error);
      let description = "Could not log you out. Please try again.";
      if (error.name === 'FirebaseError') {
        description = `Firebase error: ${error.message}`;
      }
      toast({ title: "Logout Failed", description, variant: "destructive" });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!firebaseUser || !userDetails) return;
    setIsSavingDetails(true);
    setError(null);
    try {
      const updates: Partial<Pick<UserDetails, 'displayName' | 'phoneNumber'>> = {};
      if (editDisplayName !== (userDetails.displayName || '')) {
         updates.displayName = editDisplayName.trim() === '' ? null : editDisplayName.trim();
      }
      if (editPhoneNumber !== (userDetails.phoneNumber || '')) {
        updates.phoneNumber = editPhoneNumber.trim() === '' ? null : editPhoneNumber.trim();
      }

      if (Object.keys(updates).length > 0) {
        await updateFirestoreUserDetails(firebaseUser.uid, updates);
        setUserDetails(prev => {
            if (!prev) return null;
            const newDetails: UserDetails = { ...prev };
            if (updates.displayName !== undefined) newDetails.displayName = updates.displayName;
            if (updates.phoneNumber !== undefined) newDetails.phoneNumber = updates.phoneNumber;
            return newDetails;
        });
        toast({ title: "Details Updated", description: "Your profile information has been saved." });
      }
      setIsEditingDetails(false);
    } catch (err: any) {
      handleFirestoreError(err, "Saving Details");
    } finally {
      setIsSavingDetails(false);
    }
  };
  
  const getInitials = (userArg: UserDetails | FirebaseAuthUser | null) => {
    if (!userArg) return '';
    const name = (userArg as any).displayName;
    const email = (userArg as any).email;
    if (name && typeof name === 'string' && name.trim() !== '') return name.substring(0, 2).toUpperCase();
    if (email && typeof email === 'string') return email.substring(0, 2).toUpperCase();
    return 'U';
  };

  // Debug: log userDetails state changes
  useEffect(() => {
    console.log('userDetails (debug):', userDetails);
  }, [userDetails]);

  // Robust member check (now checks for expiry)
  const membershipStart = userDetails?.membershipStartDate ? new Date(userDetails.membershipStartDate) : null;
  const membershipExpiry = membershipStart ? new Date(membershipStart) : null;
  if (membershipExpiry) membershipExpiry.setFullYear(membershipExpiry.getFullYear() + 1);
  const isMember = !!membershipStart && !isNaN(membershipStart.getTime()) && membershipExpiry && new Date() < membershipExpiry;

  // Debug: log firebaseUser state changes
  useEffect(() => {
    console.log('firebaseUser state:', firebaseUser);
  }, [firebaseUser]);

  const handleSyncToken = async () => {
    setIsSyncingToken(true);
    toast({ title: 'Syncing...', description: 'Attempting to refresh your notification status.' });
    try {
      const token = await requestForToken();
      if (token) {
        toast({ title: 'Sync Successful', description: 'Your device is ready to receive notifications.' });
      } else {
        toast({ title: 'Sync Failed', description: 'Could not get notification token. Please ensure you have granted permission.', variant: 'destructive' });
      }
    } catch (error) {
      console.error("Error during manual token sync:", error);
      toast({ title: 'Sync Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsSyncingToken(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error && !isUserDetailsLoading && !isBookingsLoading && !isSavingDetails) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-lg mx-auto shadow-xl rounded-xl bg-destructive/10 border-destructive">
          <CardHeader className="items-center text-center p-6">
            <AlertTriangle className="h-12 w-12 text-destructive-foreground mb-4" />
            <CardTitle className="text-xl sm:text-2xl font-bold text-destructive-foreground">Account Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-destructive-foreground">
            <p>{error}</p>
            <Button onClick={() => router.push('/')} className="mt-6" variant="secondary">Go to Homepage</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!firebaseUser) { 
     return (
      <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
        <p>Redirecting to login...</p>
        <Loader2 className="ml-2 h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPageBusy = isAuthLoading || isSavingDetails || isUserDetailsLoading || isBookingsLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-lg mx-auto shadow-xl rounded-xl">
        <CardHeader className="items-center text-center p-6 bg-primary/5 rounded-t-xl">
          {/* Member badge and membership info */}
          {isMember ? (
            <div className="flex flex-col items-center mb-4">
              <span className="inline-flex items-center px-4 py-1 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 text-white font-bold text-base shadow-md mb-1">
                <svg width="22" height="22" fill="#ffd700" stroke="#bfa100" strokeWidth="2" className="mr-2">
                  <path d="M12 2l2.09 6.26L20 9.27l-5 4.87L16.18 21 12 17.27 7.82 21 9 14.14l-5-4.87 5.91-.91z" />
                </svg>
                Active Member
              </span>
              <span className="text-blue-900 font-semibold text-sm mt-1">
                Joined: {membershipStart ? membershipStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </span>
              <span className="text-blue-700 text-xs">
                Expires: {membershipExpiry ? membershipExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center mb-4">
              <span className="inline-flex items-center px-4 py-1 rounded-full bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 font-bold text-base shadow mb-1">
                <svg width="18" height="18" fill="#d1d5db" stroke="#a3a3a3" strokeWidth="2" className="mr-2">
                  <path d="M12 2l2.09 6.26L20 9.27l-5 4.87L16.18 21 12 17.27 7.82 21 9 14.14l-5-4.87 5.91-.91z" />
                </svg>
                Not a member
              </span>
              <Button
                asChild
                className="mt-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold shadow hover:from-yellow-500 hover:to-yellow-600"
                size="sm"
              >
                <a
                  href="https://wa.me/918077483317?text=Hi%2C%20I%20want%20to%20join%20the%20Smart%20Lab%20membership%21"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join Membership
                </a>
              </Button>
              {/* DEV ONLY: Set Membership Active Button removed for production */}
            </div>
          )}
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24 mb-4 border-4 border-primary shadow-lg">
            <AvatarImage 
              src={firebaseUser.photoURL || userDetails?.displayName ? `https://picsum.photos/seed/${userDetails?.displayName || firebaseUser.uid}/100/100` : `https://picsum.photos/seed/${firebaseUser.uid}/100/100`} 
              alt={userDetails?.displayName || firebaseUser.email || "User"} 
              data-ai-hint="user profile" 
            />
            <AvatarFallback className="text-3xl sm:text-4xl text-primary font-semibold bg-muted">
              {getInitials(userDetails || firebaseUser)}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
            {userDetails?.displayName || firebaseUser.email?.split('@')[0] || 'My Account'}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Manage your profile, view booking history, and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-6">
          <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="font-semibold text-base sm:text-lg">
                <div className="flex items-center"><UserProfileIcon className="mr-2 h-5 w-5 text-primary" /> My Details</div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                {isUserDetailsLoading ? ( 
                    <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : isEditingDetails ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input id="displayName" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} placeholder="Your Name" />
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input id="phoneNumber" type="tel" value={editPhoneNumber} onChange={(e) => setEditPhoneNumber(e.target.value)} placeholder="Your Phone" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveDetails} disabled={isSavingDetails} className="flex-1">
                        {isSavingDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditingDetails(false)} className="flex-1" disabled={isSavingDetails}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border">
                      <div className="flex items-center">
                         <Mail className="h-5 w-5 text-primary shrink-0 mr-3" />
                         <span className="text-sm text-foreground truncate">{firebaseUser.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border">
                      <div className="flex items-center">
                        <UserProfileIcon className="h-5 w-5 text-primary shrink-0 mr-3" />
                        <span className="text-sm text-foreground">{userDetails?.displayName || 'Not set'}</span>
                      </div>
                    </div>
                     <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border">
                       <div className="flex items-center">
                        <Smartphone className="h-5 w-5 text-primary shrink-0 mr-3" />
                        <span className="text-sm text-foreground">{userDetails?.phoneNumber || 'Not set'}</span>
                       </div>
                    </div>
                    <Button variant="outline" onClick={() => setIsEditingDetails(true)} className="w-full">
                      <Edit3 className="mr-2 h-4 w-4" /> Edit Details
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="font-semibold text-base sm:text-lg">
                <div className="flex items-center"><ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Booking History</div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                {isBookingsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : bookings.length > 0 ? (
                  <ul className="space-y-4">
                    {bookings.map(booking => (
                      <li key={booking.id} className="p-3 sm:p-4 border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center">
                                <CalendarDays className="inline h-3 w-3 mr-1.5" /> 
                                Booked on: {booking.bookingDate ? format(booking.bookingDate, 'PPP p') : 'Date not available'}
                            </p>
                             <p className="text-xs text-muted-foreground mt-1">Status: <span className="font-medium text-primary">{booking.status}</span></p>
                          </div>
                          <p className="text-sm font-semibold text-primary">Total: ₹{booking.totalAmount.toFixed(2)}</p>
                        </div>
                        <Accordion type="single" collapsible className="w-full -mx-1">
                          <AccordionItem value={`booking-${booking.id}-items`} className="border-0">
                            <AccordionTrigger className="text-xs py-1 px-1 text-muted-foreground hover:no-underline hover:text-primary">
                              View Items ({booking.items.length})
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pl-2 space-y-1 text-xs">
                              {booking.items.map((item, index) => (
                                <div key={index} className="flex justify-between items-center">
                                  <span>{item.testName} ({item.labName})</span>
                                  <span>₹{item.price.toFixed(2)}</span>
                                </div>
                              ))}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                        {typeof booking.totalSavings === 'number' && booking.totalSavings > 0 && (
                            <p className="text-xs text-green-600 mt-1 text-right">You saved ₹{booking.totalSavings.toFixed(2)}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">You have no booking history yet.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
               <AccordionTrigger className="font-semibold text-base sm:text-lg">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary lucide lucide-ticket-percent"><path d="M15 9h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M10.29 14.71a2.12 2.12 0 0 1-2.4-.58 1.99 1.99 0 0 0-2.78.04 2.12 2.12 0 0 1-2.98-.5"/><path d="M14.23 16.77a2.12 2.12 0 0 0 2.4.58 1.99 1.99 0 0 1 2.78-.04 2.12 2.12 0 0 0 2.98.5"/><path d="m9 10.5 6 6"/><path d="m15 10.5-6 6"/></svg>
                  My Offers
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Currently, all available offers are displayed on the Offers page.
                </p>
                <Button variant="link" onClick={() => router.push('/offers')} className="px-0 text-primary">
                  View All Offers <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
        <CardFooter className="p-6 border-t">
          <Button onClick={handleLogout} variant="destructive" className="w-full py-3 text-base" disabled={isPageBusy}>
            {isAuthLoading ? ( 
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-5 w-5" />
            )}
            {isAuthLoading ? 'Logging out...' : 'Logout'}
          </Button>
        </CardFooter>
      </Card>

      {/* Notification Settings Card */}
      <Card className="max-w-lg mx-auto shadow-xl rounded-xl mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            If you are not receiving notifications, try re-syncing your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSyncToken} disabled={isSyncingToken} className="w-full">
            {isSyncingToken ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="mr-2 h-4 w-4" />
            )}
            Sync Notification Status
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
