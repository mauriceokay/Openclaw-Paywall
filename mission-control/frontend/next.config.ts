import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/mission-control",
  allowedDevOrigins: ["192.168.1.101", "localhost", "127.0.0.1", process.env.REPLIT_DEV_DOMAIN || ""].filter(Boolean),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

export default nextConfig;
