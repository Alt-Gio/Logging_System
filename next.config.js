const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    {
      // API routes — NetworkFirst with 10s timeout, fallback to cache
      urlPattern: /^\/api\/(settings|announcements|pcs|stats)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'dict-api-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 8,
      },
    },
    {
      // Logs API — StaleWhileRevalidate so offline still shows last known data
      urlPattern: /^\/api\/logs/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'dict-logs-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      // Static assets — CacheFirst
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|webp|woff2?)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dict-static-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Fonts — CacheFirst forever
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dict-font-cache',
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      // Everything else — NetworkFirst
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'dict-logbook-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false }
    }
    return config
  },
}

module.exports = withPWA(nextConfig)
