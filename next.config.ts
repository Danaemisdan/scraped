import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth', '@sparticuz/chromium'],
};

export default nextConfig;
