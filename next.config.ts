import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/diarytom",
  assetPrefix: "/diarytom/",
  images: { unoptimized: true },
};

export default nextConfig;
