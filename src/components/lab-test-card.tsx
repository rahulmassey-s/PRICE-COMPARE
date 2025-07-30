'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { LabTest, ContactDetails, LabPrice as LabPriceType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Phone, MessageSquare, Copy, Check, Percent, ShoppingCart, Star, Building, TagIcon, MinusCircle, Eye, Info, X as XIcon, Crown, Smile, Lock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleComponent,
  DialogDescription as DialogDescriptionComponent,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { logUserActivity } from '@/lib/firebase/firestoreService';
import { auth } from '@/lib/firebase/client';
import { db } from '@/lib/firebase/client';
import { collection, getDocs } from 'firebase/firestore';
import { subscribeToLabsRealtime } from '@/lib/firebase/firestoreService';

interface LabTestCardProps {
  test: LabTest;
  contactDetails: ContactDetails;
  onCardClick?: (test: LabTest) => void;
  userRole?: 'member' | 'non-member' | 'admin';
  onAddToCartRequest?: (itemToAdd: any) => void;
}

function LabTestCardComponent({ test, contactDetails, onCardClick, userRole = 'non-member', onAddToCartRequest }: LabTestCardProps) {
  console.log('LabTestCard received test:', test); 

  const [expandedLabPriceId, setExpandedLabPriceId] = useState<string | null>(null);
  const [generatedCoupons, setGeneratedCoupons] = useState<Record<string, string>>({});
  const [copiedStatus, setCopiedStatus] = useState<Record<string, boolean>>({});
  const [openLabDetailsIndex, setOpenLabDetailsIndex] = useState<number | null>(null);
  const [showDescriptionBox, setShowDescriptionBox] = useState(false);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftCueMobile, setShowLeftCueMobile] = useState(false);
  const [showRightCueMobile, setShowRightCueMobile] = useState(false);
  const [showSwipeHintMobile, setShowSwipeHintMobile] = useState(false);
  const [showLeftCueDesktop, setShowLeftCueDesktop] = useState(false);
  const [showRightCueDesktop, setShowRightCueDesktop] = useState(false);
  const [showSwipeHintDesktop, setShowSwipeHintDesktop] = useState(false);
  const [openLabLocation, setOpenLabLocation] = useState<string | null>(null);
  const [labLocations, setLabLocations] = useState<Record<string, string>>({});
  const [labsMap, setLabsMap] = useState<{ [id: string]: string }>({});
  
  const { toast } = useToast();
  const { addToCart, items: cartItems, removeFromCart } = useCart();

  const minMemberPrice = useMemo(() => {
    if (!test.prices || test.prices.length === 0) return Infinity;
    const memberPrices = test.prices
      .map(p => (typeof p.memberPrice === 'number' && p.memberPrice > 0 ? p.memberPrice : undefined))
      .filter(p => typeof p === 'number');
    return memberPrices.length > 0 ? Math.min(...memberPrices) : Infinity;
  }, [test.prices]);

  const minNonMemberPrice = useMemo(() => {
    if (!test.prices || test.prices.length === 0) return Infinity;
    return Math.min(...test.prices.map(p => p.price));
  }, [test.prices]);

  const minPriceData = useMemo(() => {
    if (!test.prices || test.prices.length === 0) {
      return { price: Infinity, labs: [] as LabPriceType[], originalPriceAtMin: undefined };
    }
    const minP = Math.min(...test.prices.map(p => p.price));
    const labsOfferingMin = test.prices.filter(p => p.price === minP);
    const firstLabAtMin = labsOfferingMin.length > 0 ? labsOfferingMin[0] : undefined;
    const originalPriceAtMin = firstLabAtMin?.originalPrice;

    return { price: minP, labs: labsOfferingMin, originalPriceAtMin };
  }, [test.prices]);

  const minPrice = minPriceData.price;
  const bestPriceLabs = minPriceData.labs;

  const generateCouponCode = (labName: string, testName: string): string => {
    const labInitials = labName.substring(0, 3).toUpperCase().replace(/\s+/g, '');
    const testAbbr = testName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3);
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${labInitials}-${testAbbr}-${randomPart}`;
  };

  const handleToggleDiscount = useCallback((e: React.MouseEvent, labPriceId: string, labName: string) => {
    e.stopPropagation();
    setExpandedLabPriceId(prevId => {
      if (prevId === labPriceId) {
        return null;
      } else {
        if (!generatedCoupons[labPriceId]) {
          const coupon = generateCouponCode(labName, test.name);
          setGeneratedCoupons(prevCoupons => ({ ...prevCoupons, [labPriceId]: coupon }));
        }
        return labPriceId;
      }
    });
  }, [generatedCoupons, test.name]);

  const handleCopyCoupon = useCallback(async (e: React.MouseEvent, couponCode: string, labPriceId: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(couponCode);
      toast({
        title: "Coupon Copied!",
        description: `Coupon ${couponCode} copied to clipboard.`,
      });
      setCopiedStatus(prev => ({ ...prev, [labPriceId]: true }));
      setTimeout(() => {
        setCopiedStatus(prev => ({ ...prev, [labPriceId]: false }));
      }, 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy coupon to clipboard.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const generateWhatsappUrl = useCallback((labName: string, couponCode: string | undefined) => {
    const baseMessage = contactDetails.whatsappMessage || `Hello! I am interested in a lab test discount.`;
    let testSpecificMessage = `${baseMessage} Test: ${test.name} from ${labName}.`;
    if (couponCode) {
      testSpecificMessage += ` My Coupon Code is: ${couponCode}.`;
    }
    return `https://wa.me/${contactDetails.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(testSpecificMessage)}`;
  }, [contactDetails.whatsapp, contactDetails.whatsappMessage, test.name]);

  const getDisplayLabName = useCallback((priceInfo: LabPriceType) => {
    // Always use the real-time lab data from labsMap if available, fallback to stored labName
    return labsMap[priceInfo.labId] || priceInfo.labName || '';
  }, [labsMap]);

  const handleAddToCart = useCallback((priceInfo: LabPriceType) => {
    const displayLabName = getDisplayLabName(priceInfo);
    const itemToAdd = {
      testDocId: test.docId,
      testName: test.name,
      testImageUrl: test.imageUrl,
      labName: displayLabName,
      price: priceInfo.price,
      nonMemberPrice: priceInfo.price,
      originalPrice: priceInfo.originalPrice,
      memberPrice: (typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice > 0)
        ? priceInfo.memberPrice
        : undefined,
    };
    
    if (onAddToCartRequest) {
      onAddToCartRequest(itemToAdd);
      return; // Return early as the handler will show its own toast
    }

    // Fallback original logic
    addToCart(itemToAdd);
    toast({
      title: "Added to Cart",
      description: `${test.name} from ${displayLabName} added to your cart.`,
    });

    // Robust best price notification logic
    const isMember = userRole === 'member';
    const currentMemberPrice = typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice > 0 ? priceInfo.memberPrice : undefined;
    const bestMemberPrice = minMemberPrice !== Infinity ? minMemberPrice : undefined;
    const bestNonMemberPrice = minNonMemberPrice !== Infinity ? minNonMemberPrice : undefined;

    if (isMember && currentMemberPrice !== undefined && bestMemberPrice !== undefined && currentMemberPrice > bestMemberPrice) {
      // Show member best price notification
      const bestLabs = test.prices.filter(p => typeof p.memberPrice === 'number' && p.memberPrice === bestMemberPrice).map(p => getDisplayLabName(p));
      toast({
        title: "Best Price Available!",
        description: `Get ${test.name} for ₹${bestMemberPrice.toFixed(2)} at ${bestLabs.join('/')}. Consider adding it.`,
        duration: 7000,
        variant: "default",
      });
    } else if (!isMember && bestNonMemberPrice !== undefined && priceInfo.price > bestNonMemberPrice) {
      // Show non-member best price notification
      const bestLabs = test.prices.filter(p => p.price === bestNonMemberPrice).map(p => getDisplayLabName(p));
      toast({
        title: "Best Price Available!",
        description: `Get ${test.name} for ₹${bestNonMemberPrice.toFixed(2)} at ${bestLabs.join('/')}. Consider adding it.`,
        duration: 7000,
        variant: "default",
      });
    }
  }, [addToCart, test, userRole, minMemberPrice, minNonMemberPrice, toast, onAddToCartRequest, getDisplayLabName]);

  const handleRemoveFromCart = useCallback((priceInfo: LabPriceType) => {
    const displayLabName = getDisplayLabName(priceInfo);
    removeFromCart(test.docId, displayLabName);
    toast({
      title: "Removed from Cart",
      description: `${test.name} from ${displayLabName} removed from your cart.`,
      variant: "default"
    });
  }, [removeFromCart, test.docId, test.name, toast, getDisplayLabName]);

  const handleCartAction = useCallback((e: React.MouseEvent, priceInfo: LabPriceType, inCart: boolean) => {
    e.stopPropagation();
    if (inCart) {
      handleRemoveFromCart(priceInfo);
    } else {
      handleAddToCart(priceInfo);
    }
  }, [handleAddToCart, handleRemoveFromCart]);

  const isItemInCart = useCallback((priceInfo: LabPriceType) => {
    const displayLabName = getDisplayLabName(priceInfo);
    return cartItems.some(item => item.testDocId === test.docId && item.labName === displayLabName);
  }, [cartItems, test.docId, getDisplayLabName]);

  const isValidHttpUrl = (url: string | undefined | null): boolean => {
    if (typeof url !== 'string' || url.trim() === '') return false;
    return url.trim().startsWith('http://') || url.trim().startsWith('https://');
  };

  const hasValidImage = isValidHttpUrl(test.imageUrl) && test.imageUrl;
  const effectiveImageUrl = hasValidImage ? test.imageUrl : undefined;

  const handleTestCardClick = () => {
    try {
      const user = auth.currentUser;
      const userId = user && user.uid ? user.uid : '';
      const userName = user && user.displayName ? user.displayName : null;
      const userEmail = user && user.email ? user.email : null;
      const testId = test.docId || test.id || '';
      const testName = test.name || '';
      const labName = (test.prices && test.prices[0] && test.prices[0].labName) || '';
      if (userId && testId) {
        logUserActivity(userId, 'test_view', { testId, testName, labName: labName || '' }, userName ?? undefined, userEmail ?? undefined);
      }
    } catch (e) {}
  };

  // Subscribe to labs in real-time to update labsMap and labLocations
  useEffect(() => {
    const unsubscribe = subscribeToLabsRealtime((labs) => {
      const map: { [id: string]: string } = {};
      const locations: Record<string, string> = {};
      labs.forEach(lab => {
        map[lab.id] = lab.name;
        if (lab.name) {
          locations[lab.name] = lab.location || '';
        }
      });
      setLabsMap(map);
      setLabLocations(locations);
    });
    return () => unsubscribe();
  }, []);

  // --- FINAL TABLE STYLES FOR HORIZONTAL WIDE COLUMNS, NO VERTICAL STRETCH ---
  const fontFamily = `'Inter', 'Roboto', Arial, sans-serif`;
  const borderColor = '#e5e7eb';
  const headerGradient = 'linear-gradient(90deg, #e0e7ff 0%, #f0f9ff 100%)';
  const tableHeaderStyle = {
    border: `2px solid ${borderColor}`,
    background: headerGradient,
    color: '#2563eb',
    fontWeight: 700,
    fontSize: '1.08rem',
    textAlign: 'center' as const,
    padding: '10px 8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.2px',
    fontFamily,
    borderBottom: `3px solid #d1d5db`,
    width: 150,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    userSelect: 'none' as const,
  };
  const tableHeaderLabName = {
    ...tableHeaderStyle,
    width: 260,
    textAlign: 'left' as const,
    paddingLeft: 16,
  };
  const tableHeaderBook = {
    ...tableHeaderStyle,
    width: 180,
    background: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)',
    color: 'white',
    fontWeight: 800,
    fontSize: '1.08rem',
    letterSpacing: '1.5px',
  };
  const tableCellLabName = {
    border: `2px solid ${borderColor}`,
    background: '#e0f2fe',
    color: '#0f172a',
    fontWeight: 600,
    fontSize: '1.02rem',
    textAlign: 'left' as const,
    padding: '10px 16px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontFamily,
    width: 260,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    borderLeft: `4px solid #2563eb`,
    borderRadius: '12px 0 0 12px',
  };
  const tableCellLabPrice = {
    border: `2px solid ${borderColor}`,
    background: '#f1f5f9',
    color: '#64748b',
    fontWeight: 500,
    fontSize: '1.02rem',
    textAlign: 'center' as const,
    padding: '10px 8px',
    textDecoration: 'line-through',
    fontFamily,
    width: 150,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  };
  const tableCellNonMember = {
    border: `2px solid ${borderColor}`,
    background: '#fff',
    color: '#f59e42',
    fontWeight: 600,
    fontSize: '1.08rem',
    textAlign: 'center' as const,
    padding: '10px 8px',
    fontFamily,
    width: 150,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  };
  const tableCellMember = {
    border: `2px solid ${borderColor}`,
    background: '#fff',
    color: '#bfa100',
    fontWeight: 700,
    fontSize: '1.08rem',
    textAlign: 'center' as const,
    padding: '10px 8px',
    fontFamily,
    width: 150,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    letterSpacing: '0.5px',
  };
  const bookBtnStyle = {
    background: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
    color: 'white',
    fontWeight: 700,
    border: 'none',
    borderRadius: '999px',
    padding: '10px 0',
    cursor: 'pointer',
    fontSize: '1.02rem',
    fontFamily,
    letterSpacing: '0.5px',
    boxShadow: '0 2px 12px #2563eb22',
    transition: 'background 0.2s, box-shadow 0.2s, transform 0.18s',
    outline: 'none',
    width: '100%',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    display: 'inline-block',
  };
  const bookBtnHover = {
    background: 'linear-gradient(90deg, #1d4ed8 0%, #0ea5e9 100%)',
    boxShadow: '0 6px 24px #2563eb33',
    transform: 'scale(1.08)',
  };
  // Modern crown SVG
  const crownIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffe066" stroke="#bfa100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6, verticalAlign: 'middle', filter: 'drop-shadow(0 1px 2px #fff8)' }}><path d="M12 2l2.09 6.26L20 9.27l-5 4.87L16.18 21 12 17.27 7.82 21 9 14.14l-5-4.87 5.91-.91z" /></svg>
  );

  // Fade-in animation for card
  const cardFadeIn = {
    animation: 'fadeInCard 0.7s cubic-bezier(.4,0,.2,1) 1',
  };
  // Add keyframes in a style tag (will inject below)

  useEffect(() => {
    const el = mobileScrollRef.current;
    if (!el) return;
    el.scrollLeft = 40;
    setTimeout(() => { el.scrollLeft = 0; }, 600);
    setShowSwipeHintMobile(el.scrollWidth > el.clientWidth);
    const handleScroll = () => {
      setShowLeftCueMobile(el.scrollLeft > 4);
      setShowRightCueMobile(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    handleScroll();
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [test]);
  useEffect(() => {
    const el = desktopScrollRef.current;
    if (!el) return;
    setShowSwipeHintDesktop(el.scrollWidth > el.clientWidth);
    const handleScroll = () => {
      setShowLeftCueDesktop(el.scrollLeft > 4);
      setShowRightCueDesktop(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    handleScroll();
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [test]);

  return (
    <>
      <style>{`
        @keyframes fadeInCard { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: none; } }
        .enhanced-table-card:hover { box-shadow: 0 12px 40px #2563eb22, 0 2px 8px #2563eb11; transform: translateY(-4px) scale(1.012); transition: box-shadow 0.25s, transform 0.22s; }
        @keyframes pulseBest {
          0%, 100% { box-shadow: 0 0 0 0 #4ade80; }
          50% { box-shadow: 0 0 0 8px #bbf7d0; }
        }
        .animate-pulse-best { animation: pulseBest 1.5s infinite; }
        .lab-pill { background: linear-gradient(90deg, #e0e7ff 0%, #f0f9ff 100%); color: #2563eb; font-weight: 700; border-radius: 999px; padding: 1.5px 7px; font-size: 0.82rem; box-shadow: 0 2px 8px #2563eb11; display: inline-block; }
        .book-btn-animated { transition: transform 0.12s, box-shadow 0.18s, background 0.18s; }
        .book-btn-animated:active { transform: scale(0.97); box-shadow: 0 2px 8px #2563eb33; }
        .book-btn-animated:focus { outline: 2px solid #2563eb; outline-offset: 2px; }
        .best-tooltip { position: relative; cursor: pointer; }
        .best-tooltip:hover .best-tooltip-text, .best-tooltip:focus .best-tooltip-text { opacity: 1; pointer-events: auto; }
        .best-tooltip-text { opacity: 0; pointer-events: none; position: absolute; top: 120%; left: 50%; transform: translateX(-50%); background: #166534; color: #fff; padding: 3px 7px; border-radius: 6px; font-size: 0.75rem; white-space: nowrap; z-index: 10; box-shadow: 0 2px 8px #16653433; transition: opacity 0.18s; }
        @media (max-width: 480px) {
          .lab-pill { font-size: 0.95rem; padding: 1.5px 5px; }
          .enhanced-table-card h2 { font-size: 0.95rem !important; }
          .enhanced-table-card th, .enhanced-table-card td { font-size: 0.88rem !important; padding: 4px 1px !important; }
          .enhanced-table-card button { font-size: 0.82rem !important; padding: 4px 0.3rem !important; }
        }
        .modern-swipe-left-arrow {
          display: inline-block;
          animation: modern-swipe-left-bounce 1.3s infinite cubic-bezier(0.4,0,0.2,1);
          filter: drop-shadow(0 4px 16px #38bdf855);
          margin-bottom: 0;
        }
        @keyframes modern-swipe-left-bounce {
          0%, 100% { transform: translateX(0) scale(1); }
          40% { transform: translateX(-18px) scale(1.08); }
          60% { transform: translateX(-12px) scale(1.04); }
        }
        .canva-style-arrow {
          display: inline-block;
          animation: canva-arrow-bounce 1.3s infinite cubic-bezier(0.4,0,0.2,1);
          margin-bottom: 0;
        }
        @keyframes canva-arrow-bounce {
          0%, 100% { transform: translateX(0) scale(1); }
          40% { transform: translateX(-18px) scale(1.08); }
          60% { transform: translateX(-12px) scale(1.04); }
        }
      `}</style>
      <Card className="enhanced-table-card shadow-xl rounded-2xl overflow-hidden flex flex-col h-full bg-white border-2 border-blue-200 relative" style={{ width: '100%', margin: '0 auto', fontFamily, ...cardFadeIn, maxWidth: 420 }}>
        {/* Gradient accent border at top */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-blue-200 to-blue-400 z-10" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
        {/* Top Banner Image (only if image exists) */}
        {typeof effectiveImageUrl === 'string' && effectiveImageUrl && (
          <div className="relative w-full" style={{ height: 210, borderBottom: `2px solid ${borderColor}` }}>
          <Image
            src={effectiveImageUrl}
            alt={test.name}
            fill
              style={{ objectFit: 'cover' }}
              className="bg-card"
            priority={false}
              quality={95}
            />
          </div>
        )}
        {/* Test Name Banner - modern, enhanced */}
        <div className="w-full flex justify-center items-center py-3 bg-white border-b-2 border-blue-100">
          <h2
            className="text-2xl sm:text-3xl font-extrabold tracking-wide text-center leading-tight drop-shadow"
                    style={{
              fontFamily: "'Inter', 'Roboto', Arial, sans-serif",
              letterSpacing: '0.04em',
              textShadow: '0 2px 8px #2563eb22'
                    }}
                  >
            <span className="bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 bg-clip-text text-transparent">
              {test.name}
                  </span>
          </h2>
              </div>
        {/* Screenshot-perfect test card: full headers, blue details button, perfect alignment, no overlap, no scroll */}
        <div className="w-full">
          <div className="rounded-2xl border border-blue-200 shadow-sm bg-white overflow-hidden w-full">
            <table className="w-full" style={{ fontSize: '0.95rem', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-[11px] py-2.5 px-2 text-left rounded-tl-xl" style={{borderRight: '1.5px solid #dbeafe'}}>LAB NAME</th>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-[11px] py-2.5 px-2 text-center" style={{borderRight: '1.5px solid #dbeafe'}}>LAB PRICE</th>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-[11px] py-2.5 px-2 text-center" style={{borderRight: '1.5px solid #dbeafe'}}>NON MEMBER</th>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-[11px] py-2.5 px-2 text-center" style={{borderRight: '1.5px solid #dbeafe'}}>
                    MEMBER <span className="inline-block align-middle ml-1"><svg width="12" height="12" fill="#facc15" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 9.27l-5 4.87L16.18 21 12 17.27 7.82 21 9 14.14l-5-4.87 5.91-.91z"/></svg></span>
                  </th>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-[11px] py-2.5 px-2 text-center rounded-tr-xl">BOOK TEST</th>
                </tr>
              </thead>
              <tbody>
                {test.prices && test.prices.length > 0 ? (
                  test.prices.map((priceInfo, idx) => {
                    // Always use the real-time lab data from labsMap if available, fallback to stored labName
                    const realTimeLabName = labsMap[priceInfo.labId];
                    const mainLabName = (realTimeLabName || priceInfo.labName || '').replace(/\s*lab$/i, '');
                    const displayLabName = realTimeLabName || priceInfo.labName || '';
            return (
                      <tr key={priceInfo.labName + idx} className={idx % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                        <td className="py-2.5 px-2 text-left align-middle font-bold text-blue-700 text-[11px] rounded-l-xl min-w-[110px]" style={{ lineHeight: 1.2 }}>
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="block font-semibold text-[13px] text-blue-800 mb-1" style={{ letterSpacing: '0.5px' }}>{mainLabName}</span>
                            <span className="block text-[10px] text-blue-700 tracking-widest font-semibold uppercase flex items-center gap-1">
                              LAB
                              <button
                                type="button"
                                className="ml-0.5 p-0.5 rounded-full hover:bg-blue-100 focus:outline-none"
                                style={{ lineHeight: 0, height: 16, width: 16 }}
                                onClick={e => { e.stopPropagation(); setOpenLabLocation(displayLabName); }}
                                tabIndex={0}
                                aria-label={`Show location for ${mainLabName}`}
                              >
                                <Info className="h-3 w-3 text-blue-700" />
                              </button>
                  </span>
                </div>
                        </td>
                        <td className="py-2.5 px-2 text-center align-middle font-bold text-[11px]" style={{ lineHeight: 1.2 }}>
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {priceInfo.originalPrice && priceInfo.originalPrice > priceInfo.price && (
                              <span className="block line-through text-gray-400 break-words" style={{ fontSize: '1.1rem' }}>₹{priceInfo.originalPrice.toFixed(0)}/-</span>
                  )}
                </div>
                        </td>
                        <td className="py-2.5 px-2 text-center align-middle font-bold text-[11px]" style={{ lineHeight: 1.2 }}>
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className={cn(
                              "inline-block break-words w-full modern-price-font",
                              userRole === 'member'
                                ? 'text-orange-700'
                                : (priceInfo.price === minNonMemberPrice ? 'text-green-700 bg-green-50 px-1.5 py-0.5 rounded-lg ring-2 ring-green-300 animate-pulse-best best-tooltip' : 'text-orange-700')
                            )} style={{ fontSize: '0.8rem' }}>
                              ₹{priceInfo.price.toFixed(0)}/-
                            </span>
                            {userRole !== 'member' && priceInfo.price === minNonMemberPrice && (
                              <span className="mt-0.5 inline-block text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-bold animate-pulse-best best-tooltip" tabIndex={0} aria-label="Best price" role="tooltip">
                                <svg className="inline mr-0.5" width="10" height="10" fill="#16a34a" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>Best
                                <span className="best-tooltip-text">Lowest price for non-members!</span>
                      </span>
                      )}
                    </div>
                        </td>
                        <td className="py-2.5 px-2 text-center align-middle font-bold text-[11px]" style={{ lineHeight: 1.2 }}>
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className={cn(
                              "inline-block break-words w-full modern-price-font",
                              userRole === 'member' && typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice === minMemberPrice 
                                ? 'bg-green-50 px-1.5 py-0.5 rounded-lg ring-2 ring-green-300 animate-pulse-best best-tooltip text-green-700' 
                                : 'text-yellow-800'
                            )} style={{ fontSize: '1.1rem' }}>
                              ₹{typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice > 0 ? priceInfo.memberPrice.toFixed(0) : priceInfo.price.toFixed(0)}/-
                            </span>
                            {userRole === 'member' && typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice === minMemberPrice && (
                              <span className="mt-0.5 inline-block text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-bold animate-pulse-best best-tooltip" tabIndex={0} aria-label="Best member price" role="tooltip">
                                <svg className="inline mr-0.5" width="10" height="10" fill="#16a34a" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>Best
                                <span className="best-tooltip-text">Lowest price for members!</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center align-middle rounded-r-xl">
                          <div className="flex flex-col justify-center gap-1">
                            <Button
                              onClick={e => { e.stopPropagation(); handleCartAction(e, priceInfo, isItemInCart(priceInfo)); }}
                              variant={isItemInCart(priceInfo) ? 'outline' : 'default'}
                              className={cn(
                                "bg-gradient-to-r from-sky-400 to-blue-500 text-white font-bold text-[11px] w-full max-w-[80px] py-2 rounded-xl shadow transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 book-btn-animated flex items-center justify-center gap-1",
                                isItemInCart(priceInfo) && "border-destructive text-destructive hover:bg-destructive/10"
                              )}
                              type="button"
                            >
                              {isItemInCart(priceInfo) ? (
                                <>
                                  <MinusCircle className="mr-1 h-3.5 w-3.5" /> Remove
                                </>
                              ) : (
                                <>
                              <svg width="12" height="12" fill="#fff" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <span className="ml-0.5">Book</span>
                                </>
                              )}
                            </Button>
                            <button
                              className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-600 font-semibold text-[10px] w-full max-w-[80px] py-1.5 rounded-lg transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300 flex items-center justify-center gap-0.5"
                              onClick={() => setOpenLabDetailsIndex(idx)}
                              type="button"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                              <span>Details</span>
                            </button>
                          </div>
                        </td>
                      </tr>
            );
          })
        ) : (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-4">No pricing information available.</td></tr>
                )}
              </tbody>
            </table>
              </div>
              </div>
      </Card>
      {/* Canva-style modern blue gradient left arrow below the card */}
      <div className="flex justify-center mt-3">
        <span className="canva-style-arrow">
          <svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="canvaArrowGradient" x1="0" y1="30" x2="120" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4fc3f7"/>
                <stop offset="1" stopColor="#2563eb"/>
              </linearGradient>
              <filter id="canvaArrowShadow" x="-8" y="-8" width="136" height="76">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2563eb55"/>
              </filter>
            </defs>
            <polygon
              points="0,15 80,15 80,0 120,30 80,60 80,45 0,45"
              fill="url(#canvaArrowGradient)"
              filter="url(#canvaArrowShadow)"
              stroke="#2563eb"
              strokeWidth="2"
              rx="8"
            />
            <ellipse cx="70" cy="25" rx="18" ry="6" fill="#fff" fillOpacity="0.18"/>
          </svg>
        </span>
              </div>
      {/* Description Box Modal */}
      {openLabDetailsIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in-up">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xl font-bold focus:outline-none"
              onClick={() => setOpenLabDetailsIndex(null)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-extrabold text-blue-700 mb-2 text-center">{test.name}</h2>
            <div className="text-gray-700 text-base whitespace-pre-line text-center max-h-[60vh] overflow-y-auto pr-2">
              {test.prices && test.prices[openLabDetailsIndex]?.labDescription?.trim()
                ? test.prices[openLabDetailsIndex].labDescription
                : (test.description || 'No description available.')}
              </div>
              </div>
            </div>
      )}
      {openLabLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full p-5 relative animate-fade-in-up">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-xl font-bold focus:outline-none"
              onClick={() => setOpenLabLocation(null)}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="text-lg font-bold text-blue-700 mb-2 text-center flex items-center justify-center gap-1">
              <Building className="h-5 w-5 text-blue-400" /> {openLabLocation}
            </h3>
            <div className="text-gray-700 text-sm text-center">
              {labLocations[openLabLocation]?.trim()
                ? labLocations[openLabLocation]
                : 'Location not available'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const LabTestCard = React.memo(LabTestCardComponent);
export default LabTestCard;

/*
.member-price-badge-glass {
  background: rgba(255,255,255,0.85);
  border-radius: 1.2rem;
  box-shadow: 0 4px 24px 0 rgba(34,197,94,0.10), 0 1.5px 8px 0 rgba(255,215,0,0.10);
  border: 2.5px solid;
  border-image: linear-gradient(90deg, #34d399 0%, #fde68a 50%, #059669 100%) 1;
  padding: 0.7rem 1.2rem 0.7rem 1.2rem;
  margin-bottom: 0.2rem;
  backdrop-filter: blur(8px) saturate(1.2);
  min-width: 140px;
  max-width: 90%;
  z-index: 2;
  position: relative;
  transition: box-shadow 0.2s, border 0.2s, background 0.2s, transform 0.2s;
}
@media (max-width: 500px) {
  .member-price-badge-glass { min-width: 110px; padding: 0.5rem 0.7rem; }
}
@keyframes member-price-shimmer {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3) drop-shadow(0 0 12px #34d399); }
}
.animate-member-price-shimmer {
  animation: member-price-shimmer 1.8s infinite;
}
@keyframes member-price-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}
.animate-member-price-pulse {
  animation: member-price-pulse 1.8s infinite;
}
.drop-shadow-member-price-glow {
  filter: drop-shadow(0 0 8px #6ee7b7) drop-shadow(0 0 2px #facc15);
}
@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  20% { transform: translateY(-10px); }
  40% { transform: translateY(0); }
  60% { transform: translateY(-5px); }
  80% { transform: translateY(0); }
}
.animate-bounce-slow {
  animation: bounce-slow 2.2s infinite;
}
*/
