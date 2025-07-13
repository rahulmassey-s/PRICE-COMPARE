/** @type {import('next').NextConfig} */
// PWA configuration has been removed to prevent service worker conflicts.
// import withPWA from 'next-pwa';

// const pwaConfig = {
//   dest: 'public',
//   register: false,
//   skipWaiting: true,
//   disable: process.env.NODE_ENV === 'development',
// };

const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('firebase-admin');
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  reactStrictMode: true,
};

export default nextConfig; 