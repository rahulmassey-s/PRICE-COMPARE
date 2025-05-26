'use client';

import { useEffect, useState } from 'react';
import { Stethoscope } from 'lucide-react'; // Using Stethoscope as a relevant icon

interface IntroAnimationProps {
  onAnimationComplete: () => void;
}

export default function IntroAnimation({ onAnimationComplete }: IntroAnimationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Start showing text shortly after component mounts
    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 500); // Show text after 0.5s

    // Main animation timer
    const animationTimer = setTimeout(() => {
      setIsVisible(false);
      // Add a slight delay for the fade-out transition before calling onAnimationComplete
      setTimeout(onAnimationComplete, 700); // 700ms for fade-out (must be > transition duration)
    }, 3000); // Total visible duration: 3 seconds

    return () => {
      clearTimeout(textTimer);
      clearTimeout(animationTimer);
    };
  }, [onAnimationComplete]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-br from-primary/80 to-secondary/80 p-8 text-center transition-opacity duration-700 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isVisible}
      role="status"
      aria-live="polite"
    >
      <div className="relative mb-8">
        <Stethoscope
          className={`h-28 w-28 text-primary-foreground transition-all duration-1000 ease-out
            ${isVisible ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-45'}`}
        />
        <div 
          className={`absolute -top-2 -right-2 h-8 w-8 bg-accent rounded-full animate-ping opacity-75
            ${isVisible ? 'scale-100' : 'scale-0'}`} 
          style={{ animationDelay: '0.5s' }}
        />
         <div 
          className={`absolute -bottom-2 -left-2 h-6 w-6 bg-accent/70 rounded-full animate-ping opacity-60
            ${isVisible ? 'scale-100' : 'scale-0'}`} 
          style={{ animationDelay: '0.8s' }}
        />
      </div>

      <h1
        className={`text-4xl sm:text-5xl font-extrabold text-primary-foreground drop-shadow-lg transition-all duration-700 ease-in-out delay-300 ${
          showText && isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
        }`}
      >
        Lab Price Compare
      </h1>
      <p
        className={`mt-4 text-lg text-primary-foreground/80 transition-all duration-700 ease-in-out delay-500 ${
          showText && isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
        }`}
      >
        Finding the best lab test prices for you...
      </p>
      <div className="absolute bottom-8 w-24 h-1.5 bg-primary-foreground/30 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-accent animate-progress-bar ${isVisible ? 'animate-progress-bar-active' : ''}`}
          style={{
            animationName: 'progressBarAnimation',
            animationDuration: '2.5s', /* Slightly less than total visible time */
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
            animationDelay: '0.5s'
          }}
        ></div>
      </div>
      <style jsx global>{`
        @keyframes progressBarAnimation {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress-bar-active {
          animation-play-state: running;
        }
      `}</style>
    </div>
  );
}
