import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static shells + streamed dynamic parts (Partial Prerendering) and partial link prefetching.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "1mb" }, // a full submission with code is well under this
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // the Java runner is a same-origin iframe, so SAMEORIGIN rather than DENY
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // code runner files: served from the CDN edge, cached by browsers for a day
        source: "/runner/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
