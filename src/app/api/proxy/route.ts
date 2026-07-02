import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const fetchImage = searchParams.get('image');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
    });

    if (fetchImage === 'true') {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
      return NextResponse.json({ base64 }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' }});
    }

    let html = await response.text();
    
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
  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to fetch the URL' }, { status: 500 });
  }
}
