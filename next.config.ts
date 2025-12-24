import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Exclude large files from serverless function output tracing
  outputFileTracingExcludes: {
    "*": [
      "./examples/**/*",
      "./.local/**/*",
      "node_modules/@swc/core-*/**/*",
      "**/examples/**",
      "**/.local/**",
      "examples/contact-sheet-*.json",
      ".local/contact-sheet-*.json",
    ],
  },
  turbopack: {
    root: __dirname,
  },
  // Webpack config to exclude large files
  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      // Ignore large JSON files from examples and .local directories
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.\.?\/.*\/examples\/contact-sheet-.*\.json$/,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.\.?\/.*\/\.local\/contact-sheet-.*\.json$/,
        })
      );
    }
    return config;
  },
};

export default nextConfig;
