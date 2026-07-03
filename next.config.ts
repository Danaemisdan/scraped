import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
  outputFileTracingIncludes: {
    '/api/proxy': [
      './node_modules/@sparticuz/chromium/**/*',
      './node_modules/puppeteer-extra/**/*',
      './node_modules/puppeteer-extra-plugin-stealth/**/*',
      './node_modules/puppeteer-extra-plugin/**/*',
      './node_modules/merge-deep/**/*',
      './node_modules/clone-deep/**/*',
      './node_modules/is-plain-object/**/*',
      './node_modules/kind-of/**/*'
    ]
  }
};

export default nextConfig;
