const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      // API routes — NetworkFirst with 5s timeout for faster offline fallback
      urlPattern: /^\/api\/(settings|announcements|pcs|stats)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'dict-api-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 5,
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Logs API — StaleWhileRevalidate for instant offline access
      urlPattern: /^\/api\/logs/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'dict-logs-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Voice API — NetworkOnly (requires internet)
      urlPattern: /^\/api\/voice/,
      handler: 'NetworkOnly',
    },
    {
      // Images — CacheFirst with longer expiration
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|webp|avif)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dict-image-cache',
        expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Fonts — CacheFirst with very long expiration
      urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dict-font-cache',
        expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Google Fonts — CacheFirst
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dict-google-fonts',
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Cloudinary images — CacheFirst
      urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dict-cloudinary-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Next.js static files — CacheFirst
      urlPattern: /^\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dict-next-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      // Pages — NetworkFirst with fast timeout
      urlPattern: /^\/(?!api).*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'dict-pages-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 3,
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.pusher.com https://*.clerk.accounts.dev https://clerk.accounts.dev https://challenges.cloudflare.com",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://res.cloudinary.com https://api.qrserver.com https://*.clerk.accounts.dev",
              "connect-src 'self' https://api.groq.com https://*.pusher.com wss://*.pusher.com https://clerk.accounts.dev https://*.clerk.accounts.dev https://res.cloudinary.com",
              "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev",
            ].join('; '),
          },
        ],
      },
    ]
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
