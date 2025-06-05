import React from 'react';

export default function DisclaimerPage() {
  return (
    <main className="max-w-2xl mx-auto py-10 px-4 text-gray-700">
      <h1 className="text-2xl font-bold mb-4 text-blue-700">Disclaimer</h1>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 shadow-sm text-sm leading-relaxed">
        <p className="mb-3">
          <strong>Smart Bharat Health Services (SBHS)</strong> is an independent health service platform that facilitates lab test bookings through our partnered and authorized collection centers in Bareilly.
        </p>
        <p className="mb-3">
          SBHS is not directly affiliated with any diagnostic lab brand such as Dr. Lal PathLabs, SRL, Redcliff, etc. All brand names mentioned are the property of their respective owners, and are used here only for identification purposes through their authorized centers.
        </p>
        <p>
          For any test-related queries, SBHS customers are served by collection centers under valid authorization.
        </p>
      </div>
    </main>
  );
} 