import React from 'react';

export default function AboutUs() {
  return (
    <section className="p-4 max-w-md mx-auto bg-white rounded-2xl shadow-md space-y-4">
      <h2 className="text-xl font-bold text-center text-blue-600">About Us</h2>

      <p className="text-gray-700 text-sm">
        <strong>Smart Bharat Health Services (SBHS)</strong> is a Bareilly-based health-tech initiative that empowers individuals and families to book lab tests from trusted collection centers at affordable prices.
      </p>

      <div className="text-sm text-gray-600 space-y-2">
        <p>
          Our platform helps you:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Compare lab test prices instantly</li>
          <li>Book home sample collections with ease</li>
          <li>Enjoy up to 40% discounts with membership</li>
          <li>Receive digital reports on WhatsApp & Email</li>
        </ul>
      </div>

      <div className="text-sm text-gray-600 space-y-2">
        <p className="font-semibold">Why We Exist:</p>
        <p>
          Most people get tests done only when they fall sick. SBHS was created to change that mindset by making preventive health checkups more affordable, regular, and accessible for everyone — especially in tier-2 cities like Bareilly.
        </p>
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p className="font-semibold">Our Vision:</p>
        <p>
          To become India's most trusted preventive health platform for middle-class families.
        </p>
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <p className="font-semibold">Core Values:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Honesty & Transparency</li>
          <li>Quality without Compromise</li>
          <li>Customer-First Approach</li>
          <li>Clarity in Pricing & Choice</li>
        </ul>
      </div>

      <div className="mt-4 text-sm text-blue-600 space-y-2">
        <p className="font-semibold">More Information:</p>
        <ul className="space-y-1 underline">
          <li><a href="/contact">📞 Contact Us</a></li>
          <li><a href="/privacy-policy">🔒 Privacy Policy</a></li>
          <li><a href="/terms">📄 Terms & Conditions</a></li>
        </ul>
      </div>

      <div className="text-center text-blue-600 text-sm font-semibold">
        📱 WhatsApp us at: <a href="https://wa.me/918533855141" target="_blank" className="underline">8533855141</a>
      </div>
    </section>
  );
} 