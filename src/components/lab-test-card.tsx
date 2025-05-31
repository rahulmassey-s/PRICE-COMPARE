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
  
  const { toast } = useToast();
  const { addToCart, items: cartItems, removeFromCart } = useCart();

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

    if (priceInfo.price > minPrice && bestPriceLabs.length > 0) {
      toast({
        title: "Best Price Available!",
        description: `Get ${test.name} for ₹${minPrice.toFixed(2)} at ${bestPriceLabs.map(l => l.labName).join('/')}. Consider adding it.`,
        duration: 7000,
        variant: "default",
      });
    }
  }, [addToCart, test, minPrice, bestPriceLabs, toast]);

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

  const effectiveImageUrl = (isValidHttpUrl(test.imageUrl || test.testImageUrl) && (test.imageUrl || test.testImageUrl))
    ? (test.imageUrl || test.testImageUrl)
    : `https://placehold.co/200x200.png`;

  return (
    <Card
      className="border text-card-foreground shadow-xl rounded-xl overflow-hidden flex flex-col h-full bg-card transition-all duration-300 ease-out group hover:shadow-2xl"
      role="article"
      aria-labelledby={`test-name-${test.id}`}
    >
      {/* Test Image (once at top) */}
      {(test.imageUrl || test.testImageUrl) && (test.imageUrl || test.testImageUrl).trim() !== '' && (
        <div className="relative w-full h-32 sm:h-40 bg-card overflow-hidden rounded-t-xl border-b border-border mb-2">
          <Image
            src={effectiveImageUrl}
            alt={test.name}
            fill
            style={{ objectFit: "contain" }}
            className="bg-card group-hover:opacity-90 transition-opacity duration-300"
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
            priority={false}
            quality={75}
            data-ai-hint="medical test"
          />
        </div>
      )}
      {/* Test Name / Banner (once at top) */}
      <div id={`test-name-${test.id}`} className={cn(
          "p-3 sm:p-4 border-b border-border text-center flex items-center justify-center overflow-hidden bg-primary/5",
          "h-14 sm:h-16"
      )}>
        {test.bannerText && test.bannerText.trim() !== '' ? (
          <div className="marquee-container h-full w-full text-sm sm:text-base font-semibold text-primary flex items-center">
            <span className="marquee-text">{test.bannerText}</span>
          </div>
        ) : (
          <h3 className="font-bold text-base sm:text-lg text-primary truncate" title={test.name}>
            {test.name}
          </h3>
        )}
      </div>
      <CardContent className="p-4 flex-grow space-y-3 min-h-[200px]">
        {test.prices && test.prices.length > 0 ? (
          test.prices.map((priceInfo, index) => {
            const labPriceId = `${test.docId}_${priceInfo.labName.replace(/\s+/g, '-')}_${index}`;
            const currentCoupon = generatedCoupons[labPriceId];
            const isExpanded = expandedLabPriceId === labPriceId;
            const hasOriginalPrice = typeof priceInfo.originalPrice === 'number' && priceInfo.originalPrice > priceInfo.price;
            const discountPercentage = hasOriginalPrice && priceInfo.originalPrice && priceInfo.originalPrice > 0
              ? Math.round(((priceInfo.originalPrice - priceInfo.price) / priceInfo.originalPrice) * 100)
              : 0;
            const isMarkedAsBestPrice = priceInfo.price === minPrice && test.prices.length > 0 && bestPriceLabs.some(l => l.labName === priceInfo.labName);
            const inCart = isItemInCart(priceInfo.labName);
            const showBestPriceSuggestion = inCart && priceInfo.price > minPrice && bestPriceLabs.length > 0;

            const memberPrice = (typeof priceInfo.memberPrice === 'number' && priceInfo.memberPrice > 0)
              ? priceInfo.memberPrice
              : undefined;

            const originalPrice = (typeof priceInfo.originalPrice === 'number' && priceInfo.originalPrice > 0)
              ? priceInfo.originalPrice
              : priceInfo.price;
            // Calculate member discount percent for badge (based on original price)
            const showMemberDiscountBadge = typeof memberPrice === 'number' && memberPrice > 0 && originalPrice > memberPrice;
            const memberDiscountPercent = showMemberDiscountBadge ? Math.round(((originalPrice - memberPrice) / originalPrice) * 100) : 0;

            // BADGE ROW: Render above the card content for this lab
            const badgeRow = (
              <div className="flex gap-2 mb-2 flex-wrap items-center">
                {isMarkedAsBestPrice && (
                  <span className="inline-flex bg-green-600 text-white text-xs md:text-sm font-bold px-2 py-1 rounded-full shadow items-center gap-1 pointer-events-auto">
                    <Star className="h-3 w-3 fill-current" /> Best Price
                  </span>
                )}
                {discountPercentage > 0 && (
                  <span className="inline-flex bg-red-500 text-white text-xs md:text-sm font-bold px-2 py-1 rounded-full shadow items-center pointer-events-auto" style={{lineHeight: '1.1'}}>
                    {discountPercentage}% OFF
                  </span>
                )}
                {showMemberDiscountBadge && memberDiscountPercent > 0 && (
                  <span
                    className="inline-flex items-center justify-center gap-1 px-5 py-1.5 rounded-full border-2 border-[#b8860b] font-black text-[#7c5700] text-base text-center pointer-events-auto animate-bounce-slow shadow-[0_0_16px_#f0b03099]"
                    style={{
                      background: 'linear-gradient(90deg, #f7c873 0%, #f0b030 60%, #b8860b 100%)',
                      lineHeight: '1.1',
                      textShadow: '0 1px 4px #fff8, 0 0px 2px #b8860b88',
                      maxWidth: '100%',
                    }}
                  >
                    <Crown className="h-5 w-5 mr-1" style={{ color: '#b8860b', filter: 'drop-shadow(0 0 4px #f0b030)' }} />
                    {memberDiscountPercent}% OFF FOR MEMBER
                  </span>
                )}
              </div>
            );

            return (
              <div
                key={labPriceId}
                className={cn(
                  "rounded-xl shadow-lg border border-gray-200 bg-white flex flex-col gap-3 relative mb-4",
                  isExpanded ? "ring-2 ring-primary/70 shadow-xl" : "hover:shadow-md",
                  isMarkedAsBestPrice ? "border-green-500 border-2" : "border-border"
                )}
              >
                {badgeRow}
                {/* Centered Lab Name Row */}
                <div className="flex flex-col items-center justify-center mb-2">
                  <span className="flex items-center gap-2 text-center">
                    <Building className="text-gray-400" size={18} />
                    <span className="font-bold text-lg text-gray-900">{priceInfo.labName}</span>
                  </span>
                </div>
                {/* Centered Price Row */}
                <div className="flex flex-col items-center justify-center mb-2">
                  <span className="text-2xl font-extrabold text-primary text-center">₹{priceInfo.price.toFixed(2)}</span>
                  {hasOriginalPrice && (
                    <span className="text-sm text-gray-400 line-through text-center">₹{priceInfo.originalPrice?.toFixed(2)}</span>
                  )}
                </div>
                {/* Premium Member Price Badge */}
                {typeof memberPrice === 'number' && memberPrice > 0 && (
                  <div className={`relative flex flex-col items-center w-full my-2`}>
                    <div
                      className={`member-price-badge-glass group transition-transform duration-200 opacity-100 scale-100 hover:scale-105 active:scale-100`}
                      tabIndex={0}
                      title={userRole === 'member' ? 'You are getting the best member price!' : 'Unlock this price by becoming a member!'}
                    >
                      <span className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-widest font-bold mb-0.5" style={{ color: '#bfa100' }}>
                        <Crown className="h-4 w-4" style={{ color: '#bfa100' }} />
                        FOR MEMBERS
                      </span>
                      <span className="flex items-center justify-center text-2xl font-extrabold bg-gradient-to-r from-green-400 via-yellow-300 to-green-700 text-transparent bg-clip-text animate-member-price-shimmer drop-shadow-member-price-glow">
                        {userRole === 'member' ? (
                          <Smile className="h-6 w-6 mr-1 text-green-500 animate-member-price-pulse" />
                        ) : (
                          <Lock className="h-5 w-5 mr-1 text-yellow-500 animate-member-price-pulse" />
                        )}
                        ₹{memberPrice.toFixed(2)}
                      </span>
                      {userRole !== 'member' && (
                        <span className="block text-xs text-yellow-700 font-semibold mt-1 animate-bounce-slow">Become a Member & Save More</span>
                      )}
                      {userRole === 'member' && (
                        <span className="block text-xs text-green-700 font-semibold mt-1 animate-bounce-slow">Exclusive Member Price</span>
                      )}
                    </div>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center border-primary text-primary font-medium mb-1 bg-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenLabDetailsIndex(index);
                  }}
                >
                  <Eye size={16} className="mr-1 eye-blink-animate" />
                  View Details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-center border-primary text-primary font-medium mb-1",
                    isExpanded && "bg-primary/10 ring-1 ring-primary/50"
                  )}
                  aria-expanded={isExpanded}
                  aria-controls={`coupon-details-${labPriceId}`}
                  data-state={isExpanded ? "open" : "closed"}
                  onClick={(e) => handleToggleDiscount(e, labPriceId, priceInfo.labName)}
                >
                  <Percent className="mr-1 h-4 w-4" />
                  Coupon
                </Button>
                <Button
                  variant={inCart ? 'outline' : 'primary'}
                  size="lg"
                  className={cn(
                    "w-full justify-center font-bold text-white bg-primary hover:bg-primary/90 transition mb-1",
                    inCart ? "border-destructive text-destructive bg-white hover:bg-destructive/10" : ""
                  )}
                  onClick={(e) => handleCartAction(e, priceInfo, inCart)}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  {inCart ? "Remove" : "Book Now"}
                </Button>
                <div
                  id={`coupon-details-${labPriceId}`}
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                  aria-live="polite"
                >
                  {isExpanded && (
                    <div className="p-2.5 sm:p-3 border-t border-border bg-muted/30 rounded-b-lg">
                      {currentCoupon ? (
                        <>
                          <p className="text-xs font-semibold text-foreground mb-1">Your Exclusive Coupon Code:</p>
                          <div className="flex items-center gap-2 mb-2.5 p-2 border-2 border-dashed border-primary/70 rounded-lg bg-primary/5">
                            <Percent className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm sm:text-md font-mono text-primary tracking-wider flex-grow">{currentCoupon}</span>
                            <Button
                              onClick={(e) => handleCopyCoupon(e, currentCoupon, labPriceId)}
                              variant="ghost"
                              size="icon"
                              className="text-primary hover:bg-primary/20 h-7 w-7"
                            >
                              {copiedStatus[labPriceId] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              <span className="sr-only">{copiedStatus[labPriceId] ? "Copied" : "Copy coupon"}</span>
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-primary border-primary/70 hover:bg-primary/10 hover:text-primary text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a href={`tel:${contactDetails.phone}`}>
                                <Phone size={14} className="mr-1.5 shrink-0" /> Call: {contactDetails.phone}
                              </a>
                            </Button>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-primary border-primary/70 hover:bg-primary/10 hover:text-primary text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a href={generateWhatsappUrl(priceInfo.labName, currentCoupon)} target="_blank" rel="noopener noreferrer">
                                <MessageSquare size={14} className="mr-1.5 shrink-0" /> WhatsApp Us
                              </a>
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center py-3">
                          <p className="text-xs text-muted-foreground">Generating your coupon...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No pricing information available for this test.</p>
        )}
      </CardContent>

      {openLabDetailsIndex !== null && test.prices && (
        <Dialog open={openLabDetailsIndex !== null} onOpenChange={() => setOpenLabDetailsIndex(null)}>
          <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitleComponent className="text-lg sm:text-xl text-primary flex items-center">
                <Info size={20} className="mr-2" /> Lab Details: {test.prices[openLabDetailsIndex].labName}
              </DialogTitleComponent>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                  <XIcon className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </DialogHeader>
            <div className="py-4 text-sm text-muted-foreground max-h-[60vh] overflow-y-auto">
              <div className="mb-2">
                <span className="font-semibold text-foreground">Lab:</span> {test.prices[openLabDetailsIndex].labName}
              </div>
              <div className="mb-2">
                <span className="font-semibold text-foreground">Price:</span> ₹{test.prices[openLabDetailsIndex].price.toFixed(2)}
              </div>
              <div className="mb-2">
                <span className="font-semibold text-foreground">MRP:</span> ₹{test.prices[openLabDetailsIndex].originalPrice?.toFixed(2) || '-'}
              </div>
              <div className="mb-2">
                <span className="font-semibold text-foreground">Discount:</span> {test.prices[openLabDetailsIndex].originalPrice && test.prices[openLabDetailsIndex].originalPrice > test.prices[openLabDetailsIndex].price ? `${Math.round(((test.prices[openLabDetailsIndex].originalPrice - test.prices[openLabDetailsIndex].price) / test.prices[openLabDetailsIndex].originalPrice) * 100)}% OFF` : '-'}
              </div>
              <div className="mb-2">
                <span className="font-semibold text-foreground">Lab Description:</span><br />
                {test.prices[openLabDetailsIndex].labDescription
                  ? <span className="whitespace-pre-wrap">{test.prices[openLabDetailsIndex].labDescription}</span>
                  : test.description
                    ? <span className="whitespace-pre-wrap">{test.description}</span>
                    : <span className="text-muted-foreground">No description available.</span>
                }
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenLabDetailsIndex(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {openLabDetailsIndex !== null && test.prices && (
        (() => { console.log('DEBUG: View Details dialog data:', test.prices[openLabDetailsIndex]); return null; })()
      )}
    </Card>
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
