import React from 'react';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <main className="max-w-2xl mx-auto py-10 px-4 text-gray-700">
      <h1 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
        <span role="img" aria-label="phone">📞</span> Contact Us – Smart Bharat Health Services (SBHS)
      </h1>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 shadow-sm text-sm leading-relaxed space-y-4">
        <p>Have a question, need help with a test, or want to give feedback?<br />We're here to assist you — quickly and personally.</p>
        <div>
          <div className="font-semibold text-blue-800 mb-1">🧑‍💻 Customer Support</div>
          <div className="mb-2">
            <span className="font-medium">📱 Call or WhatsApp:</span><br />
            <a href="https://wa.me/918533855141" className="underline text-blue-700 font-bold" target="_blank" rel="noopener noreferrer">👉 8533855141</a><br />
            <span className="text-xs text-gray-500">(Available Monday to Saturday, 9:00 AM to 6:00 PM)</span>
          </div>
          <div className="mb-2">
            <span className="font-medium">📧 Email:</span><br />
            <a href="mailto:smartbharathealthservices@gmail.com" className="underline text-blue-700 font-bold">👉 smartbharathealthservices@gmail.com</a>
          </div>
        </div>
        <div className="border-t border-blue-100 pt-3 mt-3 space-y-2">
          <div className="font-semibold text-blue-800">💬 For Quick Help:</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>To book a test, just send us your name and test name on WhatsApp.</li>
            <li>For membership queries, mention <span className="font-bold">"Membership Help"</span>.</li>
            <li>For any complaint or follow-up, reply with <span className="font-bold">"Urgent"</span> on WhatsApp — we'll prioritize it.</li>
          </ul>
        </div>
        <div className="border-t border-blue-100 pt-3 mt-3 space-y-2">
          <div className="font-semibold text-blue-800">🧾 Business & Tie-up Enquiries</div>
          <p>Are you a lab, collection center, or hospital looking to partner with us? We'd love to connect!</p>
          <div>
            <span className="font-medium">📨 Email:</span> <a href="mailto:smartbharathealthservices@gmail.com" className="underline text-blue-700 font-bold">smartbharathealthservices@gmail.com</a><br />
            <span className="font-medium">📱 WhatsApp:</span> <a href="https://wa.me/918533855141?text=Business%20Tie-up" className="underline text-blue-700 font-bold" target="_blank" rel="noopener noreferrer">8533855141</a> <span className="text-xs">(mention "Business Tie-up")</span>
          </div>
        </div>
        <div className="border-t border-blue-100 pt-3 mt-3 space-y-2">
          <div className="font-semibold text-blue-800">🔐 Concerned About Privacy?</div>
          <div className="flex gap-4 flex-wrap">
            <Link href="/privacy-policy" className="underline text-blue-700 flex items-center gap-1"><span role="img" aria-label="lock">🔒</span> Privacy Policy</Link>
            <Link href="/terms" className="underline text-blue-700 flex items-center gap-1"><span role="img" aria-label="document">📄</span> Terms & Conditions</Link>
          </div>
        </div>
        <div className="pt-4 text-center text-blue-700 font-semibold">
          Smart Bharat Health Services – Because your health matters.<br />Let's stay connected!
        </div>
      </div>
    </main>
  );
} 