/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  // Allow server-side network scanning
  serverExternalPackages: ['ping'],
}

module.exports = nextConfig
