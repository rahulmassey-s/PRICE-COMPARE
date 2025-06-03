'use client';

import React, { useState, useMemo, useCallback } from 'react';
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

interface LabTestCardProps {
  test: LabTest;
  contactDetails: ContactDetails;
  onCardClick?: (test: LabTest) => void;
  userRole?: 'member' | 'non-member' | 'admin';
}

function LabTestCardComponent({ test, contactDetails, onCardClick, userRole = 'non-member' }: LabTestCardProps) {
  console.log('LabTestCard received test:', test); 

  const [expandedLabPriceId, setExpandedLabPriceId] = useState<string | null>(null);
  const [generatedCoupons, setGeneratedCoupons] = useState<Record<string, string>>({});
  const [copiedStatus, setCopiedStatus] = useState<Record<string, boolean>>({});
  const [openLabDetailsIndex, setOpenLabDetailsIndex] = useState<number | null>(null);
  const [showDescriptionBox, setShowDescriptionBox] = useState(false);
  
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

  const handleAddToCart = useCallback((priceInfo: LabPriceType) => {
    const itemToAdd = {
      testDocId: test.docId,
      testName: test.name,
      testImageUrl: test.imageUrl,
      labName: priceInfo.labName,
      price: priceInfo.price,
      nonMemberPrice: priceInfo.price,
      originalPrice: priceInfo.originalPrice,
      memberPrice: (typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice > 0)
        ? priceInfo.memberPrice
        : undefined,
    };
    addToCart(itemToAdd);
    toast({
      title: "Added to Cart",
      description: `${test.name} from ${priceInfo.labName} added to your cart.`,
    });

    // Robust best price notification logic
    const isMember = userRole === 'member';
    const currentMemberPrice = typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice > 0 ? priceInfo.memberPrice : undefined;
    const bestMemberPrice = minMemberPrice !== Infinity ? minMemberPrice : undefined;
    const bestNonMemberPrice = minNonMemberPrice !== Infinity ? minNonMemberPrice : undefined;

    if (isMember && currentMemberPrice !== undefined && bestMemberPrice !== undefined && currentMemberPrice > bestMemberPrice) {
      // Show member best price notification
      const bestLabs = test.prices.filter(p => typeof p.memberPrice === 'number' && p.memberPrice === bestMemberPrice).map(p => p.labName);
      toast({
        title: "Best Price Available!",
        description: `Get ${test.name} for ₹${bestMemberPrice.toFixed(2)} at ${bestLabs.join('/')}. Consider adding it.`,
        duration: 7000,
        variant: "default",
      });
    } else if (!isMember && priceInfo.price > bestNonMemberPrice && bestNonMemberPrice !== undefined) {
      // Show non-member best price notification
      const bestLabs = test.prices.filter(p => p.price === bestNonMemberPrice).map(p => p.labName);
      toast({
        title: "Best Price Available!",
        description: `Get ${test.name} for ₹${bestNonMemberPrice.toFixed(2)} at ${bestLabs.join('/')}. Consider adding it.`,
        duration: 7000,
        variant: "default",
      });
    }
  }, [addToCart, test, userRole, minMemberPrice, minNonMemberPrice, toast]);

  const handleRemoveFromCart = useCallback((priceInfo: LabPriceType) => {
    removeFromCart(test.docId, priceInfo.labName);
    toast({
      title: "Removed from Cart",
      description: `${test.name} from ${priceInfo.labName} removed from your cart.`,
      variant: "default"
    });
  }, [removeFromCart, test.docId, test.name, toast]);

  const handleCartAction = useCallback((e: React.MouseEvent, priceInfo: LabPriceType, inCart: boolean) => {
    e.stopPropagation();
    if (inCart) {
      handleRemoveFromCart(priceInfo);
    } else {
      handleAddToCart(priceInfo);
    }
  }, [handleAddToCart, handleRemoveFromCart]);

  const isItemInCart = useCallback((labName: string) => {
    return cartItems.some(item => item.testDocId === test.docId && item.labName === labName);
  }, [cartItems, test.docId]);

  const isValidHttpUrl = (url: string | undefined | null): boolean => {
    if (typeof url !== 'string' || url.trim() === '') return false;
    return url.trim().startsWith('http://') || url.trim().startsWith('https://');
  };

  const hasValidImage = isValidHttpUrl(test.imageUrl || test.testImageUrl) && (test.imageUrl || test.testImageUrl);
  const effectiveImageUrl = hasValidImage ? (test.imageUrl || test.testImageUrl) : undefined;

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
        logUserActivity(userId, 'test_view', { testId, testName, labName }, userName, userEmail);
      }
    } catch (e) {}
  };

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

  return (
    <>
      <style>{`
        @keyframes fadeInCard { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: none; } }
        .enhanced-table-card:hover { box-shadow: 0 12px 40px #2563eb22, 0 2px 8px #2563eb11; transform: translateY(-4px) scale(1.012); transition: box-shadow 0.25s, transform 0.22s; }
      `}</style>
      <Card className="enhanced-table-card shadow-xl rounded-2xl overflow-hidden flex flex-col h-full bg-white" style={{ width: '100%', margin: '0 auto', border: `2px solid ${borderColor}`, fontFamily, ...cardFadeIn }}>
        {/* Top Banner Image (only if image exists) */}
        {hasValidImage && (
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
        {/* Mobile: Custom colorful table like desktop color pattern */}
        <div className="block sm:hidden w-full">
          <div className="overflow-x-auto">
            <table className="w-full rounded-lg overflow-hidden">
              <thead>
                <tr>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-sm sm:text-base px-1 py-2 text-center">LAB NAME</th>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-sm sm:text-base px-1 py-2 text-center">LAB PRICE</th>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-sm sm:text-base px-1 py-2 text-center">NON MEMBER</th>
                  <th className="bg-gradient-to-r from-blue-200 to-blue-100 text-blue-700 font-bold text-sm sm:text-base px-1 py-2 text-center">
                    MEMBER <span className="inline-block align-middle ml-1"><svg width="16" height="16" fill="#facc15" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 9.27l-5 4.87L16.18 21 12 17.27 7.82 21 9 14.14l-5-4.87 5.91-.91z"/></svg></span>
                  </th>
                  <th className="bg-gradient-to-r from-blue-400 to-blue-500 text-white font-bold text-sm sm:text-base px-1 py-2 text-center rounded-tr-lg cursor-pointer hover:brightness-110 transition" onClick={() => setShowDescriptionBox(true)} tabIndex={0} role="button" aria-label="View Test Details">view test details</th>
                </tr>
              </thead>
              <tbody>
                {test.prices && test.prices.length > 0 ? (
                  test.prices.map((priceInfo, idx) => (
                    <tr key={priceInfo.labName + idx} className={idx % 2 === 0 ? 'bg-blue-50' : 'bg-blue-100'}>
                      <td className="px-1 py-2 font-bold text-black text-sm sm:text-base text-left">{priceInfo.labName}</td>
                      <td className="px-1 py-2 font-extrabold text-gray-500 text-lg sm:text-xl text-center line-through">
                        ₹{priceInfo.originalPrice ? priceInfo.originalPrice.toFixed(0) : priceInfo.price.toFixed(0)}/-
                      </td>
                      <td className={
                        `px-1 py-2 font-extrabold text-lg sm:text-xl text-center ` +
                        (userRole === 'member'
                          ? 'text-orange-500'
                          : (priceInfo.price === minNonMemberPrice ? 'text-green-600 bg-green-50 ring-2 ring-green-300 rounded-lg animate-pulse' : 'text-orange-500'))
                      }>
                        ₹{priceInfo.price.toFixed(0)}/-
                        {userRole !== 'member' && priceInfo.price === minNonMemberPrice && (
                          <span className="ml-1 inline-block align-middle text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">Best</span>
                        )}
                      </td>
                      <td className={
                        `px-1 py-2 font-extrabold text-yellow-600 text-lg sm:text-xl text-center ` +
                        (userRole === 'member' && typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice === minMemberPrice ? 'bg-green-50 ring-2 ring-green-300 rounded-lg animate-pulse text-green-700' : '')
                      }>
                        ₹{typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice > 0 ? priceInfo.memberPrice.toFixed(0) : priceInfo.price.toFixed(0)}/-
                        {userRole === 'member' && typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice === minMemberPrice && (
                          <span className="ml-1 inline-block align-middle text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">Best</span>
                        )}
                      </td>
                      <td className="px-1 py-2 text-center">
                        {isItemInCart(priceInfo.labName) ? (
                          <button
                            className="bg-gradient-to-r from-red-400 to-red-600 text-white font-bold text-sm sm:text-base px-3 py-1 rounded-r-lg shadow w-full transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400"
                            aria-label="Remove from Cart"
                            onClick={e => { e.stopPropagation(); handleCartAction(e, priceInfo, true); }}
                            type="button"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            className="bg-gradient-to-r from-sky-400 to-blue-500 text-white font-bold text-sm sm:text-base px-3 py-1 rounded-r-lg shadow w-full transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            aria-label="Book Test"
                            onClick={e => { e.stopPropagation(); handleCartAction(e, priceInfo, false); }}
                            type="button"
                          >
                            Book Test
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-4">No pricing information available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* Desktop/Tablet: Table */}
        <div className="hidden sm:block p-0 w-full" style={{ borderRadius: 18, margin: '0 auto', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, margin: 0, tableLayout: 'fixed', background: 'white', fontFamily, borderRadius: 18, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={tableHeaderLabName}>Lab Name</th>
                <th style={tableHeaderStyle}>Lab Price</th>
                <th style={tableHeaderStyle}>Non Member</th>
                <th style={tableHeaderStyle}>Member {crownIcon}</th>
                <th
                  className="bg-gradient-to-r from-blue-400 to-blue-500 text-white font-bold text-base px-1 py-2 text-center rounded-tr-2xl cursor-pointer hover:brightness-110 transition"
                  style={{width: 170, border: `2px solid ${borderColor}`}}
                  onClick={() => setShowDescriptionBox(true)}
                  tabIndex={0}
                  role="button"
                  aria-label="View Test Details"
                >
                  view test details
                </th>
              </tr>
            </thead>
            <tbody>
              {test.prices && test.prices.length > 0 ? (
                test.prices.map((priceInfo, idx) => {
                  const inCart = isItemInCart(priceInfo.labName);
                  const zebra = idx % 2 === 0 ? { background: '#f8fafc' } : { background: '#fff' };
                  return (
                    <tr key={priceInfo.labName + idx} style={{ transition: 'background 0.2s', ...zebra }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = '#e0e7ff';
                        const btn = e.currentTarget.querySelector('button');
                        if (btn) Object.assign(btn.style, bookBtnHover);
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = zebra.background;
                        const btn = e.currentTarget.querySelector('button');
                        if (btn) Object.assign(btn.style, bookBtnStyle);
                      }}
                    >
                      <td style={tableCellLabName}>{priceInfo.labName}</td>
                      <td style={{...tableCellLabPrice, fontSize: '1.25rem', fontWeight: 800}}>₹{priceInfo.originalPrice ? priceInfo.originalPrice.toFixed(0) : priceInfo.price.toFixed(0)}/-</td>
                      <td
                        style={{
                          ...tableCellNonMember,
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: userRole === 'member' ? tableCellNonMember.color : (priceInfo.price === minNonMemberPrice ? '#16a34a' : tableCellNonMember.color),
                          background: userRole === 'member' ? tableCellNonMember.background : (priceInfo.price === minNonMemberPrice ? '#dcfce7' : tableCellNonMember.background),
                          boxShadow: userRole === 'member' ? undefined : (priceInfo.price === minNonMemberPrice ? '0 0 0 2px #4ade80' : undefined),
                          borderRadius: userRole === 'member' ? tableCellNonMember.borderRadius : (priceInfo.price === minNonMemberPrice ? 10 : tableCellNonMember.borderRadius),
                          transition: 'all 0.2s',
                        }}
                      >
                        ₹{priceInfo.price.toFixed(0)}/-
                        {userRole !== 'member' && priceInfo.price === minNonMemberPrice && (
                          <span style={{marginLeft: 6, fontSize: 13, background: '#bbf7d0', color: '#166534', padding: '2px 8px', borderRadius: 8, fontWeight: 700}}>Best</span>
                        )}
                      </td>
                      <td style={{...tableCellMember, fontSize: '1.25rem', fontWeight: 800}}>₹{typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice > 0 ? priceInfo.memberPrice.toFixed(0) : priceInfo.price.toFixed(0)}/-</td>
                      <td className="px-1 py-2 text-center">
                        {isItemInCart(priceInfo.labName) ? (
                          <button
                            className="bg-gradient-to-r from-red-400 to-red-600 text-white font-bold text-base px-3 py-2 rounded-r-2xl shadow w-full transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-400"
                            aria-label="Remove from Cart"
                            onClick={e => { e.stopPropagation(); handleCartAction(e, priceInfo, true); }}
                            type="button"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            className="bg-gradient-to-r from-sky-400 to-blue-500 text-white font-bold text-base px-3 py-2 rounded-r-2xl shadow w-full transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            aria-label="Book Test"
                            onClick={e => { e.stopPropagation(); handleCartAction(e, priceInfo, false); }}
                            type="button"
                          >
                            Book Test
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={5} style={{ ...tableCellLabName, background: 'white', color: '#888', textAlign: 'center' }}>No pricing information available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Description Box Modal */}
      {showDescriptionBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in-up">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xl font-bold focus:outline-none"
              onClick={() => setShowDescriptionBox(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-extrabold text-blue-700 mb-2 text-center">{test.name}</h2>
            <div className="text-gray-700 text-base whitespace-pre-line text-center max-h-[60vh] overflow-y-auto pr-2">
              {test.description ? test.description : 'No description available.'}
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
