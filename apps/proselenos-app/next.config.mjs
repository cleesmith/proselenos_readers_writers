/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['isows'],
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
