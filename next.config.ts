import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/proxy': ['./node_modules/@sparticuz/chromium/**/*']
  }
};

export default nextConfig;
