import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth', '@sparticuz/chromium', 'is-plain-object', 'clone-deep', 'merge-deep', 'kind-of'],
};

export default nextConfig;
