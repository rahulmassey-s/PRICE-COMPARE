"use client";
import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function ContactPage() {
  const { t, i18n } = useTranslation();
  return (
    <main className="max-w-2xl mx-auto py-10 px-4 text-gray-700">
      <h1 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
        <span role="img" aria-label="phone">📞</span> {t('contact_title')}
      </h1>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 shadow-sm text-sm leading-relaxed space-y-6">
        {/* Support Section */}
        <div>
          <div className="font-semibold mb-1">{t('contact_section_support')}</div>
          <ul className="list-disc ml-5">
            {(t('contact_section_support_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Quick Help Section */}
        <div>
          <div className="font-semibold mb-1">{t('contact_section_quick_help')}</div>
          <ul className="list-disc ml-5">
            {(t('contact_section_quick_help_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Business Section */}
        <div>
          <div className="font-semibold mb-1">{t('contact_section_business')}</div>
          <ul className="list-disc ml-5">
            {(t('contact_section_business_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Privacy Links Section */}
        <div>
          <div className="font-semibold mb-1">{t('contact_section_privacy')}</div>
          <ul className="list-disc ml-5">
            <li><Link href="/privacy-policy">{t('contact_section_privacy_links.0')}</Link></li>
            <li><Link href="/terms">{t('contact_section_privacy_links.1')}</Link></li>
          </ul>
        </div>
      </div>
    </main>
  );
} 