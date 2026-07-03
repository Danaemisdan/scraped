import { NextResponse } from 'next/server';

export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserPromise: Promise<any> | null = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const fetchImage = searchParams.get('image');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  if (fetchImage === 'true') {
    try {
      const res = await fetch(targetUrl);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
      return NextResponse.json({ base64 }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' }});
    } catch (e) {
      return NextResponse.json({ base64: null }, { status: 500 });
    }
  }

  try {
    const { addExtra } = await import('puppeteer-extra');
    const puppeteerCore = (await import('puppeteer-core')).default;
    // @ts-ignore
    const puppeteer = addExtra(puppeteerCore);
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    puppeteer.use(StealthPlugin());

    const chromium = (await import('@sparticuz/chromium')).default;
    chromium.setGraphicsMode = false;

    const isLocal = process.env.NODE_ENV === 'development';
    
    if (!browserPromise) {
      browserPromise = (async () => {
        // @ts-ignore
        const executablePath = isLocal 
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
          : await chromium.executablePath();

        return puppeteer.launch({
          // @ts-ignore
          args: isLocal ? puppeteerCore.defaultArgs() : [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
          // @ts-ignore
          defaultViewport: chromium.defaultViewport,
          executablePath,
          // @ts-ignore
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        });
      })().catch(err => {
        browserPromise = null;
        throw err;
      });
    }

    let browser = await browserPromise;
    
    if (!browser || !browser.connected) {
      browserPromise = (async () => {
        // @ts-ignore
        const executablePath = isLocal 
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
          : await chromium.executablePath();
          
        return puppeteer.launch({
          // @ts-ignore
          args: isLocal ? puppeteerCore.defaultArgs() : [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
          // @ts-ignore
          defaultViewport: chromium.defaultViewport,
          executablePath,
          // @ts-ignore
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        });
      })().catch(err => {
        browserPromise = null;
        throw err;
      });
      browser = await browserPromise;
    }

    const page = await browser.newPage();
    
    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Wait an extra half second for React to hydrate styles if needed
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.log('Navigation timeout, proceeding with current DOM state');
    }
    
    let html = await page.content();
    await page.close();

    const originUrl = new URL(targetUrl);
    html = html.replace('<head>', `<head><base href="${originUrl.origin}">`);
    
    // Rewrite protocol relative URLs to absolute
    html = html.replace(/href="\/\//g, 'href="https://');
    html = html.replace(/src="\/\//g, 'src="https://');

    return new NextResponse(html, {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch the URL' }, { status: 500 });
  }
}
