import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["xlsx", "pdf-parse"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
