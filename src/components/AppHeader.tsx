'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, User, LogOut, Languages, MapPin, Clock, Sun, Moon, Settings } from 'lucide-react';
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
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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
        setDynamicSiteName(settings.name && typeof settings.name === 'string' && settings.name.trim() !== '' ? settings.name : siteConfig.name);
        setDynamicLogoUrl(settings.logoUrl && typeof settings.logoUrl === 'string' && settings.logoUrl.trim() !== '' ? settings.logoUrl : null);
      } else {
        setDynamicSiteName(siteConfig.name);
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
              <div className="relative h-12 w-12 flex-shrink-0 rounded bg-white overflow-hidden border border-border shadow-sm">
                <Image
                  src={dynamicLogoUrl}
                  alt={`${dynamicSiteName} Logo`}
                  fill
                  style={{ objectFit: 'contain' }}
                  sizes="48px"
                  data-ai-hint="company logo"
                />
              </div>
            )}
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
          </div>
          {/* Right: Icons */}
          <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-primary/10 hover:text-primary relative h-9 w-9 sm:h-10 sm:w-10"
              onClick={handleOpenCart}
              aria-label="Open cart"
            >
              <ShoppingCart size={24} />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold animate-bounce shadow-md">
                  {cartItems.length > 9 ? '9+' : cartItems.length}
                </span>
              )}
              <span className="sr-only">View Cart</span>
            </Button>

            {/* Language Switcher with Globe Icon and Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 hover:text-primary h-9 w-9 sm:h-10 sm:w-10 border border-border rounded-full">
                        <Languages size={22} />
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

            {/* Theme Switcher */}
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 hover:text-primary h-9 w-9 sm:h-10 sm:w-10 border border-border rounded-full" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </Button>

            {/* Avatar Dropdown */}
            {authLoading ? (
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 cursor-wait bg-muted rounded-full" />
            ) : firebaseUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0 border border-border">
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                      <AvatarImage
                        src={firebaseUser.photoURL || `https://images.unsplash.com/photo-1633332755192-727a05c4013d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHx1c2VyJTIwYXZhdGFyfGVufDB8fHx8MTc0NzEzOTg5NHww&ixlib=rb-4.1.0&q=80&w=1080`}
                        alt={firebaseUser.displayName || firebaseUser.email || "User"}
                        data-ai-hint="user avatar"
                      />
                      <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                        {getInitials(firebaseUser)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 shadow-2xl rounded-xl mt-2" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Hi, {firebaseUser.displayName || firebaseUser.email?.split('@')[0]}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {firebaseUser.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/account')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>My Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
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
