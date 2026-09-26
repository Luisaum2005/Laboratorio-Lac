import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the standalone server for Docker; Vercel uses its Next.js adapter output.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  experimental: {
    serverActions: {
      // The application still rejects files over 10 MB. This room only covers multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
