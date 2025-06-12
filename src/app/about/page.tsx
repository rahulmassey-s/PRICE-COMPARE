"use client";
import React from 'react';
import { useTranslation, Trans } from 'react-i18next';

export default function AboutUs() {
  const { t } = useTranslation();
  return (
    <section className="p-4 max-w-md mx-auto bg-white rounded-2xl shadow-md space-y-4">
      <h2 className="text-xl font-bold text-center text-blue-600">{t('about_us_title')}</h2>
      <p className="text-gray-700 text-sm">{t('about_us_intro')}</p>
      <div className="text-sm text-gray-600 space-y-2">
        <p>{t('about_us_why')}</p>
        <p>{t('about_us_why_text')}</p>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <p className="font-semibold">{t('about_us_vision')}</p>
        <p>{t('about_us_vision_text')}</p>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <p className="font-semibold">{t('about_us_values')}</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t('about_us_value_1')}</li>
          <li>{t('about_us_value_2')}</li>
          <li>{t('about_us_value_3')}</li>
          <li>{t('about_us_value_4')}</li>
        </ul>
      </div>
      <p className="font-semibold">{t('about_us_more_info')}</p>
      <ul className="space-y-1 underline">
        <li><a href="/contact">{t('about_us_contact')}</a></li>
        <li><a href="/privacy-policy">{t('about_us_privacy')}</a></li>
        <li><a href="/terms">{t('about_us_terms')}</a></li>
      </ul>
      <div className="text-center text-blue-600 text-sm font-semibold">
        <Trans i18nKey="about_us_whatsapp" components={{ 1: <a key="wa" href="https://wa.me/918533855141" target="_blank" className="underline" /> }} />
      </div>
    </section>
  );
} 