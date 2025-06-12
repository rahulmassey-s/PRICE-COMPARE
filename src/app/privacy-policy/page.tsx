"use client";
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function PrivacyPolicy() {
  const { t, i18n } = useTranslation();
  return (
    <main className="max-w-2xl mx-auto py-10 px-4 text-gray-700">
      <h1 className="text-xl font-bold mb-4 text-blue-700 flex items-center gap-2">
        <span role="img" aria-label="lock">🔒</span> {t('privacy_title')}
      </h1>
      <div className="text-xs text-gray-500 mb-4">{t('privacy_effective_date')} {new Date().toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN')}</div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 shadow-sm text-sm leading-relaxed space-y-6">
        {/* Section 1 */}
        <div>
          <div className="font-semibold mb-1">{t('privacy_section1_title')}</div>
          <ul className="list-disc ml-5">
            {(t('privacy_section1_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Section 2 */}
        <div>
          <div className="font-semibold mb-1">{t('privacy_section2_title')}</div>
          <ul className="list-disc ml-5">
            {(t('privacy_section2_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Section 3 */}
        <div>
          <div className="font-semibold mb-1">{t('privacy_section3_title')}</div>
          <ul className="list-disc ml-5">
            {(t('privacy_section3_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Section 4 */}
        <div>
          <div className="font-semibold mb-1">{t('privacy_section4_title')}</div>
          <ul className="list-disc ml-5">
            {(t('privacy_section4_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Section 5 */}
        <div>
          <div className="font-semibold mb-1">{t('privacy_section5_title')}</div>
          <ul className="list-disc ml-5">
            {(t('privacy_section5_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Section 6 */}
        <div>
          <div className="font-semibold mb-1">{t('privacy_section6_title')}</div>
          <ul className="list-disc ml-5">
            {(t('privacy_section6_list', { returnObjects: true }) as string[]).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        {/* Section 7 */}
        <div>
          <div className="font-semibold mb-1">{t('privacy_section7_title')}</div>
          <p>{t('privacy_section7_text')}</p>
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-6 text-center">{t('privacy_section_footer')}</div>
    </main>
  );
} 