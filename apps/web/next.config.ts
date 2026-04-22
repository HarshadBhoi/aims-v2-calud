import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Workspace packages are TypeScript sources — transpile them.
  transpilePackages: ["@aims/validation"],

  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
