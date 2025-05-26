
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/lib/firebase/client';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { PromotionalBanner } from '@/types';
import { ChevronLeft, ChevronRight, Dot } from 'lucide-react';
import * as Icons from 'lucide-react'; 
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast"; // Import useToast

const AUTOPLAY_INTERVAL = 5000; // 5 seconds

interface PromotionalBannerCarouselProps {
  collectionName: string; 
  containerClassName?: string;
  cardClassName?: string; 
}

export default function PromotionalBannerCarousel({ 
  collectionName, 
  containerClassName, 
  cardClassName 
}: PromotionalBannerCarouselProps) {
  const [banners, setBanners] = useState<PromotionalBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast(); // Initialize useToast

  useEffect(() => {
    const fetchBanners = async () => {
      setIsLoading(true);
      try {
        const bannersRef = collection(db, collectionName);
        const q = query(bannersRef, where('isActive', '==', true), orderBy('order', 'asc'));
        const querySnapshot = await getDocs(q);
        const fetchedBanners: PromotionalBanner[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedBanners.push({ 
            id: doc.id, 
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
            lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : data.lastUpdatedAt,
          } as PromotionalBanner);
        });
        setBanners(fetchedBanners);
      } catch (error: any) {
        console.error(`Error fetching banners from ${collectionName}:`, error);
        let description = `Could not fetch banners from ${collectionName}. Please try again later.`;
        if (error.name === 'FirebaseError') {
            description = `Firebase error: ${error.message} (Code: ${error.code}). Please check your connection and Firebase setup.`;
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                description = `Database query for ${collectionName} failed due to a missing index. Please contact support or check Firebase console (index for '${collectionName}' on isActive, order).`;
                console.warn(
                  `FIREBASE INDEXING ERROR for collection '${collectionName}': The query requires an index on 'isActive' (ASC) and 'order' (ASC). ` +
                  "Please check your Firebase console for details and create the index if it doesn't exist."
                );
            } else if (error.code === 'permission-denied') {
                description = `Permission denied when fetching banners from ${collectionName}. Please check Firestore security rules.`;
            }
        }
        toast({ // Use toast for error notification
          title: `Error Fetching ${collectionName}`,
          description: description,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBanners();
  }, [collectionName, toast]); // Add toast to dependencies

  const nextBanner = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % (banners.length || 1));
  }, [banners.length]);

  const prevBanner = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + banners.length) % (banners.length || 1));
  };

  useEffect(() => {
    if (banners.length > 1) {
      const timer = setInterval(nextBanner, AUTOPLAY_INTERVAL);
      return () => clearInterval(timer);
    }
  }, [banners.length, nextBanner]);

  if (isLoading) {
    return (
      <div className={cn("mb-6", containerClassName)}>
        <Skeleton className={cn("w-full rounded-xl", cardClassName || "h-[70px]")} />
      </div>
    );
  }

  if (banners.length === 0) {
    return null; 
  }

  const currentBanner = banners[currentIndex];
  if (!currentBanner) return null;

  const IconComponent = (Icons as any)[currentBanner.iconName || 'Gift'] || Icons.Gift;

  const defaultCardHeight = "h-[70px]";

  const BannerContent = () => (
    <Card 
        className={cn(
            "shadow-lg rounded-xl overflow-hidden text-primary-foreground w-full transition-all duration-500 ease-in-out relative",
            currentBanner.imageUrl ? 'bg-cover bg-center' : 'bg-primary/10',
            cardClassName || defaultCardHeight 
        )}
        style={currentBanner.imageUrl ? { backgroundImage: `url(${currentBanner.imageUrl})` } : {}}
        data-ai-hint="promotional event"
    >
      <CardContent className={cn(
          "p-3 flex items-center justify-between h-full",
          currentBanner.imageUrl && "bg-black/30" 
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "rounded-full p-2 shadow",
            currentBanner.imageUrl ? "bg-background/70" : "bg-background/70"
          )}>
            <IconComponent className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className={cn(
                "text-base font-bold",
                currentBanner.imageUrl ? "text-white" : "text-primary"
            )}>{currentBanner.title}</h3>
            {currentBanner.subtitle && (
              <p className={cn(
                  "text-xs font-medium",
                  currentBanner.imageUrl ? "text-gray-200" : "text-primary/80"
              )}>{currentBanner.subtitle}</p>
            )}
          </div>
        </div>
        {banners.length > 1 && (
             <div className="absolute bottom-1 right-1/2 translate-x-1/2 flex space-x-1">
                {banners.map((_, index) => (
                    <button
                        key={`${collectionName}-dot-${index}`}
                        onClick={() => setCurrentIndex(index)}
                        aria-label={`Go to slide ${index + 1}`}
                        className='p-0'
                    >
                    <Dot
                        className={cn(
                        "h-4 w-4",
                        currentIndex === index ? (currentBanner.imageUrl ? 'text-white' : 'text-primary') : (currentBanner.imageUrl ? 'text-white/50' : 'text-primary/30'),
                        "transition-colors duration-300"
                        )}
                    />
                   </button>
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={cn("mb-6 relative group", containerClassName)}>
      {currentBanner.linkUrl ? (
        <Link href={currentBanner.linkUrl} passHref legacyBehavior>
          <a className="block"><BannerContent /></a>
        </Link>
      ) : (
        <BannerContent />
      )}

      {banners.length > 1 && (
        <>
          <button
            onClick={prevBanner}
            className="absolute left-0 top-1/2 -translate-y-1/2 transform bg-background/50 hover:bg-background/80 text-primary p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 ml-1"
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={nextBanner}
            className="absolute right-0 top-1/2 -translate-y-1/2 transform bg-background/50 hover:bg-background/80 text-primary p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 mr-1"
            aria-label="Next banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

