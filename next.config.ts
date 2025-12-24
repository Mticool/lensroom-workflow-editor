import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Exclude large files from serverless function output
    outputFileTracingExcludes: {
      "*": [
        "./examples/**/*",
        "./.local/**/*",
        "node_modules/@swc/core-*/**/*",
      ],
    },
  },
  turbopack: {
    root: __dirname,
  },
  // Webpack config to exclude large files
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude examples and .local from server bundle
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          "../examples": "commonjs ../examples",
          "../.local": "commonjs ../.local",
        });
      }
    }
    return config;
  },
};

export default nextConfig;
