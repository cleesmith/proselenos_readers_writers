/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['isows'],
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
