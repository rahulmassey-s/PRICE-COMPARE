import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@/app/globals.css';
import { siteConfig } from '@/config/site';
import ClientLayout from '@/components/client-layout';
import AuthOnboardingGuard from '@/components/AuthOnboardingGuard';
import { Analytics } from '@/components/analytics';
import { Toaster } from '@/components/ui/toaster';
import { Inter } from 'next/font/google';

const APP_THEME_COLOR = '#0891b2';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  title: 'Smart Bharat',
  description: 'Your one-stop solution for affordable lab tests.',
  manifest: '/manifest.json',
  icons: [
    { rel: 'apple-touch-icon', url: '/icons/icon-192x192.png' },
    { rel: 'icon', url: '/favicon.ico' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/manifest.json" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dvgilt12w'}`} crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <meta name="fast2sms" content="iBw7FEgOyGibzkD7iepav2yK68TCmLoP" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased ${inter.className}`}>
        <ClientLayout>
          <AuthOnboardingGuard>
            {children}
          </AuthOnboardingGuard>
        </ClientLayout>
        <div id="root-portal"></div>
        <footer className="w-full bg-gray-50 border-t text-xs text-gray-500 py-3 px-2 text-center">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
