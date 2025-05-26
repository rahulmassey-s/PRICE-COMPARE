'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { LabTest, ContactDetails, LabPrice as LabPriceType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Phone, MessageSquare, Copy, Check, Percent, ShoppingCart, Star, Building, TagIcon, MinusCircle, Eye, Info, X as XIcon } from 'lucide-react';
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
}

function LabTestCardComponent({ test, contactDetails, onCardClick }: LabTestCardProps) {
  console.log('LabTestCard received test:', test); 

  const [expandedLabPriceId, setExpandedLabPriceId] = useState<string | null>(null);
  const [generatedCoupons, setGeneratedCoupons] = useState<Record<string, string>>({});
  const [copiedStatus, setCopiedStatus] = useState<Record<string, boolean>>({});
  const [isTestDetailsDialogOpen, setIsTestDetailsDialogOpen] = useState(false);
  
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
      originalPrice: priceInfo.originalPrice,
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
    <>
      <Card
        className="border text-card-foreground shadow-xl rounded-xl overflow-hidden flex flex-col h-full bg-card transition-all duration-300 ease-out group hover:shadow-2xl"
        role="article"
        aria-labelledby={`test-name-${test.id}`}
      >
        <div className="relative w-full h-32 sm:h-40 bg-card overflow-hidden rounded-t-xl border-b border-border">
          {(test.imageUrl || test.testImageUrl) && (test.imageUrl || test.testImageUrl).trim() !== '' ? (
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
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/5 p-2">
              <Image
                src="https://placehold.co/200x200.png"
                alt={`${test.name} placeholder`}
                fill
                style={{ objectFit: "contain" }}
                className="opacity-50"
                data-ai-hint="medical test"
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
              />
            </div>
          )}
        </div>

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

        <CardContent className="p-3 sm:p-4 flex-grow space-y-3 min-h-[200px]">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs sm:text-sm font-medium text-muted-foreground">Available at:</h4>
            <Button 
              variant="outline" 
              size="sm" 
              className="px-2 py-1 h-auto text-xs text-primary border-primary/50 hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation(); 
                setIsTestDetailsDialogOpen(true);
              }}
            >
              <Eye size={14} className="mr-1.5" />
              View Details
            </Button>
          </div>
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

              return (
                <div
                  key={labPriceId}
                  className={cn(
                    "border rounded-lg shadow-sm transition-all duration-300 ease-in-out relative bg-card",
                    isExpanded ? "ring-2 ring-primary/70 shadow-lg" : "hover:shadow-md",
                    isMarkedAsBestPrice ? "border-green-500 border-2" : "border-border"
                  )}
                >
                  {isMarkedAsBestPrice && (
                    <Badge
                      variant="default"
                      className="absolute -top-2.5 left-3 z-10 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-1.5 py-0.5 shadow-md"
                    >
                      <Star className="h-3 w-3 mr-1 fill-current" /> Best Price
                    </Badge>
                  )}

                  <div className={cn("flex justify-between items-center p-2.5 sm:p-3", isMarkedAsBestPrice && "pt-4")}>
                    <div className="flex-1 mr-2">
                      <span className="font-semibold text-sm sm:text-base text-foreground flex items-center">
                        <Building size={16} className="mr-1.5 text-muted-foreground shrink-0" />
                        {priceInfo.labName}
                      </span>
                      <div className="flex items-baseline flex-wrap mt-1.5 space-x-2">
                        <span className="font-bold text-primary text-lg sm:text-xl flex items-center">
                          ₹{priceInfo.price.toFixed(2)}
                        </span>
                        {hasOriginalPrice && (
                          <span className="text-xs sm:text-sm text-muted-foreground line-through flex items-center">
                            <TagIcon size={12} className="mr-0.5 opacity-70" />
                            MRP: ₹{priceInfo.originalPrice?.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {hasOriginalPrice && discountPercentage > 0 && (
                        <Badge variant="destructive" className="text-[10px] sm:text-xs font-semibold py-0.5 px-1.5 rounded-sm mt-1.5">
                          {discountPercentage}% OFF
                        </Badge>
                      )}
                      {showBestPriceSuggestion && (
                        <div className="mt-1.5 p-1.5 rounded-md bg-yellow-100 text-yellow-800 text-xs flex items-center gap-1 border border-yellow-300">
                          <Star className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
                          <span>
                            Better price: <span className="font-bold">₹{minPrice.toFixed(2)}</span> at {bestPriceLabs.map(l => l.labName).join('/')}.
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "rounded-md px-2.5 py-2 h-auto text-xs font-medium tracking-wide w-full sm:w-auto justify-center",
                          "border-primary/70 text-primary/90 hover:bg-primary/10 hover:text-primary",
                          isExpanded && "bg-primary/10 ring-1 ring-primary/50"
                        )}
                        aria-expanded={isExpanded}
                        aria-controls={`coupon-details-${labPriceId}`}
                        data-state={isExpanded ? "open" : "closed"}
                        onClick={(e) => handleToggleDiscount(e, labPriceId, priceInfo.labName)}
                      >
                        {isExpanded ? <ChevronUp className="mr-1 h-3 w-3" /> : <Percent className="mr-1 h-3 w-3" />}
                        Coupon
                      </Button>

                      <Button
                        variant={inCart ? 'outline' : 'secondary'}
                        size="sm"
                        className={cn(
                          "rounded-md px-2.5 py-2 h-auto text-xs font-medium tracking-wide w-full sm:w-auto justify-center text-secondary-foreground bg-secondary hover:bg-secondary/80",
                          inCart ? "border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive" : ""
                        )}
                        onClick={(e) => handleCartAction(e, priceInfo, inCart)}
                      >
                        {inCart ? (
                          <MinusCircle className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                        )}
                        {inCart ? "Remove" : "Book Now"}
                      </Button>
                    </div>
                  </div>

                  <div
                    id={`coupon-details-${labPriceId}`}
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
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
                            {/* <p className="text-xs text-muted-foreground mb-2">
                              Show this code at <span className="font-medium text-foreground">{priceInfo.labName}</span> or contact us:
                            </p> */}
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
      </Card>

      <Dialog open={isTestDetailsDialogOpen} onOpenChange={setIsTestDetailsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitleComponent className="text-lg sm:text-xl text-primary flex items-center">
              <Info size={20} className="mr-2" /> Test Details: {test.name}
            </DialogTitleComponent>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground max-h-[60vh] overflow-y-auto">
            {test.description && test.description.trim() !== '' ? (
              <p className="whitespace-pre-wrap">{test.description}</p>
            ) : (
              <p>No detailed description available for this test.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestDetailsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const LabTestCard = React.memo(LabTestCardComponent);
export default LabTestCard;
