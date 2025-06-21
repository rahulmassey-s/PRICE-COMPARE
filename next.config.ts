import type {NextConfig} from 'next';

// const withPWA = require('@ducanh2912/next-pwa').default({
//   dest: 'public',
//   // Inject OneSignal's service worker script at the top of the generated sw.js
//   importScripts: ['https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'],
//   disable: process.env.NODE_ENV === 'development', // Disable PWA in dev mode for faster reloads
// });

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos', // Standard placeholder
        port: '',
        pathname: '/**',
      },
      { // Add Cloudinary hostname
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: `/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dvgilt12w'}/**`, // Use env var or fallback
      },
      { // Add Unsplash hostname
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    // Make Cloudinary config available client-side if needed elsewhere (already using NEXT_PUBLIC_)
    // NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    // NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  }
};

// Wrap the Next.js config with the PWA config
// export default withPWA(nextConfig);
export default nextConfig;
