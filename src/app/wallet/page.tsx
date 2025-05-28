"use client";
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/client';

// Dynamically import WalletDashboard to avoid SSR issues
const WalletDashboard = dynamic(() => import('@/components/wallet/WalletDashboard'), { ssr: false });

export default function WalletPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.push('/login');
    });
    return () => unsub();
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* <h1 className="text-2xl font-bold mb-6">My Wallet</h1> */}
      <WalletDashboard />
    </div>
  );
} 