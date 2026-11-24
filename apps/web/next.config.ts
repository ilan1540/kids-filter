import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kids/shared"],
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
