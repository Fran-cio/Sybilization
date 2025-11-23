import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Polyfills for browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  // Configure Turbopack for Next.js 16
  turbopack: {
    resolveAlias: {
      // Provide Buffer polyfill for browser
      buffer: "buffer/",
    },
  },
  // Transpile Aztec packages
  transpilePackages: [
    '@aztec/aztec.js',
    '@aztec/accounts',
    '@aztec/test-wallet',
    '@aztec/stdlib',
  ],
};

export default nextConfig;
