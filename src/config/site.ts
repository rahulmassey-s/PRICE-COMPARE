
// src/config/site.ts

export const siteConfig = {
  name: "Lab Price Compare",
  description: "Compare lab test prices and get discounts in Bareilly.",
  logo: "/smart-bharat-logo.png", // Ensure this path is correct and the file exists in /public
  defaultNextSlotTime: "06:00 AM", // A sensible default
};

export type SiteConfig = typeof siteConfig;
