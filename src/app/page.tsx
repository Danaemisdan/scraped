'use client';

import React, { useState, useRef, useEffect } from 'react';
import { runAIAnalysis, AnalyzedProduct } from '@/lib/analytics';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';

type Platform = 'amazon' | 'flipkart' | 'myntra' | 'zivame';

const platforms = [
  { id: 'amazon', name: 'Amazon' },
  { id: 'flipkart', name: 'Flipkart' },
  { id: 'myntra', name: 'Myntra' },
  { id: 'zivame', name: 'Zivame' }
];

function parseOrdersFromText(text: string | null | undefined): number {
  if (!text) return 0;
  const match = text.match(/([0-9K+M,]+)\s+bought/i) || text.match(/([0-9,]+)\s+orders/i);
  if (!match) return 0;
  let numStr = match[1].replace(/,/g, '');
  let multiplier = 1;
  if (numStr.toUpperCase().includes('K')) {
    multiplier = 1000;
    numStr = numStr.replace(/K/ig, '').replace(/\+/g, '');
  } else if (numStr.toUpperCase().includes('M')) {
    multiplier = 1000000;
    numStr = numStr.replace(/M/ig, '').replace(/\+/g, '');
  }
  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? 0 : parsed * multiplier;
}

const scraperConfig = {
  amazon: {
    buildUrl: (query: string) => `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
    getBaseUrl: () => 'https://www.amazon.in',
    scrapeSearch: (doc: Document, query: string) => {
      const items = Array.from(doc.querySelectorAll('div[data-asin]')).filter(el => el.getAttribute('data-asin') !== '');
      return items.map(item => {
        const titleEl = item.querySelector('h2 span.a-text-normal') || item.querySelector('h2 .a-text-normal') || item.querySelector('h2') || item.querySelector('span.a-size-medium.a-text-normal, span.a-size-base-plus.a-text-normal');
        const linkEl = item.querySelector('a.a-link-normal[href*="/dp/"]') || item.querySelector('h2 a') || item.querySelector('img')?.closest('a');
        
        const priceEl = item.querySelector('.a-price-whole');
        const fallbackPrice = priceEl ? `₹${priceEl.textContent?.trim()}` : 'Fetching...';

        return {
          title: titleEl?.textContent?.trim() || '',
          price: fallbackPrice,
          image: item.querySelector('img.s-image')?.getAttribute('src') || '',
          link: linkEl ? `https://www.amazon.in${linkEl.getAttribute('href')}` : '',
          rating: 'N/A',
          reviewsCount: 0,
          ordersCount: 0,
          tags: [],
          category: query
        };
      }).filter(item => item.title && item.link);
    },
    scrapeDeep: (doc: Document) => {
      const price = doc.querySelector('.a-price .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen')?.textContent?.trim();
      const rating = doc.querySelector('#acrPopover') || doc.querySelector('i[class*="a-icon-star"] span')?.textContent?.trim();
      const reviewsText = doc.querySelector('#acrCustomerReviewText')?.textContent;
      const reviewsCount = parseInt(reviewsText?.replace(/[^0-9]/g, '') || '0');
      const image = doc.querySelector('#landingImage')?.getAttribute('src');
      const tags = Array.from(doc.querySelectorAll('.badge-wrapper, .a-badge-text')).map(el => el.textContent?.trim() || '').filter(Boolean);
      const description = doc.querySelector('.product-description')?.textContent?.trim() || '';
      return { price, rating: rating ? (rating as any).getAttribute?.('title') || rating : 'N/A', reviewsCount, image, tags: [], description };
    }
  },
  flipkart: {
    buildUrl: (query: string) => `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
    getBaseUrl: () => 'https://www.flipkart.com',
    scrapeSearch: (doc: Document, query: string) => {
      const items = Array.from(doc.querySelectorAll('div[data-id], div._1xHGtK, div.cPHDOP'));
      return items.map(item => {
        const titleEl = item.querySelector('a.IRpwTa') || item.querySelector('div._4rR01T') || item.querySelector('.s1Q9rs, .WKTcLC');
        let linkEl = item.querySelector('a._1fQZEK') || item.querySelector('a.IRpwTa') || item.querySelector('a.VJA3rP') || item.querySelector('a.CGtC98') || item.querySelector('a');
        let href = linkEl?.getAttribute('href') || '';
        if (href && href.startsWith('/')) href = `https://www.flipkart.com${href}`;

        const priceEl = item.querySelector('div._30jeq3, div.Nx9bqj');
        const fallbackPrice = priceEl ? priceEl.textContent?.trim() : 'Fetching...';

        return {
          title: titleEl?.textContent?.trim() || '',
          price: fallbackPrice,
          image: item.querySelector('img._396cs4, img._53J4C-, img.DByuf4, img.rUckxa')?.getAttribute('src') || '',
          link: href,
          rating: 'N/A',
          reviewsCount: 0,
          ordersCount: 0,
          tags: [],
          category: query
        };
      }).filter(item => item.title && item.link);
    },
    scrapeDeep: (doc: Document) => {
      const price = doc.querySelector('div._30jeq3, div.Nx9bqj.CxhGGd')?.textContent?.trim();
      const rating = doc.querySelector('div._3LWZlK, div.XQDdHH')?.textContent?.trim();
      const reviewsText = doc.querySelector('span._2_R_DZ, span.Wphh3N')?.textContent;
      const reviewsCount = parseInt(reviewsText?.match(/([0-9,]+)\s+Reviews/i)?.[1]?.replace(/,/g, '') || '0');
      const image = doc.querySelector('img._396cs4, img._2r_T1I, img.DByuf4, img._0DkuZV')?.getAttribute('src');
      return { price, rating, reviewsCount, image, tags: [] };
    }
  },
  myntra: {
    buildUrl: (query: string) => `https://www.myntra.com/${encodeURIComponent(query)}`,
    getBaseUrl: () => 'https://www.myntra.com',
    scrapeSearch: (doc: Document, query: string) => {
      let items = Array.from(doc.querySelectorAll('li.product-base'));
      
      // JSON Extraction for CSR
      let extractedProducts: any[] = [];
      if (items.length === 0) {
         doc.querySelectorAll('script').forEach(s => {
           if (s.textContent && s.textContent.includes('window.__myx')) {
             try {
               const match = s.textContent.match(/window\.__myx\s*=\s*({.+});?/);
               if (match) {
                 const data = JSON.parse(match[1]);
                 const products = data?.searchData?.results?.products || [];
                 extractedProducts = products.map((p: any) => ({
                    title: p.productName || p.name || '',
                    price: `₹${p.price || p.mrp}`,
                    image: p.searchImage || p.defaultImage || '',
                    link: `https://www.myntra.com/${p.landingPageUrl || p.dreLandingPageUrl || ''}`,
                    rating: p.rating ? `${p.rating.toPrecision(2)} out of 5` : 'N/A',
                    reviewsCount: p.ratingCount || 0,
                    ordersCount: 0,
                    tags: [],
                    category: query
                 }));
               }
             } catch(e) {}
           }
         });
      }

      if (extractedProducts.length > 0) return extractedProducts.filter((p: any) => p.title && p.link);

      return items.map(item => {
        const brandEl = item.querySelector('h3.product-brand');
        const productEl = item.querySelector('h4.product-product');
        const linkEl = item.querySelector('a');
        let href = linkEl?.getAttribute('href') || '';
        if (href && !href.startsWith('http')) href = `https://www.myntra.com/${href}`;
        
        const priceEl = item.querySelector('.product-discountedPrice, .product-price');
        const fallbackPrice = priceEl ? priceEl.textContent?.trim() : 'Fetching...';

        return {
          title: `${brandEl?.textContent || ''} ${productEl?.textContent || ''}`.trim(),
          price: fallbackPrice,
          image: item.querySelector('img.img-responsive, picture img')?.getAttribute('src') || '',
          link: href,
          rating: 'N/A',
          reviewsCount: 0,
          ordersCount: 0,
          tags: [],
          category: query
        };
      }).filter(item => item.title && item.link);
    },
    scrapeDeep: (doc: Document) => {
      const price = doc.querySelector('span.pdp-price, span.pdp-discountedPrice')?.textContent?.trim();
      const rating = doc.querySelector('.index-overallRating div')?.textContent?.trim();
      const countEl = doc.querySelector('.index-ratingsCount');
      const reviewsCount = parseInt(countEl?.textContent?.replace(/[^0-9]/g, '') || '0');
      const image = doc.querySelector('.image-grid-image')?.getAttribute('style')?.match(/url\("([^"]+)"\)/)?.[1];
      return { price, rating, reviewsCount, image, tags: [] };
    }
  },
  zivame: {
    buildUrl: (query: string) => `https://www.zivame.com/search?q=${encodeURIComponent(query)}`,
    getBaseUrl: () => 'https://www.zivame.com',
    scrapeSearch: (doc: Document, query: string) => {
      const items = Array.from(doc.querySelectorAll('.product-item, .product-card, .zivame-card'));
      
      let extractedProducts: any[] = [];
      if (items.length === 0) {
        doc.querySelectorAll('script').forEach(s => {
          if (s.textContent && (s.textContent.includes('__NEXT_DATA__') || s.textContent.includes('window.state'))) {
             try {
                // Aggressive regex to find any JSON array containing product data
                const matches = s.textContent.match(/"products":\s*(\[.+?\])/);
                if (matches) {
                   const products = JSON.parse(matches[1]);
                   extractedProducts = products.map((p: any) => ({
                      title: p.name || p.title || '',
                      price: p.price ? `₹${p.price}` : 'Fetching...',
                      image: p.image || p.imageUrl || '',
                      link: `https://www.zivame.com/${p.url || p.url_key || ''}`,
                      rating: 'N/A',
                      reviewsCount: 0,
                      ordersCount: 0,
                      tags: [],
                      category: query
                   }));
                }
             } catch(e) {}
          }
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (extractedProducts.length > 0) return extractedProducts.filter((p: any) => p.title && p.link);

      return items.map(item => {
        // Try multiple selectors for Zivame's product title
        const titleEl = item.querySelector('.prod-name, .product-title, .title, .product-brand, h2, h3, .name');
        const linkEl = item.querySelector('a');
        let href = linkEl?.getAttribute('href') || '';
        if (href && !href.startsWith('http')) href = `https://www.zivame.com${href}`;

        const priceEl = item.querySelector('.final-price, .discount-price, .price, .rupee-format');
        const fallbackPrice = priceEl ? priceEl.textContent?.trim() : 'Fetching...';
        
        let titleText = titleEl?.textContent?.trim() || '';
        // If the title is an offer like "Buy 2 Get 1 Free", try to find a better title
        if (titleText.toLowerCase().includes('offer') || titleText.toLowerCase().includes('buy') || titleText.includes('%')) {
            const altTitleEl = Array.from(item.querySelectorAll('*')).find(el => {
                const text = el.textContent?.trim() || '';
                return text.length > 10 && !text.includes('₹') && !text.toLowerCase().includes('offer') && !text.toLowerCase().includes('buy');
            });
            if (altTitleEl) {
                titleText = altTitleEl.textContent?.trim() || titleText;
            }
        }

        return {
          title: titleText,
          price: fallbackPrice,
          image: item.querySelector('img.product-image, img.image, img.lazyload')?.getAttribute('src') || item.querySelector('img')?.getAttribute('data-src') || item.querySelector('img')?.getAttribute('src') || '',
          link: href,
          rating: 'N/A',
          reviewsCount: 0,
          ordersCount: 0,
          tags: [],
          category: query
        };
      }).filter(item => item.title && item.link);
    },
    scrapeDeep: (doc: Document) => {
      const price = doc.querySelector('.final-price, .discount-price')?.textContent?.trim();
      const rating = doc.querySelector('.rating, .product-rating')?.textContent?.trim();
      const reviewsCount = parseInt(doc.querySelector('.reviews-count')?.textContent?.replace(/[^0-9]/g, '') || '0');
      const image = doc.querySelector('.product-image-container img')?.getAttribute('src');
      const description = doc.querySelector('.product-description')?.textContent?.trim() || '';
      return { price, rating, reviewsCount, image, tags: [], description };
    }
  }
};

export default function Home() {
  const [platform, setPlatform] = useState<Platform>('amazon');
  const [query, setQuery] = useState('');
  const [currentScrapeUrl, setCurrentScrapeUrl] = useState('');
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<AnalyzedProduct[]>([]);
  const [deepCrawlingProgress, setDeepCrawlingProgress] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<AnalyzedProduct | null>(null);
  const [botBlocked, setBotBlocked] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  
  const shadowHostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  // Platform Home Screen Loading
  const handlePlatformChange = async (newPlatform: Platform) => {
    setPlatform(newPlatform);
    setQuery('');
    setProducts([]);
    setBotBlocked(null);
    const baseUrl = scraperConfig[newPlatform].getBaseUrl();
    setCurrentScrapeUrl(baseUrl);
    await fetchAndRenderProxy(baseUrl);
  };

  const fetchAndRenderProxy = async (target: string, currentQuery: string = '') => {
    setLoading(true);
    setBotBlocked(null);
    setCurrentScrapeUrl(target);
    try {
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(target)}`);
      
      if (!res.ok && res.status !== 403 && res.status !== 503) {
         try {
           const errData = await res.json();
           throw new Error(errData.error || 'Failed to fetch proxy');
         } catch (e: any) {
           throw new Error(e.message || 'Failed to fetch proxy');
         }
      }
      const rawHtml = await res.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');

      // Bot Protection Detection
      const htmlString = doc.documentElement.innerHTML;
      let blockedReason = null;
      if (htmlString.includes('awsWaf') || doc.querySelector('#challenge-container')) {
        blockedReason = 'Amazon AWS WAF';
      } else if (target.includes('myntra.com')) {
         // Myntra-specific logic
      } else if (target.includes('zivame.com')) {
         // Zivame-specific logic
      } else if (htmlString.includes('Are you a human?')) {
        blockedReason = 'Flipkart Anti-Bot';
      } else if (doc.title.includes('Just a moment...') || htmlString.includes('challenges.cloudflare.com')) {
        blockedReason = 'Cloudflare';
      }

      if (blockedReason) {
         setBotBlocked(blockedReason);
         if (shadowRootRef.current) shadowRootRef.current.innerHTML = '';
         return null;
      }

      // 1. Run extraction FIRST while scripts (containing JSON state) still exist
      let rawProducts: any[] = [];
      
      try {
         rawProducts = scraperConfig[platform].scrapeSearch(doc, currentQuery);
      } catch (e) {
         console.error('Extraction failed', e);
      }

      // 2. Sanitize HTML for the visual Shadow DOM (strip scripts so they don't break our app)
      doc.querySelectorAll('script').forEach(s => s.remove());
      doc.querySelectorAll('noscript').forEach(s => s.remove()); // Remove noscript which triggers bot warnings visually
      const allElements = doc.querySelectorAll('*');
      allElements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.toLowerCase().startsWith('on')) {
            el.removeAttribute(attr.name);
          }
        });
      });

      const cleanHtml = doc.documentElement.innerHTML;
      setHtml(cleanHtml);
      
      if (shadowHostRef.current) {
        if (!shadowRootRef.current) {
          shadowRootRef.current = shadowHostRef.current.attachShadow({ mode: 'open' });
        }
        
        const originUrl = new URL(target);
        const htmlWithBase = cleanHtml.replace('<head>', `<head><base href="${originUrl.origin}">`);
        
        if (platform === 'myntra' || platform === 'zivame') {
           // Provide visual fallback for SPAs where JS is stripped
           shadowRootRef.current.innerHTML = `
             <div style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f8f9fa; color: #333; text-align: center; padding: 2rem;">
                <h1 style="font-size: 2rem; margin-bottom: 1rem;">${platform.toUpperCase()} Web App</h1>
                <p style="font-size: 1.2rem; color: #666;">Visual preview is disabled because this is a Single-Page Application (React) and scripts have been safely stripped.</p>
                <p style="font-size: 1.1rem; margin-top: 1rem; color: #10b981; font-weight: bold;">But don't worry, the Scraper Engine in the background is fully extracting the JSON data! 🚀</p>
             </div>
           `;
        } else {
           shadowRootRef.current.innerHTML = htmlWithBase;
        }
        
        shadowRootRef.current.addEventListener('click', handleShadowClick);
      }
      return { doc, rawProducts };
    } finally {
      setLoading(false);
    }
  };

  const runParallelDeepCrawler = async (rawProducts: any[], p: Platform) => {
    const CHUNK_SIZE = 2; // Reduced chunk size to heavily avoid bot detection
    const updatedProducts = [...rawProducts];
    
    for (let i = 0; i < rawProducts.length; i += CHUNK_SIZE) {
      const chunk = rawProducts.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(async (prod, chunkIndex) => {
        try {
          const res = await fetch(`/api/proxy?url=${encodeURIComponent(prod.link)}`);
          if (!res.ok) return;
          const rawDeepHtml = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(rawDeepHtml, 'text/html');
          const deepData = scraperConfig[p].scrapeDeep(doc);
          
          const index = i + chunkIndex;
          updatedProducts[index] = {
            ...updatedProducts[index],
            price: deepData.price || updatedProducts[index].price,
            rating: deepData.rating || updatedProducts[index].rating,
            reviewsCount: deepData.reviewsCount > 0 ? deepData.reviewsCount : updatedProducts[index].reviewsCount,
            image: deepData.image || updatedProducts[index].image,
            tags: deepData.tags.length > 0 ? deepData.tags : updatedProducts[index].tags
          };
        } catch (e) {
          console.error("Deep scrape failed for", prod.link);
        }
      });
      
      await Promise.all(promises);
      
      // Update UI incrementally with AI analysis
      setProducts(runAIAnalysis([...updatedProducts]));
      setDeepCrawlingProgress(Math.round(((i + chunk.length) / rawProducts.length) * 100));
      
      // Add a slight delay between chunks to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    setDeepCrawlingProgress(100);
    setTimeout(() => setDeepCrawlingProgress(0), 3000); // Hide progress bar after completion
  };

  const handleSearch = async (e?: React.FormEvent, directUrl?: string) => {
    if (e) e.preventDefault();
    
    let target = directUrl;
    let currentQuery = query;
    
    if (!target) {
       if (!query) return;
       if (query.startsWith('http')) {
          target = query;
          currentQuery = 'Search'; // Fallback
       } else {
          target = scraperConfig[platform].buildUrl(query);
       }
    }
    
    setProducts([]);
    setDeepCrawlingProgress(0);
    setHtml(null);
    
    try {
      const result = await fetchAndRenderProxy(target!, currentQuery);
      if (result) {
        const { rawProducts } = result;
        
        // Show initial skeleton products immediately
        setProducts(runAIAnalysis([...rawProducts]));
        
        // Fire off background parallel deep crawler
        if (rawProducts.length > 0) {
          runParallelDeepCrawler(rawProducts, platform);
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error fetching data: ${err.message}`);
    }
  };
  
  const handleShadowClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (anchor && anchor.getAttribute('href')) {
      e.preventDefault();
      
      let href = anchor.getAttribute('href')!;
      if (href.startsWith('/')) {
        const currentUrlObj = new URL(currentScrapeUrl.startsWith('http') ? currentScrapeUrl : scraperConfig[platform].buildUrl(query));
        href = `${currentUrlObj.origin}${href}`;
      }
      
      if (href.startsWith('http')) {
        setCurrentScrapeUrl(href);
        const event = new CustomEvent('scrape-url', { detail: { url: href } });
        window.dispatchEvent(event);
      }
    }
  };

  useEffect(() => {
    const handleCustomScrape = (e: any) => {
      handleSearch(undefined, e.detail.url);
    };
    
    window.addEventListener('scrape-url', handleCustomScrape);
    
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      handlePlatformChange('amazon');
    }
    
    return () => {
      window.removeEventListener('scrape-url', handleCustomScrape);
      if (shadowRootRef.current) {
         shadowRootRef.current.removeEventListener('click', handleShadowClick);
      }
    };
  }, []);

  const currentBrandName = query || 'Brand';

  return (
    <main className="min-h-screen bg-[#050505] text-white p-8 selection:bg-purple-500/30">
      
      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#111] border border-white/10 rounded-3xl shadow-2xl flex overflow-hidden">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-white/50" />
            </button>
            <div className="w-1/2 bg-white flex items-center justify-center p-8">
               <img src={selectedProduct.image} className="w-full max-h-[60vh] object-contain drop-shadow-xl" />
            </div>
            <div className="w-1/2 p-8 flex flex-col gap-6 overflow-y-auto">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-purple-400 uppercase tracking-widest">{selectedProduct.category}</span>
                <h2 className="text-2xl font-semibold leading-tight text-white/90">{selectedProduct.title}</h2>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-green-400">{selectedProduct.price}</span>
                  {selectedProduct.rating !== 'N/A' && (
                    <div className="flex items-center gap-1 bg-yellow-500/10 px-3 py-1 rounded-full">
                      <span className="text-sm font-bold text-yellow-500">{selectedProduct.rating}</span>
                      <span className="text-xs text-yellow-500/70">({selectedProduct.reviewsCount} reviews)</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="h-px w-full bg-white/5" />
              
              {selectedProduct.description && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Product Details</h3>
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{selectedProduct.description}</p>
                </div>
              )}
              
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest">AI Insights & Forecasting</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-xs text-white/40 block mb-1">Demand Forecast</span>
                    <span className={`text-lg font-bold ${selectedProduct.demandStatus === 'High Demand' ? 'text-blue-400' : selectedProduct.demandStatus === 'Low Demand' ? 'text-red-400' : 'text-white'}`}>{selectedProduct.demandStatus}</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-xs text-white/40 block mb-1">Repurchase Value</span>
                    <span className={`text-lg font-bold ${selectedProduct.repurchaseValue === 'High' ? 'text-green-400' : selectedProduct.repurchaseValue === 'Low' ? 'text-red-400' : 'text-yellow-400'}`}>{selectedProduct.repurchaseValue}</span>
                  </div>
                  <div className="col-span-2 bg-purple-500/10 p-4 rounded-2xl border border-purple-500/20">
                    <span className="text-xs text-purple-300/60 block mb-1">Review Deficit (to 4.8★ target)</span>
                    <span className="text-xl font-bold text-purple-400">{selectedProduct.reviewDeficit === 0 ? 'Target Reached!' : `${selectedProduct.reviewDeficit} new 5-Star Reviews Needed`}</span>
                  </div>
                </div>
              </div>

              <a href={selectedProduct.link} target="_blank" rel="noopener noreferrer" className="mt-auto block text-center w-full py-4 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-xl font-medium">
                View on Marketplace
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] px-4 mx-auto flex flex-col gap-8 h-[calc(100vh-4rem)]">
        
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-end">
            <h1 className="text-4xl font-light tracking-tight">
              Scrape<span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">X</span>
            </h1>

            <div className="flex gap-4 items-center">
              {products.length > 0 && deepCrawlingProgress === 100 && (
                <div className="flex gap-2">
                  <button onClick={() => exportToExcel(products, currentBrandName)} className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors rounded-xl font-medium text-sm border border-green-500/30">
                    <FileSpreadsheet className="w-4 h-4" /> Export Excel
                  </button>
                  <button onClick={() => exportToPDF(products, currentBrandName)} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors rounded-xl font-medium text-sm border border-red-500/30">
                    <FileText className="w-4 h-4" /> Export PDF
                  </button>
                </div>
              )}
              <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
                {platforms.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePlatformChange(p.id as Platform)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      platform === p.id 
                        ? 'bg-purple-500 text-white shadow-lg' 
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {botBlocked && (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
               <p className="text-red-400 text-sm font-medium flex-1">
                 <strong className="text-red-300">Bot Detection Triggered ({botBlocked}):</strong> The marketplace has temporarily blocked this IP address from scraping. Wait a few minutes before trying again, or use a Residential Proxy.
               </p>
            </div>
          )}

          <form onSubmit={handleSearch} className="relative flex items-center w-full max-w-4xl">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Enter ${platforms.find(p => p.id === platform)?.name} Brand Name or Search Query...`}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-32 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all shadow-[0_0_40px_-10px_rgba(168,85,247,0.2)]"
            />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Searching...' : 'Deep Scrape'}
            </button>
          </form>
        </div>

        <div className="flex gap-6 h-full min-h-0">
          
          <div className="w-[420px] flex flex-col bg-white/[0.03] shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/10 rounded-3xl overflow-hidden backdrop-blur-2xl">
            <div className="p-4 border-b border-white/10 flex flex-col gap-3 bg-white/5">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-white/70 uppercase tracking-widest">AI Analytics Dashboard</h2>
                <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-1 rounded-md">{products.length} Analyzed</span>
              </div>
              {deepCrawlingProgress > 0 && deepCrawlingProgress < 100 && (
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex justify-between items-center text-[10px] text-purple-400 font-mono">
                    <span>Deep Crawling Details...</span>
                    <span>{deepCrawlingProgress}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${deepCrawlingProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              {products.length === 0 && !loading && (
                <div className="h-full flex items-center justify-center text-white/30 text-sm text-center px-8">
                  Enter a brand name to start parallel deep scraping instantly.
                </div>
              )}

              {products.map((p, i) => (
                <button onClick={() => setSelectedProduct(p)} key={i} className="group text-left flex flex-col gap-3 p-4 rounded-2xl hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 shrink-0 bg-white/5 rounded-xl overflow-hidden flex items-center justify-center p-2 relative">
                      {p.image ? (
                        <img src={p.image} alt="Product" className="object-contain w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center min-w-0 flex-1">
                      <h3 className="text-sm font-medium truncate text-white/90 group-hover:text-purple-400 transition-colors">{p.title}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-lg font-bold text-green-400">{p.price === 'Fetching...' ? <span className="text-sm animate-pulse text-white/30">Fetching...</span> : p.price}</span>
                        <div className="flex flex-col items-end">
                          {p.rating !== 'N/A' && p.rating !== 'Fetching...' && (
                            <span className="text-xs text-yellow-500 font-bold">{p.rating}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {p.price !== 'Fetching...' && (
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white/40 uppercase font-semibold">Demand</span>
                        <span className={`text-xs font-medium ${p.demandStatus === 'High Demand' ? 'text-blue-400' : p.demandStatus === 'Low Demand' ? 'text-red-400' : 'text-white/70'}`}>
                          {p.demandStatus}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white/40 uppercase font-semibold">Repurchase Value</span>
                        <span className={`text-xs font-medium ${p.repurchaseValue === 'High' ? 'text-green-400' : p.repurchaseValue === 'Low' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {p.repurchaseValue}
                        </span>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
             <div className="h-12 border-b border-white/10 bg-[#111] flex items-center px-4 gap-4 z-10 relative">
                <div className="flex-1 flex justify-center">
                  <div className="bg-black/50 border border-white/5 px-4 py-1.5 text-xs text-white/40 rounded-full w-[80%] max-w-md text-center truncate font-mono">
                    {currentScrapeUrl || 'about:blank'}
                  </div>
                </div>
             </div>
             <div className="flex-1 bg-[#ffffff] overflow-y-auto relative custom-scrollbar">
                {!html && !loading && (
                  <div className="absolute inset-0 bg-white/5" />
                )}
                {loading && !html && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <span className="text-purple-600 font-medium animate-pulse">Loading Platform...</span>
                  </div>
                )}
                {/* [transform:translate(0)] creates a containing block to prevent position:fixed elements from escaping */}
                <div ref={shadowHostRef} className="w-full min-h-full bg-white text-black [transform:translate(0)]" />
             </div>
          </div>

        </div>
      </div>
    </main>
  );
}
