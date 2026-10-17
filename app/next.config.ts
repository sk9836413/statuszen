import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Native / server-only packages that must not be bundled.
  serverExternalPackages: ["mysql2", "nodemailer"],
  experimental: {
    serverActions: {
      // Logo / favicon uploads from the admin panel.
      bodySizeLimit: "5mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      // Everything except /embed/* may only be framed by this site.
      { source: "/:path((?!embed/).*)", headers: securityHeaders },
      // Pages under /embed/ may be shown in iframes on other sites (none are shipped by default).
      {
        source: "/embed/:path*",
        headers: [
          ...securityHeaders.filter((h) => h.key !== "X-Frame-Options"),
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
