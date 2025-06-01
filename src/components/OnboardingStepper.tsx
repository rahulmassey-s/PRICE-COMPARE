"use client";

import React, { useState } from 'react';

interface OnboardingStepperProps {
  onFinish: () => void;
}

const slides = [
  {
    image: '/onboarding/step1.png', // Placeholder, replace with your asset or SVG
    title: 'Explore & Select Test/Profile',
    subtitle: 'Book Through App',
    icon: '📝',
  },
  {
    image: '/onboarding/step2.png',
    title: 'Booking Confirmation',
    subtitle: 'Track Your Technician',
    icon: '📱',
  },
  {
    image: '/onboarding/step3.png',
    title: 'Blood Collection & Testing',
    subtitle: 'Download Report & Receipt',
    icon: '🧪',
  },
  {
    image: '/onboarding/accuracy.png',
    title: 'ACCURACY IS FIRST',
    subtitle: 'Our all Labs are NABL & CAP Certified',
    icon: '🎯',
  },
  {
    image: '/onboarding/home-sample.png',
    title: 'FREE HOME SAMPLE COLLECTION',
    subtitle: 'A well Trained Technician will collect your Samples free of cost from your home.',
    icon: '🏠',
  },
];

export default function OnboardingStepper({ onFinish }: OnboardingStepperProps) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      onFinish();
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  const slide = slides[step];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cyan-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 flex flex-col items-center">
        {/* Image/Icon */}
        <div className="mb-6">
          {/* If you have real images, use <img src={slide.image} ... /> */}
          <span className="text-6xl">{slide.icon}</span>
        </div>
        {/* Title */}
        <h2 className="text-2xl font-bold text-cyan-800 mb-2 text-center">{slide.title}</h2>
        {/* Subtitle */}
        <p className="text-base text-cyan-700 mb-6 text-center">{slide.subtitle}</p>
        {/* Stepper Dots */}
        <div className="flex gap-2 mb-6">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 w-2 rounded-full ${idx === step ? 'bg-cyan-600' : 'bg-cyan-200'}`}
            />
          ))}
        </div>
        {/* Navigation Buttons */}
        <div className="flex w-full justify-between">
          <button
            className="text-cyan-600 font-semibold px-4 py-2 rounded hover:bg-cyan-100"
            onClick={handleSkip}
          >
            SKIP
          </button>
          <button
            className="bg-cyan-600 text-white font-semibold px-6 py-2 rounded shadow hover:bg-cyan-700"
            onClick={handleNext}
          >
            {step === slides.length - 1 ? 'START' : 'NEXT'}
          </button>
        </div>
      </div>
    </div>
  );
} 