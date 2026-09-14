import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      // The application still rejects files over 10 MB. This room only covers multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
