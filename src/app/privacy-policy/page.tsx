import React from 'react';

export default function PrivacyPolicy() {
  return (
    <main className="max-w-2xl mx-auto py-10 px-4 text-gray-700">
      <h1 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
        <span role="img" aria-label="lock">🔒</span> Privacy Policy – Smart Bharat Health Services (SBHS)
      </h1>
      <div className="text-xs text-gray-500 mb-4">Effective Date: {new Date().toLocaleDateString('en-IN')}</div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 shadow-sm text-sm leading-relaxed space-y-4">
        <p>
          At Smart Bharat Health Services (SBHS), we value your privacy and are committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, share, and protect your information.
        </p>
        <div>
          <strong>🔹 1. Information We Collect</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Name, gender, and age</li>
            <li>Mobile number & WhatsApp number</li>
            <li>Email address</li>
            <li>Address or location (for sample pickup)</li>
            <li>Test details (selected lab, tests booked, prices)</li>
            <li>Communication logs (WhatsApp, phone, etc.)</li>
          </ul>
        </div>
        <div>
          <strong>🔹 2. How We Use Your Information</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>To process your lab test bookings</li>
            <li>To coordinate with our partnered collection centers/labs</li>
            <li>To send test reports via WhatsApp or email</li>
            <li>To provide customer support and updates</li>
            <li>To send you offers or reminders (optional)</li>
          </ul>
        </div>
        <div>
          <strong>🔹 3. Information Sharing</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>We do not sell your personal data.</li>
            <li>However, we may share limited information with:</li>
            <ul className="list-disc pl-8 mt-1 space-y-1">
              <li>Our trusted lab partners or collection center managers — only to complete your booking or sample pickup</li>
              <li>WhatsApp or SMS APIs (for communication)</li>
              <li>Legal authorities, if required under law</li>
            </ul>
          </ul>
        </div>
        <div>
          <strong>🔹 4. Data Security</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>All your data is stored securely and is accessible only by authorized team members.</li>
            <li>We follow industry-standard measures to protect your information from unauthorized access.</li>
          </ul>
        </div>
        <div>
          <strong>🔹 5. Cookies & Analytics</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>We may use basic analytics tools (like Google Analytics) to track visitor activity on our website or app. This helps us improve user experience. No personally identifiable data is tracked.</li>
          </ul>
        </div>
        <div>
          <strong>🔹 6. Your Rights</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>You have the right to:</li>
            <ul className="list-disc pl-8 mt-1 space-y-1">
              <li>Request what data we have about you</li>
              <li>Ask us to correct or delete your information</li>
              <li>Opt-out of marketing or offer messages anytime</li>
            </ul>
          </ul>
          <div className="mt-2">
            To do so, contact us at:<br />
            📧 Email: <a href="mailto:smartbharathealthservices@gmail.com" className="underline text-blue-700">smartbharathealthservices@gmail.com</a><br />
            📱 WhatsApp: <a href="https://wa.me/918533855141" className="underline text-blue-700">8533855141</a>
          </div>
        </div>
        <div>
          <strong>🔹 7. Changes to this Privacy Policy</strong>
          <p>We may update this policy from time to time. Any changes will be posted here with a new "Effective Date".</p>
        </div>
        <div className="mt-4">
          <strong>✅ Still have questions?</strong><br />
          Please contact us directly at <a href="mailto:smartbharathealthservices@gmail.com" className="underline text-blue-700">smartbharathealthservices@gmail.com</a> or WhatsApp <a href="https://wa.me/918533855141" className="underline text-blue-700">8533855141</a>
        </div>
        <div className="mt-4 text-blue-700 font-semibold">SBHS – Preventive Healthcare made Affordable & Accessible.</div>
      </div>
    </main>
  );
} 