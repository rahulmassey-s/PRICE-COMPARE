'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from '@/lib/firebase/client'; // Ensure this path is correct
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from 'lucide-react';
import { getOrCreateUserDocument } from '@/lib/firebase/firestoreService';
import { collection, query, getDocs, doc, updateDoc, setDoc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client'; // Ensure this path is correct
import { serverTimestamp } from 'firebase/firestore';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  // Redirect if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/'); // Redirect to homepage if logged in
      } else {
        setIsCheckingAuth(false); // Auth check finished, user is not logged in
      }
    });
    return () => unsubscribe(); // Cleanup subscription
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      toast({
        title: "Signup Failed",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Signup Failed",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        // --- Ensure user doc is created before any update or referral logic ---
        await getOrCreateUserDocument(userCredential.user, mobile);
        // --- Referral logic ---
        let referrerUid = null;
        let referrerUserDoc = null;
        if (referralCode && referralCode.length >= 6) {
          // Try to find user with this code (last 8 chars of UID)
          const usersRef = collection(db, 'users');
          const snap = await getDocs(usersRef);
          const found = snap.docs.find(doc => doc.id.slice(-8).toUpperCase() === referralCode.trim().toUpperCase());
          if (found) {
            referrerUid = found.id;
            referrerUserDoc = found;
          }
        }
        // Create user doc with referrerUid if found
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        await updateDoc(userDocRef, { referrerUid: referrerUid || null, displayName: name });
        // Award 100 points to new user if referred
        if (referrerUid) {
          // 1. Add wallet transaction for new user
          const txRef = doc(collection(db, 'walletTransactions'));
          await setDoc(txRef, {
            userId: userCredential.user.uid,
            date: new Date(),
            action: 'referral-signup',
            points: 100,
            status: 'completed',
            meta: { referrerUid },
            createdAt: serverTimestamp(),
          });
          // 2. Update new user's points
          const userDoc = await getDoc(userDocRef);
          const newPoints = (userDoc.data()?.pointsBalance || 0) + 100;
          await updateDoc(userDocRef, { pointsBalance: newPoints });
          // 3. Add wallet transaction for referrer (if not already awarded for this referred user)
          const refTxSnap = await getDocs(
            query(
              collection(db, 'walletTransactions'),
              where('userId', '==', referrerUid),
              where('action', '==', 'referral-refer'),
              where('meta.referredUid', '==', userCredential.user.uid)
            )
          );
          if (refTxSnap.empty) {
            const refTxRef = doc(collection(db, 'walletTransactions'));
            await setDoc(refTxRef, {
              userId: referrerUid,
              date: new Date(),
              action: 'referral-refer',
              points: 100,
              status: 'completed',
              meta: { referredUid: userCredential.user.uid },
              createdAt: serverTimestamp(),
            });
            // 4. Update referrer's points
            if (referrerUserDoc) {
              const refUserDocRef = doc(db, 'users', referrerUid);
              const refUserDoc = await getDoc(refUserDocRef);
              const refNewPoints = (refUserDoc.data()?.pointsBalance || 0) + 100;
              await updateDoc(refUserDocRef, { pointsBalance: refNewPoints });
            }
          }
        }
      }

      toast({
        title: "Signup Successful",
        description: "Account created! Redirecting...",
      });
      // The onAuthStateChanged listener will handle the redirect
    } catch (error: any) {
      let errorMessage = "Signup failed. Please try again.";
      let logErrorToConsole = true;

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email address is already in use.';
          logErrorToConsole = false;
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          logErrorToConsole = false;
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. It should be at least 6 characters.';
          logErrorToConsole = false;
          break;
        case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            logErrorToConsole = false;
            break;
        default:
          errorMessage = 'An unexpected error occurred during signup. Please try again later.';
          break;
      }

      if (logErrorToConsole) {
        console.error("Signup error:", error);
      }
      
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 px-4">
      <Card className="w-full max-w-md shadow-2xl rounded-xl">
        <CardHeader className="text-center space-y-2 pt-8">
           <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full p-3 mb-4 shadow-lg mx-auto">
             <UserPlus className="h-6 w-6" />
           </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">Create an Account</CardTitle>
          <CardDescription>Join us to get the best lab test deals!</CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-base py-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base py-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base py-3"
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="text-base py-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="Enter your 10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                className="text-base py-3"
                pattern="\d{10}"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referralCode">Referral Code (optional)</Label>
              <Input
                id="referralCode"
                type="text"
                placeholder="Enter referral code (if any)"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="text-base py-3 tracking-widest uppercase"
                maxLength={12}
              />
            </div>
            <Button type="submit" className="w-full py-3 text-base" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating Account...
                </>
              ) : (
                 <>
                  <UserPlus className="mr-2 h-5 w-5" /> Sign Up
                </>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
