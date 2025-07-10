'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MinusCircle, Building, DollarSign, TagIcon, Microscope, ShoppingCart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GroupedTestOffering } from '@/app/lab-tests/page'; 
import { ScrollArea } from './ui/scroll-area';
import React from 'react';
import { logUserActivity } from '@/lib/firebase/firestoreService';
import { auth } from '@/lib/firebase/client';

interface LabGroupedTestCardProps {
  labName: string;
  testsOffered: GroupedTestOffering[];
  userRole: 'member' | 'non-member' | 'admin';
}

export default function LabGroupedTestCard({
  labName,
  testsOffered,
  userRole,
}: LabGroupedTestCardProps) {
  const { addToCart, removeFromCart, items: cartItems } = useCart();
  const { toast } = useToast();

  const handleCartAction = (test: GroupedTestOffering, isInCart: boolean) => {
    const cartItemPayload = {
      testDocId: test.testDocId,
      testName: test.testName,
      testImageUrl: test.testImageUrl,
      labName, 
      price: test.price,
      originalPrice: test.originalPrice,
      memberPrice: test.memberPrice,
    };
    if (isInCart) {
      removeFromCart(test.testDocId, labName);
      toast({
        title: 'Removed from Cart',
        description: `${test.testName} from ${labName} removed.`,
      });
    } else {
      addToCart(cartItemPayload);
      toast({
        title: 'Added to Cart',
        description: `${test.testName} from ${labName} added.`,
      });
    }
  };

  if (!testsOffered || testsOffered.length === 0) {
    return null; 
  }

  const labTotalPrice = testsOffered.reduce((sum, test) => {
    if (userRole === 'member' && typeof test.memberPrice === 'number' && test.memberPrice > 0) {
      return sum + test.memberPrice;
    }
    return sum + test.price;
  }, 0);
  const labTotalOriginalPrice = testsOffered.reduce((sum, test) => sum + (test.originalPrice || test.price), 0);
  const labTotalSavings = labTotalOriginalPrice - labTotalPrice;

  const handleAddAllToCart = () => {
    let itemsAddedCount = 0;
    testsOffered.forEach(test => {
      const isInCart = cartItems.some(
        (item) => item.testDocId === test.testDocId && item.labName === labName
      );
      if (!isInCart) {
        const cartItemPayload = {
          testDocId: test.testDocId,
          testName: test.testName,
          testImageUrl: test.testImageUrl,
          labName,
          price: test.price,
          originalPrice: test.originalPrice,
          memberPrice: test.memberPrice,
        };
        addToCart(cartItemPayload);
        itemsAddedCount++;
      }
    });
    if (itemsAddedCount > 0) {
      toast({
        title: `Added ${itemsAddedCount} test(s) from ${labName}`,
        description: `All available tests from ${labName} in your selection added to cart.`,
      });
    } else {
       toast({
        title: `All tests from ${labName} already in cart`,
        variant: "default",
      });
    }
  };

  const handleGroupedTestCardClick = (test: GroupedTestOffering) => {
    try {
      const user = auth.currentUser;
      const userId = user && user.uid ? user.uid : '';
      const userName = user && user.displayName ? user.displayName : null;
      const userEmail = user && user.email ? user.email : null;
      const testId = test.testDocId || '';
      const testName = test.testName || '';
      if (userId && testId) {
        logUserActivity(userId, 'test_view', { testId, testName, labName }, userName ?? undefined, userEmail ?? undefined);
      }
    } catch (e) {}
    // ...existing click logic...
  };

  return (
    <Card className="shadow-xl rounded-xl overflow-hidden flex flex-col h-full transition-all duration-300 ease-out hover:shadow-2xl">
      <CardHeader className="p-4 bg-primary/10 border-b">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-blue-700 flex items-center">
            <Building className="mr-2 h-5 w-5 text-blue-700" /> {labName}
          </CardTitle>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-700">Total for {testsOffered.length} test(s):</p>
            <p className="text-lg font-bold text-blue-700">₹{labTotalPrice.toFixed(2)}</p>
            {labTotalSavings > 0 && (
              <p className="text-xs text-green-700">You save ₹{labTotalSavings.toFixed(2)}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow">
        <ScrollArea className="max-h-[300px] h-full"> 
          <ul className="divide-y divide-border">
            {testsOffered.map((test) => {
              console.log('LabGroupedTestCard test:', test);
              console.log('LabGroupedTestCard test.memberPrice:', test.memberPrice, 'for', test.testName, labName);
              const isInCart = cartItems.some(
                (item) => item.testDocId === test.testDocId && item.labName === labName
              );
              const hasOriginalPrice = typeof test.originalPrice === 'number' && test.originalPrice > test.price;
              const discountPercentage =
                hasOriginalPrice && test.originalPrice && test.originalPrice > 0
                  ? Math.round(((test.originalPrice - test.price) / test.originalPrice) * 100)
                  : 0;
              const hasMemberPrice = userRole === 'member' && typeof test.memberPrice === 'number' && test.memberPrice > 0;

              return (
                <li key={test.testDocId} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {test.testImageUrl && (
                       <div className="relative h-12 w-12 rounded-md overflow-hidden border bg-muted shrink-0">
                         <Image
                           src={test.testImageUrl}
                           alt={test.testName}
                           layout="fill"
                           objectFit="cover"
                           data-ai-hint="medical test small"
                         />
                       </div>
                    )}
                    <div className="flex-grow">
                      <h4 className="font-medium text-sm text-foreground">{test.testName}</h4>
                      <div className="flex items-baseline space-x-1.5 mt-0.5">
                        {hasMemberPrice ? (
                          <span className="font-bold text-blue-700 text-base flex items-center">
                            <svg className="h-4 w-4 text-yellow-800 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ₹{test.memberPrice?.toFixed(2)}
                            <span className="ml-2 text-xs text-gray-700 line-through">₹{test.price.toFixed(2)}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-blue-700 text-base">
                            ₹{test.price.toFixed(2)}
                          </span>
                        )}
                        {hasOriginalPrice && (
                          <span className="text-xs text-gray-700 line-through">
                            ₹{test.originalPrice!.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {hasOriginalPrice && discountPercentage > 0 && (
                        <Badge variant="destructive" className="text-[10px] font-semibold py-0.5 px-1 mt-1 rounded-sm">
                          {discountPercentage}% OFF
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => {
                        handleCartAction(test, isInCart);
                        handleGroupedTestCardClick(test);
                      }}
                      variant={isInCart ? 'outline' : 'default'}
                      size="sm"
                      className={cn(
                        "px-2.5 py-1 h-auto text-xs shrink-0 mt-1",
                        isInCart && "border-destructive text-destructive hover:bg-destructive/10"
                      )}
                    >
                      {isInCart ? (
                        <MinusCircle className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <PlusCircle className="mr-1 h-3.5 w-3.5" />
                      )}
                      {isInCart ? 'Remove' : 'Add'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 border-t bg-muted/20">
        <Button
          onClick={handleAddAllToCart}
          size="sm"
          className="w-full py-2 text-xs"
          variant="secondary"
          disabled={testsOffered.length === 0}
        >
          <ShoppingCart className="mr-1.5 h-4 w-4" /> Add All from {labName} ({testsOffered.length})
        </Button>
      </CardFooter>
    </Card>
  );
}
