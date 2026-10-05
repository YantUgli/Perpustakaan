import type { NextConfig } from "next";

import { alamatBackend } from "./src/lib/alamat-backend";

const nextConfig: NextConfig = {
  async rewrites() {
    // Satu origin (decisions.md §B). Rewrite hanya untuk development; staging/produksi (dan
    // `next build && next start` lokal) meneruskan /api/v1 lewat reverse proxy.
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/api/v1/:path*", destination: `${alamatBackend()}/api/v1/:path*` }];
  },
};

export default nextConfig;
