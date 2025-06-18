import React, { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase/client';
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Wallet, ArrowDownCircle, ArrowUpCircle, XCircle, Gift, CheckCircle, Info } from 'lucide-react';

/**
 * WalletDashboard: Shows user's wallet summary and transaction history
 */
export default function WalletDashboard() {
  const [user, setUser] = useState<any>(null);
  const [points, setPoints] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHowToEarn, setShowHowToEarn] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralAwarded, setReferralAwarded] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // Fetch user and wallet data
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        // Fetch user points
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        setPoints(userDoc.data()?.pointsBalance || 0);
        // Fetch transactions
        const q = query(collection(db, 'walletTransactions'), where('userId', '==', u.uid), orderBy('date', 'desc'));
        const txSnap = await getDocs(q);
        setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        // Referral code (use UID or custom code)
        setReferralCode(u.uid.slice(-8).toUpperCase());
        // Check if referral bonus already awarded
        const refTx = txSnap.docs.find(d => d.data().action === 'referral-share');
        setReferralAwarded(!!refTx);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Referral share handler
  const handleShareReferral = async () => {
    if (!user || referralAwarded) return;
    setShareLoading(true);
    try {
      // Award 100 points for sharing (if not already awarded)
      const txRef = doc(collection(db, 'walletTransactions'));
      await setDoc(txRef, {
        userId: user.uid,
        date: new Date(),
        action: 'referral-share',
        points: 100,
        status: 'completed',
        meta: { type: 'referral', code: referralCode },
        createdAt: serverTimestamp(),
      });
      // Update user points
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const newPoints = (userDoc.data()?.pointsBalance || 0) + 100;
      await updateDoc(doc(db, 'users', user.uid), { pointsBalance: newPoints });
      setPoints(newPoints);
      setReferralAwarded(true);
      // WhatsApp share
      const shareMsg = `Hey! Try Smart Lab Health Services for lab test booking. Use my referral code: ${referralCode} and get bonus points! https://smartlab.com/signup?ref=${referralCode}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
    } catch (e) {
      alert('Could not award referral points or share. Try again.');
    } finally {
      setShareLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-40 text-lg font-semibold text-blue-600 animate-pulse">Loading wallet...</div>;

  // Calculate earned, redeemed, expired
  const earned = transactions.filter(t => t.action === 'earn' || t.action === 'referral' || t.action === 'referral-complete').reduce((a, b) => a + b.points, 0);
  const redeemed = transactions.filter(t => t.action === 'redeem').reduce((a, b) => a + Math.abs(b.points), 0);
  const expired = transactions.filter(t => t.action === 'expire').reduce((a, b) => a + Math.abs(b.points), 0);

  // Helper for action badge
  const actionBadge = (action: string) => {
    if (action === 'earn' || action === 'referral' || action === 'referral-complete') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold"><ArrowDownCircle className="w-4 h-4" /> Earn</span>;
    if (action === 'referral-share') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold"><Gift className="w-4 h-4" /> Referral Share</span>;
    if (action === 'redeem') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"><ArrowUpCircle className="w-4 h-4" /> Redeem</span>;
    if (action === 'manual-add') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold"><Gift className="w-4 h-4" /> Manual Add</span>;
    if (action === 'expire') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold"><XCircle className="w-4 h-4" /> Expired</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">{action}</span>;
  };
  // Helper for status badge
  const statusBadge = (status: string) => {
    if (status === 'completed') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-semibold"><CheckCircle className="w-4 h-4" /> Completed</span>;
    if (status === 'pending') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">Pending</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">{status}</span>;
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Heading and How to Earn Points Button */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold">My Wallet</h2>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-400 to-blue-400 text-white font-semibold shadow hover:scale-105 hover:shadow-lg transition-all"
          onClick={() => setShowHowToEarn(true)}
        >
          <Info className="w-5 h-5" /> How to Earn Points
        </button>
      </div>
      {/* How to Earn Modal */}
      {showHowToEarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full relative animate-fade-in">
            <button className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xl font-bold" onClick={() => setShowHowToEarn(false)}>&times;</button>
            <h3 className="text-xl font-bold mb-2 text-blue-700 flex items-center gap-2"><Gift className="w-6 h-6" /> How to Earn Points</h3>
            <ul className="list-disc pl-5 mb-3 text-gray-700 text-sm">
              <li>Share your referral code with friends and family.</li>
              <li>When they sign up using your code, you get <b>100 points instantly</b>.</li>
              <li>When your referral completes their first test, you get <b>+400 points</b> more.</li>
              <li>Your friend also gets bonus points on sign up!</li>
            </ul>
            <div className="mb-3">
              <div className="font-semibold text-gray-800 mb-1">Your Referral Code:</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg bg-gray-100 px-3 py-1 rounded-lg border border-gray-300 select-all">{referralCode}</span>
                <button className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" onClick={() => {navigator.clipboard.writeText(referralCode)}}>Copy</button>
              </div>
            </div>
            <button
              className="w-full mt-2 py-2 rounded-lg bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold shadow hover:scale-105 hover:shadow-lg transition-all disabled:opacity-60"
              onClick={handleShareReferral}
              disabled={referralAwarded || shareLoading}
            >
              {referralAwarded ? 'Referral Shared! (100 pts awarded)' : shareLoading ? 'Sharing...' : 'Share on WhatsApp & Get 100 Points'}
            </button>
            <div className="text-xs text-gray-500 mt-2">
              *You will get 400 more points when your referral completes their first test.<br />
              *Referral code can be used only once per friend.
            </div>
          </div>
        </div>
      )}
      {/* Wallet Card */}
      <div className="relative rounded-2xl bg-gradient-to-br from-blue-500 via-blue-400 to-green-400 shadow-xl p-6 flex items-center gap-4 mb-8 animate-fade-in overflow-hidden">
        {/* Overlay for better contrast */}
        <div className="absolute inset-0 bg-black/10 dark:bg-black/30 pointer-events-none rounded-2xl" />
        <div className="relative z-10 bg-white/30 rounded-full p-4">
          <Wallet className="w-10 h-10 text-white drop-shadow" />
        </div>
        <div className="relative z-10">
          <div className="text-white text-lg font-semibold drop-shadow">Total Points</div>
          <div className="text-4xl font-extrabold text-white tracking-wide animate-bounce drop-shadow-lg">{points}</div>
        </div>
      </div>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl bg-green-50 dark:bg-green-900 p-4 flex flex-col items-center shadow">
          <span className="text-green-700 dark:text-green-300 font-bold text-lg">{earned}</span>
          <span className="text-xs text-green-800 dark:text-green-200 mt-1">Earned</span>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900 p-4 flex flex-col items-center shadow">
          <span className="text-blue-700 dark:text-blue-300 font-bold text-lg">{redeemed}</span>
          <span className="text-xs text-blue-800 dark:text-blue-200 mt-1">Redeemed</span>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 flex flex-col items-center shadow">
          <span className="text-gray-700 dark:text-gray-300 font-bold text-lg">{expired}</span>
          <span className="text-xs text-gray-800 dark:text-gray-200 mt-1">Expired</span>
        </div>
      </div>
      {/* Transaction History Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownCircle className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">Transaction History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-blue-700 uppercase bg-blue-50 dark:bg-blue-900">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Points</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6 text-gray-400">No transactions yet.</td></tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="border-b last:border-0 hover:bg-blue-50/60 dark:hover:bg-blue-900/40 transition-all">
                    <td className="px-3 py-2 whitespace-nowrap">{tx.date?.toDate ? tx.date.toDate().toLocaleDateString() : ''}</td>
                    <td className="px-3 py-2">{actionBadge(tx.action)}</td>
                    <td className={"px-3 py-2 font-bold " + (tx.points > 0 ? 'text-green-700' : 'text-red-600')}>{tx.points > 0 ? '+' : ''}{tx.points}</td>
                    <td className="px-3 py-2">{statusBadge(tx.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 