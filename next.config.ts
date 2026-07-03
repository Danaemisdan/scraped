import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
  outputFileTracingIncludes: {
    '/api/proxy': [
      './node_modules/@sparticuz/chromium/**/*',
      './node_modules/puppeteer-extra/**/*',
      './node_modules/puppeteer-extra-plugin-stealth/**/*',
      './node_modules/puppeteer-extra-plugin/**/*',
      './node_modules/puppeteer-extra-plugin-user-data-dir/**/*',
      './node_modules/puppeteer-extra-plugin-user-preferences/**/*',
      './node_modules/merge-deep/**/*',
      './node_modules/clone-deep/**/*',
      './node_modules/is-plain-object/**/*',
      './node_modules/kind-of/**/*',
      './node_modules/isobject/**/*',
      './node_modules/shallow-clone/**/*',
      './node_modules/lazy-cache/**/*',
      './node_modules/mixin-object/**/*',
      './node_modules/for-in/**/*',
      './node_modules/for-own/**/*',
      './node_modules/is-extendable/**/*',
      './node_modules/is-buffer/**/*',
      './node_modules/is-window/**/*',
      './node_modules/debug/**/*',
      './node_modules/ms/**/*',
      './node_modules/deepmerge/**/*',
      './node_modules/fs-extra/**/*',
      './node_modules/graceful-fs/**/*',
      './node_modules/universalify/**/*',
      './node_modules/jsonfile/**/*',
      './node_modules/rimraf/**/*',
      './node_modules/balanced-match/**/*',
      './node_modules/brace-expansion/**/*',
      './node_modules/concat-map/**/*',
      './node_modules/fs.realpath/**/*',
      './node_modules/glob/**/*',
      './node_modules/inflight/**/*',
      './node_modules/inherits/**/*',
      './node_modules/minimatch/**/*',
      './node_modules/once/**/*',
      './node_modules/path-is-absolute/**/*',
      './node_modules/wrappy/**/*',
      './node_modules/arr-union/**/*'
    ]
  }
};

export default nextConfig;
