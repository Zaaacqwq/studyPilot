import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Course notes can be sizable PDFs; bump beyond the 1MB default.
      bodySizeLimit: '26mb',
    },
  },
}

export default nextConfig
