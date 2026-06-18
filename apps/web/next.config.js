import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  transpilePackages: ['@saas/ui', '@saas/config', '@saas/db-d1'],
  experimental: {
    optimizePackageImports: ['@saas/ui', 'lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
    // Required for static export
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
    ]
  },
  // Cloudflare Pages static export config
  output: process.env.NEXT_PUBLIC_DEPLOY_TARGET === 'cloudflare-pages' ? 'export' : undefined,
  distDir: process.env.NEXT_PUBLIC_DEPLOY_TARGET === 'cloudflare-pages' ? 'out' : '.next',
  trailingSlash: process.env.NEXT_PUBLIC_DEPLOY_TARGET === 'cloudflare-pages',
  // Disable SSR features for static export
  // Note: Clerk requires special handling for static export
}

const withNextIntl = createNextIntlPlugin()

export default withNextIntl(nextConfig)