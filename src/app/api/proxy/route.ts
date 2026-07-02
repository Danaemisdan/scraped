import { NextResponse } from 'next/server';
import { gotScraping } from 'got-scraping';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const fetchImage = searchParams.get('image');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    
    if (fetchImage === 'true') {
      const response = await gotScraping(targetUrl, { responseType: 'buffer' });
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const base64 = `data:${contentType};base64,${response.body.toString('base64')}`;
      return NextResponse.json({ base64 }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' }});
    }

    const response = await gotScraping(targetUrl);
    let html = response.body;
    
    // Inject <base> tag as a fallback
    const originUrl = new URL(targetUrl);
    html = html.replace('<head>', `<head><base href="${originUrl.origin}">`);

    // Manually rewrite stylesheet links to absolute URLs to fix Flipkart/Zivame CSS issues
    html = html.replace(/href="(\/[^"]+\.css[^"]*)"/g, `href="${originUrl.origin}$1"`);
    html = html.replace(/src="(\/[^"]+)"/g, `src="${originUrl.origin}$1"`);

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
