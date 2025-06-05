'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, User, LogOut, Languages, MapPin, Clock, Sun, Moon, Settings, Bell, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import CartSheet from '@/components/cart-sheet';
import { siteConfig } from '@/config/site';
import { useTranslation } from 'react-i18next';
import '../i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AppHeaderProps {
  isCartOpen: boolean;
  onCartOpenChange: (isOpen: boolean) => void;
}

export default function AppHeader({ isCartOpen, onCartOpenChange: onCartOpenChangeProp }: AppHeaderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dynamicSiteName, setDynamicSiteName] = useState<string>(siteConfig.name);
  const [dynamicLogoUrl, setDynamicLogoUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const { items: cartItems } = useCart();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!db) return;
    const siteSettingsRef = doc(db, "siteConfiguration", "main");
    // Real-time listener for site settings
    const unsubscribeSiteSettings = onSnapshot(siteSettingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const settings = docSnap.data();
        setDynamicSiteName(settings.name && typeof settings.name === 'string' && settings.name.trim() !== '' ? settings.name : '');
        setDynamicLogoUrl(settings.logoUrl && typeof settings.logoUrl === 'string' && settings.logoUrl.trim() !== '' ? settings.logoUrl : null);
      } else {
        setDynamicSiteName('');
        setDynamicLogoUrl(null);
      }
    });

    if (typeof onAuthStateChanged !== 'function' || !auth) {
      console.error("[AppHeader] onAuthStateChanged or Firebase auth instance is not available.");
      setAuthLoading(false);
      return () => { unsubscribeSiteSettings(); };
    }
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });

    return () => {
      unsubscribeSiteSettings();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // Listen for notifications for the current user
  useEffect(() => {
    if (!firebaseUser || !db) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('[DEBUG] Notifications fetched from Firestore:', notifs);
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => n.status === 'unread').length);
    }, (error) => {
      console.error('[DEBUG] Firestore notifications listener error:', error);
    });
    return () => unsub();
  }, [firebaseUser]);

  // Mark all as read when dropdown opens
  useEffect(() => {
    if (notifDropdownOpen && notifications.length > 0 && db && firebaseUser) {
      notifications.forEach(n => {
        if (n.status === 'unread') {
          updateDoc(doc(db, 'notifications', n.id), { status: 'read' });
        }
      });
    }
  }, [notifDropdownOpen, notifications, db, firebaseUser]);

  const handleLogout = async () => {
    try {
      if (typeof firebaseSignOut !== 'function' || !auth) {
        console.error("[AppHeader] firebaseSignOut or auth instance is not available.");
        toast({ title: "Logout Failed", description: "Logout service unavailable.", variant: "destructive" });
        return;
      }
      await firebaseSignOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", description: "Could not log you out.", variant: "destructive" });
    }
  };

  const getInitials = (user: FirebaseAuthUser | null) => {
    if (!user) return '';
    if (user.displayName) return user.displayName.substring(0, 2).toUpperCase();
    if (user.email) return user.email.substring(0, 2).toUpperCase();
    return 'U';
  };

  const handleLanguageChange = (lang: string) => {
    setCurrentLanguage(lang);
    i18n.changeLanguage(lang);
    toast({
      title: t('language'),
      description: lang === 'hi' ? 'भाषा बदल गई' : 'Language changed',
    });
  };

  const handleOpenCart = useCallback(() => {
    onCartOpenChangeProp(true);
  }, [onCartOpenChangeProp]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/70 dark:bg-[#18181b]/70 border-b border-border shadow-lg transition-all duration-300">
        <div className="container mx-auto px-4 h-16 sm:h-[68px] flex items-center justify-between min-w-0">
          {/* Left: Logo + Name */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {dynamicLogoUrl && (
              <div className="relative h-24 w-24 flex-shrink-0">
                <Image
                  src={dynamicLogoUrl}
                  alt={`${dynamicSiteName} Logo`}
                  fill
                  style={{ objectFit: 'contain' }}
                  sizes="96px"
                  data-ai-hint="company logo"
                />
              </div>
            )}
            {dynamicSiteName.trim() && (
              <span
                className="flex items-center gap-[1px] overflow-hidden text-ellipsis whitespace-nowrap w-full font-extrabold"
                style={{ color: 'hsla(180,75%,46%,0.85)' }}
              >
                {dynamicSiteName.split("").map((char, i) => (
                  <span
                    key={i}
                    className="app-title-wave"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                ))}
              </span>
            )}
          </div>
          {/* Right: Icons */}
          <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0">
            {/* Cart Icon - Enhanced */}
            <Button
              variant="ghost"
              size="icon"
              className="group text-foreground relative h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/60 dark:bg-[#23232b]/60 shadow-lg backdrop-blur-md border border-blue-200 dark:border-blue-800 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-br hover:from-blue-100 hover:to-green-100 dark:hover:from-blue-900 dark:hover:to-green-900 transition-all duration-200 focus:ring-2 focus:ring-blue-400"
              onClick={handleOpenCart}
              aria-label="Open cart"
            >
              <ShoppingCart size={28} className="text-blue-600 group-hover:scale-110 group-hover:text-green-500 transition-all duration-200 drop-shadow" />
              {cartItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-red-500 text-white text-xs font-bold animate-bounce shadow-xl border-2 border-white dark:border-[#23232b]">
                  {cartItems.length > 9 ? '9+' : cartItems.length}
                </span>
              )}
              <span className="sr-only">View Cart</span>
            </Button>
            {/* Wallet Icon - Enhanced */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="group text-foreground relative h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/60 dark:bg-[#23232b]/60 shadow-lg backdrop-blur-md border border-blue-200 dark:border-blue-800 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-br hover:from-blue-100 hover:to-green-100 dark:hover:from-blue-900 dark:hover:to-green-900 transition-all duration-200 focus:ring-2 focus:ring-blue-400"
                    aria-label="My Wallet"
                    onClick={() => router.push('/wallet')}
                  >
                    <Wallet size={28} className="text-green-600 group-hover:scale-110 group-hover:text-blue-500 transition-all duration-200 drop-shadow" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">My Wallet</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Notification Bell - Enhanced */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="group text-foreground relative h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/60 dark:bg-[#23232b]/60 shadow-lg backdrop-blur-md border border-blue-200 dark:border-blue-800 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-br hover:from-blue-100 hover:to-green-100 dark:hover:from-blue-900 dark:hover:to-green-900 transition-all duration-200 focus:ring-2 focus:ring-blue-400"
                aria-label="Notifications"
                onClick={() => setNotifDropdownOpen(v => !v)}
              >
                <Bell size={28} className="text-yellow-500 group-hover:scale-110 group-hover:text-blue-600 transition-all duration-200 drop-shadow" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-blue-500 text-white text-xs font-bold animate-bounce shadow-xl border-2 border-white dark:border-[#23232b]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
              {/* Dropdown */}
              {notifDropdownOpen && (
                <div
                  className="fixed"
                  style={{
                    zIndex: 1000,
                    top: 60,
                    right: 8,
                    minWidth: 180,
                    width: 'min(95vw, 360px)',
                    maxWidth: 360,
                    borderRadius: 16,
                    boxShadow: '0 8px 32px #2563ebcc, 0 2px 8px #2563eb22',
                    overflowX: 'hidden',
                    overflowWrap: 'break-word',
                    background: '#fff',
                    border: '1.5px solid #e0e7ef',
                  }}
                >
                  <div className="font-bold text-base mb-2 flex items-center gap-2 text-blue-800 dark:text-blue-200"><Bell size={18} /> Notifications</div>
                  {notifications.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">No notifications</div>}
                  <ul className="max-h-72 overflow-y-auto divide-y divide-blue-200 dark:divide-blue-800">
                    {notifications.slice(0, 10).map(n => {
                      // --- Enhanced extraction of test/lab/amount/date ---
                      let testNames = '';
                      let labNames = '';
                      if (n.items && Array.isArray(n.items) && n.items.length > 0) {
                        testNames = n.items.map(item => item.testName).join(', ');
                        labNames = [...new Set(n.items.map(item => item.labName))].join(', ');
                      } else if (n.testName) {
                        testNames = n.testName;
                      } else if (n.message) {
                        const match = n.message.match(/Test\(s\): ([^\n]+)/);
                        if (match) testNames = match[1];
                      }
                      const totalAmount = n.totalAmount || (n.message && n.message.match(/Total: ₹([\d.]+)/) ? n.message.match(/Total: ₹([\d.]+)/)[1] : '');
                      const bookingDate = n.bookingDate?.toDate ? n.bookingDate.toDate() : (n.createdAt?.toDate ? n.createdAt.toDate() : null);
                      return (
                        <li key={n.id} className={`py-3 px-2 rounded-lg mb-2 ${n.status === 'unread' ? 'bg-blue-100 dark:bg-blue-800' : 'bg-transparent'} shadow-sm`} style={{ listStyle: 'none' }}>
                          <div className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-1 flex items-center gap-2">
                            <Bell size={14} className="text-blue-500 dark:text-blue-200" /> {n.title}
                          </div>
                          <div className="text-xs text-blue-800 dark:text-blue-200 mb-1">
                            {testNames && <><span className="font-bold">Test:</span> {testNames}<br /></>}
                            {labNames && <><span className="font-bold">Lab:</span> {labNames}<br /></>}
                            {totalAmount && <><span className="font-bold">Amount:</span> ₹{totalAmount}<br /></>}
                            {bookingDate && <><span className="font-bold">Date:</span> {bookingDate.toLocaleDateString()}<br /></>}
                            {!testNames && n.message && <span>{n.message.replace(/#\w+/g, '').trim()}</span>}
                          </div>
                          <div className="text-[11px] text-right text-blue-700 dark:text-blue-300 mt-1">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : ''}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
            {/* Language Switcher - Enhanced */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="group text-foreground h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/60 dark:bg-[#23232b]/60 shadow-lg backdrop-blur-md border border-blue-200 dark:border-blue-800 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-br hover:from-blue-100 hover:to-green-100 dark:hover:from-blue-900 dark:hover:to-green-900 transition-all duration-200 focus:ring-2 focus:ring-blue-400">
                        <Languages size={26} className="text-purple-600 group-hover:scale-110 group-hover:text-blue-600 transition-all duration-200 drop-shadow" />
                        <span className="sr-only">Change language</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => handleLanguageChange('en')} className={currentLanguage === 'en' ? 'bg-accent text-accent-foreground' : ''}>
                        <span role="img" aria-label="English" className="mr-2">🇬🇧</span> English (EN)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleLanguageChange('hi')} className={currentLanguage === 'hi' ? 'bg-accent text-accent-foreground' : ''}>
                        <span role="img" aria-label="Hindi" className="mr-2">🇮🇳</span> हिन्दी (HI)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{t('language')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Theme Switcher - Enhanced */}
            <Button variant="ghost" size="icon" className="group text-foreground h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/60 dark:bg-[#23232b]/60 shadow-lg backdrop-blur-md border border-blue-200 dark:border-blue-800 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-br hover:from-blue-100 hover:to-green-100 dark:hover:from-blue-900 dark:hover:to-green-900 transition-all duration-200 focus:ring-2 focus:ring-blue-400" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={24} className="text-blue-700 group-hover:scale-110 group-hover:text-yellow-500 transition-all duration-200 drop-shadow" /> : <Sun size={24} className="text-yellow-400 group-hover:scale-110 group-hover:text-blue-500 transition-all duration-200 drop-shadow" />}
            </Button>
            {/* Removed user avatar/profile icon to prevent overlap. User can access account from bottom nav. */}
            {!authLoading && !firebaseUser && (
              <Button asChild variant="default" size="sm" className="text-xs sm:text-sm px-2.5 py-1 h-auto sm:px-3">
                <Link href="/login">Login</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <CartSheet open={isCartOpen} onOpenChange={onCartOpenChangeProp} />
    </>
  );
}

/* Add fade-in animation to global CSS if not present */
// @layer utilities {
//   .animate-fade-in {
//     animation: fadeIn 1.1s cubic-bezier(0.4,0,0.2,1);
//   }
//   @keyframes fadeIn {
//     from { opacity: 0; transform: translateY(-10px); }
//     to { opacity: 1; transform: none; }
//   }
// }

/* Add this to your global CSS (e.g., globals.css or tailwind.css) if not present:
@keyframes bounceX {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  50% { transform: translateX(8px); }
  80% { transform: translateX(-8px); }
}
.animate-bounce-x {
  animation: bounceX 2.2s cubic-bezier(0.4,0,0.2,1) infinite;
}
*/

/* Add this to your global CSS if not present:
@keyframes wave {
  0%, 100% { transform: translateY(0); }
  20% { transform: translateY(-7px); }
  40% { transform: translateY(0); }
  60% { transform: translateY(7px); }
  80% { transform: translateY(0); }
}
.app-title-wave {
  display: inline-block;
  animation: wave 1.2s infinite ease-in-out;
}
*/
