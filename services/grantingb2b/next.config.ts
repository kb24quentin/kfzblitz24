import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Increase body size for Gewerbeschein uploads (PDFs up to 10 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
