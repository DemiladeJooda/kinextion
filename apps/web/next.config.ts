import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kinextion/shared", "@kinextion/ui"],
  reactStrictMode: false,
};

export default nextConfig;
