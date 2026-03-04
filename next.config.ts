import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep server-only libraries in Node.js bundle
  serverExternalPackages: ['mammoth', 'pdf-parse'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Allow CommonJS modules in server bundles
      config.externals = [...(config.externals || []), 'canvas', 'bufferutil', 'utf-8-validate'];
    }
    return config;
  },
};

export default nextConfig;
