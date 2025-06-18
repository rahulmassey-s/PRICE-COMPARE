'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface MembershipAnimationProps {
  potentialSavings: number;
  nonMemberPrice: number;
  memberPrice: number;
  onJoinClick: () => void;
}

export default function MembershipAnimation({ potentialSavings, nonMemberPrice, memberPrice, onJoinClick }: MembershipAnimationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [animationStage, setAnimationStage] = useState(0);

  useEffect(() => {
    // Start the animation sequence
    const stageTimers = [
      setTimeout(() => setAnimationStage(1), 500),  // Show crown
      setTimeout(() => setAnimationStage(2), 1200), // Show savings
      setTimeout(() => setAnimationStage(3), 1800), // Show button
    ];

    return () => {
      // Clean up timers
      stageTimers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-amber-500 bg-gradient-to-r from-amber-50 to-amber-100 p-4 my-3">
      {/* Background sparkles */}
      <div className="absolute top-0 right-0 opacity-20">
        <Sparkles className="h-24 w-24 text-amber-500" />
      </div>
      <div className="absolute bottom-0 left-0 opacity-20">
        <Sparkles className="h-16 w-16 text-amber-500" />
      </div>
      
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Crown icon with animation */}
        <div 
          className={`transform transition-all duration-700 ease-out ${
            animationStage >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
        >
          <div className="relative">
            <Crown className="h-12 w-12 text-amber-500" />
            <span className="absolute -top-1 -right-1 animate-ping h-3 w-3 rounded-full bg-amber-400 opacity-75"></span>
          </div>
        </div>
        
        {/* Enhanced savings and price message */}
        <h3 
          className={`mt-2 text-xl font-bold text-amber-800 transition-all duration-500 ease-out ${
            animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Pay only <span className="text-2xl text-amber-600 font-extrabold animate-price-pulse">₹{memberPrice.toFixed(2)}</span> as a Member!
        </h3>
        
        <p 
          className={`mt-1 text-base text-amber-700 transition-all duration-500 ease-out delay-100 ${
            animationStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="font-semibold">You save ₹{potentialSavings.toFixed(2)}!</span> <span className="ml-2 text-sm text-gray-700">Non-member price: <span className="line-through text-gray-400">₹{nonMemberPrice.toFixed(2)}</span> | <span className="text-amber-700 font-bold">Member price: ₹{memberPrice.toFixed(2)}</span></span>
        </p>
        
        {/* Join button with animation */}
        <Button 
          size="sm" 
          className={`mt-3 bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all duration-500 ease-out ${
            animationStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          onClick={onJoinClick}
        >
          <span>Unlock Member Price</span>
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}