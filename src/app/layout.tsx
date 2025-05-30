// No 'use client' here
import type { Metadata, Viewport } from 'next'; // Import Viewport
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import ClientLayout from '@/components/client-layout'; // Import the new client component
import { siteConfig } from '@/config/site';

const APP_THEME_COLOR = '#0891b2'; // Updated teal/cyan - Primary from last theme

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  manifest: '/manifest.json', // Link to the manifest file
  icons: [ // Add icons for various platforms
    { rel: 'apple-touch-icon', url: '/icons/icon-192x192.png' },
    { rel: 'icon', url: '/favicon.ico' }, // Standard favicon
  ],
};

// Add Viewport configuration for PWA
export const viewport: Viewport = {
  themeColor: APP_THEME_COLOR,
  // width: 'device-width',
  // initialScale: 1,
  // maximumScale: 1,
  // userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content={siteConfig.name} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={siteConfig.name} />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content={APP_THEME_COLOR} />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content={APP_THEME_COLOR} />
        {/* Link to manifest with crossOrigin attribute */}
        <link rel="manifest" href="/manifest.json" crossOrigin="anonymous" />
        {/* Preconnect to essential origins */}
        <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dvgilt12w'}`} crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        {/* Fast2SMS Verification Meta Tag */}
        <meta name="fast2sms" content="iBw7FEgOyGibzkD7iepav2yK68TCmLoP" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ClientLayout>{children}</ClientLayout>
        <div id="root-portal"></div>
      </body>
    </html>
  );
}
