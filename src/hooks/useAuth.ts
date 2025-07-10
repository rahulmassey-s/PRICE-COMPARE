'use client';
import { useState, useEffect, useCallback } from 'react';
import { 
    getAuth, 
    onAuthStateChanged, 
    User, 
    signInWithEmailAndPassword, 
    signOut as firebaseSignOut 
} from 'firebase/auth';
import { app } from '@/lib/firebase/client';

const auth = getAuth(app);

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if(user) {
        // Here you can check if user has completed onboarding from your db
        // For now, we'll assume they are onboarded if they are logged in
        setIsOnboardingComplete(true);
      } else {
        setIsOnboardingComplete(false);
      }
      setIsCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
      return signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
      return firebaseSignOut(auth);
  }, []);

  return { user, isCheckingAuth, isOnboardingComplete, signInWithEmail, signOut };
} 