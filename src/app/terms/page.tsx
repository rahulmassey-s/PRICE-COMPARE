import React from 'react';

export default function TermsAndConditions() {
  return (
    <main className="max-w-2xl mx-auto py-10 px-4 text-gray-700">
      <h1 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
        <span role="img" aria-label="document">📄</span> Terms & Conditions – Smart Bharat Health Services (SBHS)
      </h1>
      <div className="text-xs text-gray-500 mb-4">Effective Date: {new Date().toLocaleDateString('en-IN')}</div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 shadow-sm text-sm leading-relaxed space-y-4">
        <p>
          By accessing or using the services offered by Smart Bharat Health Services (SBHS), you agree to be bound by the following Terms and Conditions. If you do not agree, please do not use our platform.
        </p>
        <div>
          <strong>🔹 1. About SBHS</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>SBHS is a health service aggregator that facilitates test bookings from partnered diagnostic labs and collection centers. We do not perform any medical testing ourselves.</li>
          </ul>
        </div>
        <div>
          <strong>🔹 2. Role & Responsibility</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>SBHS acts only as a coordinator or booking platform between you (the customer) and the respective lab or collection center.</li>
            <li>SBHS is not liable for lab report accuracy, delay in reports, or any misdiagnosis.</li>
            <li>The final responsibility of test processing, quality, and reporting lies with the chosen lab.</li>
          </ul>
        </div>
        <div>
          <strong>🔹 3. Test Booking & Sample Collection</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Bookings are confirmed only after payment or confirmation via WhatsApp.</li>
            <li>Home sample collection is subject to lab/technician availability in your area.</li>
            <li>In case of a failed visit, we will try to reschedule as soon as possible.</li>
          </ul>
        </div>
        <div>
          <strong>🔹 4. Refund & Cancellation Policy</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>No refunds will be provided once the sample has been collected.</li>
            <li>If booking is cancelled before sample collection, partial refund may be issued after deducting any applicable charges.</li>
            <li>SBHS is not responsible for delays or cancellation due to third-party labs.</li>
          </ul>
        </div>
        <div>
          <strong>🔹 5. Pricing & Discounts</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Discounts shown are based on SBHS tie-ups and are applicable only at the time of booking.</li>
            <li>Prices may vary or be updated without prior notice.</li>
            <li>SBHS reserves the right to change or withdraw any offers at any time.</li>
          </ul>
        </div>
        <div>
          <strong>🔹 6. Membership Terms</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>SBHS Membership is optional and provides extra discounts.</li>
            <li>Membership once purchased is non-refundable and valid for 1 year from the date of purchase.</li>
            <li>Benefits are applicable only to the member or their immediate family (as per registration).</li>
          </ul>
        </div>
        <div>
          <strong>🔹 7. User Conduct</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>By using our platform, you agree:</li>
            <ul className="list-disc pl-8 mt-1 space-y-1">
              <li>To provide accurate and honest information during bookings.</li>
              <li>Not to misuse SBHS for spamming, fraudulent activity, or medical emergencies.</li>
              <li>To treat our staff and lab partners with respect.</li>
            </ul>
          </ul>
        </div>
        <div>
          <strong>🔹 8. Limitation of Liability</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>SBHS will not be responsible for:</li>
            <ul className="list-disc pl-8 mt-1 space-y-1">
              <li>Lab errors, delayed reports, or misdiagnosis</li>
              <li>Physical or emotional damage due to test results</li>
              <li>Any issues arising due to third-party labs or technicians</li>
            </ul>
            <li>Use of our services is at your own discretion and risk.</li>
          </ul>
        </div>
        <div>
          <strong>🔹 9. Changes to Terms</strong>
          <p>SBHS reserves the right to update or modify these Terms at any time. Continued use of our services means you accept the updated Terms.</p>
        </div>
        <div className="mt-4">
          <strong>🛠 Support & Help</strong><br />
          For questions, complaints, or clarification:<br />
          📧 Email: <a href="mailto:smartbharathealthservices@gmail.com" className="underline text-blue-700">smartbharathealthservices@gmail.com</a><br />
          📱 WhatsApp: <a href="https://wa.me/918533855141" className="underline text-blue-700">8533855141</a>
        </div>
      </div>
    </main>
  );
} 