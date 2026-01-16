const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'gstatic-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    {
      urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-assets-cache',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /^https:\/\/unpkg\.com\/@ffmpeg\/core@0\.12\.6\/dist\/umd\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'ffmpeg-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
  ],
  fallbacks: {
    document: '/offline',
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for GitHub Pages
  output: 'export',
  // No basePath - custom domain (gif.new) and localhost both serve at root
  poweredByHeader: false,
  compress: true,
  
  // Image optimization disabled for static export
  images: {
    unoptimized: true,
  },
  
  // ESLint configuration for build
  eslint: {
    dirs: ['app', 'components', 'lib'],
    ignoreDuringBuilds: false, // Keep linting during builds but don't fail on warnings
  },
  
  // TypeScript configuration for build
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // No basePath needed - custom domain serves at root
  env: {
    NEXT_PUBLIC_BASE_PATH: '',
  },
}

module.exports = withPWA(nextConfig) 