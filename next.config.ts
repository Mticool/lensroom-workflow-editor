import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  outputFileTracingExcludes: {
    "*": [
      "**/examples/**",
      "**/.local/**",
      "**/examples/**/*",
      "**/.local/**/*",
    ],
    "api/workflow": [
      "**/examples/**",
      "**/.local/**",
      "**/examples/**/*",
      "**/.local/**/*",
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
