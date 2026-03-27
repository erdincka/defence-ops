import type { NextConfig } from "next";

const domain = process.env.DOMAIN || "localhost";
const fullDomain = `defence-ops.${domain}`;

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: false,
  experimental: {
    allowedDevOrigins: [fullDomain]
  } as any
};

export default nextConfig;

