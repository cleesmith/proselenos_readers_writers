/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['isows'],
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: false,
  },
  transpilePackages: ['book-pdf'],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Polyfills for pdfkit's Node.js dependencies (used by book-pdf)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        stream: 'vite-compatible-readable-stream',
        zlib: 'browserify-zlib',
        buffer: 'buffer',
        util: false,
        fs: false,
      };
      // Make Buffer globally available (pdfkit uses it without importing)
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      );
      // Define BROWSER flag for font-source.ts and pdfkit code paths
      config.plugins.push(
        new webpack.DefinePlugin({
          BROWSER: JSON.stringify(true),
        }),
      );
    }

    return config;
  },
};

export default nextConfig;
