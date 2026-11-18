import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // photo uploads (max 2 MB each) travel inside a Server Action request
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  images: {
    qualities: [75, 100], // the logos use quality 100
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
