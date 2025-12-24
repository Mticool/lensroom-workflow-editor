import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  turbopack: {
    root: __dirname,
  },
  // Exclude large example files from webpack bundle
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude examples directory from server bundle
      config.externals = config.externals || [];
      config.externals.push({
        '../examples/contact-sheet-ChrisWalkman.json': 'commonjs ../examples/contact-sheet-ChrisWalkman.json',
        '../examples/contact-sheet-billsSupra.json': 'commonjs ../examples/contact-sheet-billsSupra.json',
        '../examples/contact-sheet-tim.json': 'commonjs ../examples/contact-sheet-tim.json',
        '../examples/contact-sheet-jpow.json': 'commonjs ../examples/contact-sheet-jpow.json',
      });
    }
    return config;
  },
};

export default nextConfig;
