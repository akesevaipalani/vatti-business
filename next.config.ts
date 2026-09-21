import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Ensure server components can handle local SQLite operations smoothly
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
