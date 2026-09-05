import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // The bundled gallery placeholders are our own build-time-generated SVGs
    // (botanical abstractions), never guest/user-uploaded content, so it's
    // safe to opt in to SVG optimization with a strict CSP on the served
    // asset. Real photos supplied later can be any raster format.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
