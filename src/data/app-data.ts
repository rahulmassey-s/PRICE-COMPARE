
import type { ContactDetails } from '@/types';

// labTestsData has been removed as this data is now dynamically fetched from Firestore
// and managed through the admin panel.
// To populate lab tests, please use the admin panel:
// 1. Add Labs in the "Manage Labs" section.
// 2. Add Tests (associating them with labs and prices) in the "Manage Tests" section.
// This data will then appear on the homepage and in the admin panel tables.

export const contactDetailsData: ContactDetails = {
  phone: '+918077483317',
  whatsapp: '+918077483317',
  whatsappMessage: 'Hello! I am interested in a lab test discount from Lab Price Compare.',
  address: '123 Health St, Model Town, Bareilly, UP 243001',
  email: 'info@labpricecompare.example.com'
};

