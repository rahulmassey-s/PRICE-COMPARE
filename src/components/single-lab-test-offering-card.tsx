
'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MinusCircle, Building } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SingleLabTestOfferingCardProps {
  testDocId: string;
  testName: string;
  testImageUrl?: string;
  labName: string;
  price: number;
  originalPrice?: number;
}

export default function SingleLabTestOfferingCard({
  testDocId,
  testName,
  testImageUrl,
  labName,
  price,
  originalPrice,
}: SingleLabTestOfferingCardProps) {
  const { addToCart, removeFromCart, items: cartItems } = useCart();
  const { toast } = useToast();

  const isInCart = cartItems.some(
    (item) => item.testDocId === testDocId && item.labName === labName
  );

  const handleCartAction = () => {
    const cartItemPayload = {
      testDocId,
      testName,
      testImageUrl,
      labName,
      price,
      originalPrice,
    };
    if (isInCart) {
      removeFromCart(testDocId, labName);
      toast({
        title: 'Removed from Cart',
        description: `${testName} from ${labName} removed from your cart.`,
      });
    } else {
      addToCart(cartItemPayload);
      toast({
        title: 'Added to Cart',
        description: `${testName} from ${labName} added to your cart.`,
      });
    }
  };

  const hasOriginalPrice = typeof originalPrice === 'number' && originalPrice > price;
  const discountPercentage =
    hasOriginalPrice && originalPrice > 0
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  return (
    <Card className="shadow-lg rounded-xl overflow-hidden flex flex-col h-full transition-all duration-300 ease-out hover:shadow-2xl hover:scale-[1.015]">
      {testImageUrl && (
        <div className="relative h-32 w-full bg-muted">
          <Image
            src={testImageUrl}
            alt={`${testName} image`}
            layout="fill"
            objectFit="cover"
            className="opacity-90 group-hover:opacity-100 transition-opacity"
            data-ai-hint="lab test"
          />
           <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
      )}
      <CardHeader className={cn("p-4", testImageUrl && "pt-3")}>
        <CardTitle className="text-md sm:text-lg font-semibold text-foreground leading-tight truncate" title={testName}>
          {testName}
        </CardTitle>
        <p className="text-sm text-muted-foreground flex items-center pt-0.5">
          <Building className="mr-1.5 h-4 w-4 text-primary" /> {labName}
        </p>
      </CardHeader>
      <CardContent className="p-4 flex-grow space-y-2">
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-primary">
            ₹{price.toFixed(2)}
          </span>
          {hasOriginalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              ₹{originalPrice.toFixed(2)}
            </span>
          )}
        </div>
        {hasOriginalPrice && discountPercentage > 0 && (
          <Badge variant="destructive" className="text-xs font-semibold py-0.5 px-1.5 rounded">
            {discountPercentage}% OFF
          </Badge>
        )}
         {!hasOriginalPrice && ( // Placeholder if no discount to maintain layout consistency
            <div className="h-[22px]"></div> // Approx height of the badge
        )}
      </CardContent>
      <CardFooter className="p-4 border-t bg-muted/20">
        <Button
          onClick={handleCartAction}
          variant={isInCart ? 'outline' : 'default'}
          className={cn(
            "w-full py-2.5 text-sm",
            isInCart && "border-destructive text-destructive hover:bg-destructive/10"
          )}
        >
          {isInCart ? (
            <MinusCircle className="mr-2 h-4 w-4" />
          ) : (
            <PlusCircle className="mr-2 h-4 w-4" />
          )}
          {isInCart ? 'Remove from Cart' : 'Add to Cart'}
        </Button>
      </CardFooter>
    </Card>
  );
}
