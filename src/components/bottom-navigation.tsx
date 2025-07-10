// src/components/bottom-navigation.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Scale, ShoppingCart, BadgePercent, User, Crown, Info } from 'lucide-react'; // Changed TestTube2 to Scale
import { cn } from '@/lib/utils';
import { useCartState } from '@/context/CartContext';
import React from 'react';
import { auth } from '@/lib/firebase/client';
import { getOrCreateUserDocument } from '@/lib/firebase/firestoreService';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  action?: () => void;
}

interface BottomNavigationProps {
  onCartIconClick?: () => void;
}

export default function BottomNavigation({ onCartIconClick }: BottomNavigationProps) {
  const pathname = usePathname();
  const { items: cartItems } = useCartState();
  const [userRole, setUserRole] = React.useState<'member' | 'non-member' | 'admin'>('non-member');

  React.useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      getOrCreateUserDocument(currentUser).then(userDoc => {
        setUserRole(userDoc?.role || 'non-member');
      });
    } else {
      setUserRole('non-member');
    }
  }, []);

  const navItems: NavItem[] = [
    { href: '/', label: 'Home', icon: Home, exact: true },
    { href: '/lab-tests', label: 'Compare Price', icon: Scale }, // Changed label and icon
    { href: '#', label: 'Cart', icon: ShoppingCart, action: onCartIconClick },
    { href: '/about', label: 'About Us', icon: Info },
    { href: '/account', label: 'Account', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.07)] h-16 z-50 md:hidden">
      <div className="container mx-auto h-full flex justify-around items-center px-1 sm:px-2">
        {navItems.map((item) => {
          const isComparePriceButton = item.label === 'Compare Price';
          const isActive = item.exact ? pathname === item.href : (item.href === '#' ? false : pathname.startsWith(item.href));

          const commonClassName = cn(
            "flex flex-col items-center justify-center text-center w-1/5 h-full relative group transition-all duration-200 ease-in-out rounded-lg",
            isActive
              ? (isComparePriceButton ? "text-accent-foreground font-semibold" : "text-primary font-semibold")
              : "text-muted-foreground hover:text-primary",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          );

          const iconContainerClassName = cn(
            "p-2 rounded-full transition-all duration-200 ease-in-out",
            isActive
              ? (isComparePriceButton ? "bg-accent scale-115 shadow-lg" : "bg-primary/15 scale-110")
              : "group-hover:bg-primary/10 group-hover:scale-105"
          );

          const iconClassName = cn(
            "h-5 w-5 sm:h-[22px] sm:w-[22px] mb-0.5",
            isActive
              ? (isComparePriceButton ? "text-accent-foreground" : "text-primary")
              : (isComparePriceButton ? "text-primary group-hover:text-accent-foreground" : ""),
            item.label === 'Cart' && cartItems.length > 0 && !isActive && "animate-cart-spin",
            item.label === 'Cart' && cartItems.length > 0 && isActive && "animate-cart-spin text-primary"
          );

          const labelClassName = cn(
            "text-[10px] sm:text-[11px] leading-tight mt-0.5",
             isActive
              ? (isComparePriceButton ? "text-accent-foreground" : "text-primary")
              : (isComparePriceButton ? "text-muted-foreground group-hover:text-accent-foreground" : "text-muted-foreground group-hover:text-primary")
          );

          const content = (
            <>
              <div className={iconContainerClassName}>
                {item.label === 'Account' && userRole === 'member' && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 animate-crown-shimmer">
                    <Crown className="h-5 w-5 text-yellow-600 drop-shadow" style={{ color: '#bfa100' }} />
                  </span>
                )}
                <item.icon className={iconClassName} />
              </div>
              <span className={labelClassName}>{item.label}</span>
              {item.label === 'Cart' && cartItems.length > 0 && (
                <span className="absolute top-1.5 right-1.5 sm:right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold ring-2 ring-card">
                  {cartItems.length > 9 ? '9+' : cartItems.length}
                </span>
              )}
            </>
          );

          if (item.action) {
            return (
              <button key={item.label} onClick={item.action} className={commonClassName}>
                {content}
              </button>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={commonClassName}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
