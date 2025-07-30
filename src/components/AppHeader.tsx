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
import useAuth from '@/hooks/useAuth';

// --- Define a type for notifications ---
interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: any; // Using 'any' to accommodate both Firestore Timestamps and JS Date objects
  status: 'read' | 'unread';
  link?: string;
  [key: string]: any; // Allow other properties
}

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const { items: cartItems } = useCart();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const { t, i18n } = useTranslation();
  const { user, signOut, isCheckingAuth } = useAuth();

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
      const notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => n.status === 'unread').length);
    }, (error) => {
      console.error('[DEBUG] Firestore notifications listener error:', error);
    });
    return () => unsub();
  }, [firebaseUser]);

  // Listen for foreground notifications pushed via window event
  useEffect(() => {
    const handleNewNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      const newNotificationData = customEvent.detail;
      // Prevent duplicate notifications
      setNotifications(prevNotifications => {
        if (prevNotifications.some(n => n.id === newNotificationData.bookingId)) {
          return prevNotifications;
        }
        return [
          {
        id: newNotificationData.bookingId || Date.now().toString(),
        title: newNotificationData.title || 'Update',
        body: newNotificationData.body || '',
        createdAt: new Date(),
        status: 'unread',
        link: newNotificationData.link,
        ...newNotificationData
          },
          ...prevNotifications
        ];
      });
    };
    window.addEventListener('new-notification', handleNewNotification);
    return () => {
      window.removeEventListener('new-notification', handleNewNotification);
    };
  }, []);

  // Mark all as read when dropdown opens (optimistic update)
  useEffect(() => {
    if (notifDropdownOpen && notifications.length > 0 && db && firebaseUser) {
      const unreadIds = notifications.filter(n => n.status === 'unread').map(n => n.id);
      if (unreadIds.length > 0) {
        setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, status: 'read' } : n));
        setUnreadCount(0);
        unreadIds.forEach(id => {
          updateDoc(doc(db, 'notifications', id), { status: 'read' }).catch(err => {
            console.warn(`Failed to mark notification ${id} as read:`, err);
          });
      });
      }
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
      router.push('/login-otp');
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
              <Link href="/" aria-label="Go to Home">
                <div className="relative h-24 w-24 flex-shrink-0 cursor-pointer hover:scale-105 transition-transform">
                <Image
                  src={dynamicLogoUrl}
                  alt={`${dynamicSiteName} Logo`}
                  fill
                  style={{ objectFit: 'contain' }}
                    sizes="96px"
                  data-ai-hint="company logo"
                />
              </div>
              </Link>
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
            <DropdownMenu onOpenChange={setNotifDropdownOpen}>
              <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                  className="group text-foreground relative h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/60 dark:bg-[#23232b]/60 shadow-lg backdrop-blur-md border border-amber-200 dark:border-amber-800 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-br hover:from-amber-100 hover:to-yellow-100 dark:hover:from-amber-900 dark:hover:to-yellow-900 transition-all duration-200 focus:ring-2 focus:ring-amber-400"
              >
                  <Bell size={28} className="text-amber-600 group-hover:scale-110 group-hover:text-yellow-500 transition-all duration-200 drop-shadow" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-blue-500 text-white text-xs font-bold animate-bounce shadow-xl border-2 border-white dark:border-[#23232b]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end">
                <DropdownMenuLabel className="flex justify-between items-center">
                  <Bell size={18} /> Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <DropdownMenuItem key={notif.id} className={`flex items-start gap-3 p-3 ${notif.status === 'unread' ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full ${notif.status === 'unread' ? 'bg-blue-500' : 'bg-transparent'}`} />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{notif.title}</p>
                        <p className="text-xs text-muted-foreground">{notif.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString() : new Date(notif.createdAt).toLocaleString()}
                        </p>
                          </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Switcher - Enhanced */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="group text-foreground h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/60 dark:bg-[#23232b]/60 shadow-lg backdrop-blur-md border border-green-200 dark:border-green-800 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-br hover:from-green-100 hover:to-teal-100 dark:hover:from-green-900 dark:hover:to-teal-900 transition-all duration-200 focus:ring-2 focus:ring-green-400">
                        <Languages size={28} className="text-green-600 group-hover:text-teal-500 transition-all duration-200 drop-shadow" />
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

            {/* Theme Switcher - Enhanced */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="group text-foreground h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/60 dark:bg-[#23232b]/60 shadow-lg backdrop-blur-md border border-purple-200 dark:border-purple-800 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-br hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900 dark:hover:to-indigo-900 transition-all duration-200 focus:ring-2 focus:ring-purple-400" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={24} className="text-blue-700 group-hover:scale-110 group-hover:text-yellow-500 transition-all duration-200 drop-shadow" /> : <Sun size={24} className="text-yellow-400 group-hover:scale-110 group-hover:text-blue-500 transition-all duration-200 drop-shadow" />}
            </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Toggle Theme</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* User Profile / Login */}
            {authLoading ? (
              <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            ) : firebaseUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-11 w-11 rounded-full p-0">
                    <Avatar className="h-11 w-11 border-2 border-primary/50 hover:border-primary transition-all">
                      <AvatarImage src={firebaseUser.photoURL || ''} alt={firebaseUser.displayName || 'User'} />
                      <AvatarFallback>{getInitials(firebaseUser)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{firebaseUser.displayName || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{firebaseUser.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/account')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>My Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/wallet')}>
                    <Wallet className="mr-2 h-4 w-4" />
                    <span>My Wallet</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/admin')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Admin Panel</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={() => router.push('/login-otp')}>Login</Button>
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
