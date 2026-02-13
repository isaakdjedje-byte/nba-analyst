/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Exclude test files from the build
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.test\.(ts|tsx|js|jsx)$/,
      use: 'null-loader',
    });
    return config;
  },
}

export default nextConfig
