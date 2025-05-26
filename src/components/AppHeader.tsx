
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, User, LogOut, Languages, MapPin, Clock } from 'lucide-react';
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
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import CartSheet from '@/components/cart-sheet';
import { siteConfig } from '@/config/site';

interface AppHeaderProps {
  isCartOpen: boolean;
  onCartOpenChange: (isOpen: boolean) => void;
}

export default function AppHeader({ isCartOpen, onCartOpenChange: onCartOpenChangeProp }: AppHeaderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dynamicSiteName, setDynamicSiteName] = useState<string>(siteConfig.name);
  const [dynamicLogoUrl, setDynamicLogoUrl] = useState<string | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  const { items: cartItems } = useCart();
  const [currentLanguage, setCurrentLanguage] = useState('en');

  useEffect(() => {
    const fetchSiteSettings = async () => {
      try {
        if (!db) {
          console.warn("Firestore instance (db) is not available in AppHeader.");
          return;
        }
        const siteSettingsRef = doc(db, "siteConfiguration", "main");
        const docSnap = await getDoc(siteSettingsRef);
        if (docSnap.exists()) {
          const settings = docSnap.data();
          if (settings.name && typeof settings.name === 'string' && settings.name.trim() !== '') {
            setDynamicSiteName(settings.name);
          }
          if (settings.logoUrl && typeof settings.logoUrl === 'string' && settings.logoUrl.trim() !== '') {
            setDynamicLogoUrl(settings.logoUrl);
            console.log("Fetched dynamic logo URL:", settings.logoUrl);
          } else {
            console.log("No dynamic logo URL found in Firestore or it's empty.");
            setDynamicLogoUrl(null); // Ensure it's null if not found or empty
          }
        } else {
          console.log("No site settings document found in Firestore. Using default name and no logo.");
          setDynamicLogoUrl(null);
        }
      } catch (error) {
        console.error("Error fetching site settings for header:", error);
        // Keep default site name and no logo on error
        setDynamicLogoUrl(null);
      }
    };

    fetchSiteSettings();

    if (typeof onAuthStateChanged !== 'function' || !auth) {
      console.error("[AppHeader] onAuthStateChanged or Firebase auth instance is not available.");
      setAuthLoading(false);
      return;
    }
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);


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
    toast({
      title: "Language Changed",
      description: `Language set to ${lang === 'hi' ? 'हिन्दी' : 'English'}. Full content translation requires i18n setup.`,
    });
  };

  const handleOpenCart = useCallback(() => {
    onCartOpenChangeProp(true);
  }, [onCartOpenChangeProp]);


  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border shadow-sm">
        <div className="container mx-auto px-4 h-16 sm:h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="flex items-center gap-2 shrink-0 group">
              {dynamicLogoUrl && (
                <div className="relative h-8 w-8 sm:h-10 sm:w-10"> {/* Adjust size as needed */}
                  <Image
                    src={dynamicLogoUrl}
                    alt={`${dynamicSiteName} Logo`}
                    fill
                    style={{ objectFit: 'contain' }}
                    sizes="(max-width: 768px) 32px, 40px" // Example sizes, adjust as needed
                    onError={() => {
                      console.error("Failed to load dynamic logo:", dynamicLogoUrl);
                      setDynamicLogoUrl(null); // Fallback if image fails to load
                    }}
                    data-ai-hint="company logo"
                  />
                </div>
              )}
              <span className="text-xl sm:text-2xl font-bold text-primary app-title-animated group-hover:opacity-90 transition-opacity">
                {dynamicSiteName}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-primary/10 hover:text-primary relative h-8 w-8 sm:h-9 sm:w-9"
              onClick={handleOpenCart}
              aria-label="Open cart"
            >
              <ShoppingCart size={22} />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {cartItems.length > 9 ? '9+' : cartItems.length}
                </span>
              )}
              <span className="sr-only">View Cart</span>
            </Button>

            {authLoading ? (
               <Avatar className="h-8 w-8 sm:h-9 sm:w-9 cursor-wait bg-muted rounded-full" />
            ) : firebaseUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0">
                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
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
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{firebaseUser.displayName || firebaseUser.email?.split('@')[0]}</p>
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground hover:bg-primary/10 hover:text-primary h-8 w-8 sm:h-9 sm:w-9">
                  <Languages size={20} />
                  <span className="sr-only">Change language</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Select Language</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleLanguageChange('en')} className={currentLanguage === 'en' ? 'bg-accent text-accent-foreground' : ''}>
                  English (EN)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleLanguageChange('hi')} className={currentLanguage === 'hi' ? 'bg-accent text-accent-foreground' : ''}>
                  हिन्दी (HI)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <CartSheet open={isCartOpen} onOpenChange={onCartOpenChangeProp} />
    </>
  );
}
