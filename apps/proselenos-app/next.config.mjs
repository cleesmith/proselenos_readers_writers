/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['isows'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  productionBrowserSourceMaps: false, // Memory optimization
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
