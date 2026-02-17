/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude test files from the build
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.test\.(ts|tsx|js|jsx)$/,
      use: 'null-loader',
    });
    return config;
  },
  // Handle pages that require dynamic rendering
  experimental: {
    optimizePackageImports: ['@prisma/client', 'next-auth'],
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/picks',
        permanent: true,
      },
    ];
  },
}

export default nextConfig
