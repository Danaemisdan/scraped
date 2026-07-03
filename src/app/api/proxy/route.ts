import { NextResponse } from 'next/server';
import 'is-plain-object';
import 'clone-deep';
import 'merge-deep';

export const maxDuration = 60;

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
    const chromium = (await import('@sparticuz/chromium')).default;
    
    puppeteer.use(StealthPlugin());

    const isLocal = process.env.NODE_ENV === 'development';
    
    // In local dev, you must have Chrome installed at this path or similar.
    // In Vercel, sparticuz provides the Chromium binary natively.
    const executablePath = isLocal 
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: isLocal ? ['--no-sandbox', '--disable-setuid-sandbox'] : chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setBypassCSP(true);
    
    // Spoof a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Wait an extra second for React to hydrate styles if needed
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e) {
      console.log('Navigation timeout, proceeding with current DOM state');
    }
    
    let html = await page.content();
    await browser.close();

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
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch the URL' }, { status: 500 });
  }
}
