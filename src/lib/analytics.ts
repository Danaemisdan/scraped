export interface ProductData {
  title: string;
  price: string;
  image: string;
  link: string;
  rating: string;
  reviewsCount: number;
  ordersCount: number;
  tags: string[];
  category: string;
}

export interface AnalyzedProduct extends ProductData {
  priceValue: number;
  ratingValue: number;
  reviewDeficit: number;
  demandStatus: 'High Demand' | 'Low Demand' | 'Average';
  repurchaseValue: 'High' | 'Medium' | 'Low';
}

/**
 * Parses numeric price from a string (e.g. "$19.99" -> 19.99, "₹1,200" -> 1200)
 */
export function parsePrice(priceStr: string): number {
  if (!priceStr || priceStr === 'N/A') return 0;
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

/**
 * Parses numeric rating from string (e.g. "4.5 out of 5" -> 4.5)
 */
export function parseRating(ratingStr: string): number {
  if (!ratingStr || ratingStr === 'N/A') return 0;
  const num = parseFloat(ratingStr.match(/([0-9.]+)/)?.[1] || '0');
  return isNaN(num) ? 0 : num;
}

/**
 * Calculates exactly how many consecutive 5-star reviews are needed 
 * to bring the current average rating up to a target (default 4.8)
 */
export function calculateReviewDeficit(currentRating: number, currentReviews: number, target: number = 4.8): number {
  if (currentRating >= target || currentReviews === 0) return 0;
  
  // Formula: (target * current_reviews - current_rating * current_reviews) / (5.0 - target)
  const deficit = (target * currentReviews - currentRating * currentReviews) / (5.0 - target);
  return Math.ceil(Math.max(0, deficit));
}

/**
 * Simulates AI Repurchase Value Rating based on algorithmic heuristics
 * (Ratio of reviews to orders, rating, and tags)
 */
export function calculateRepurchaseValue(rating: number, tags: string[], reviews: number, orders: number): 'High' | 'Medium' | 'Low' {
  let score = 0;
  
  // Rating contribution
  if (rating >= 4.5) score += 3;
  else if (rating >= 4.0) score += 2;
  else if (rating > 0) score += 1;

  // Tags contribution (e.g., Best Seller, Choice, etc.)
  const positiveTags = ['best seller', 'choice', 'prime', 'free shipping', 'top rated', 'f-assured'];
  const hasPositiveTag = tags.some(t => positiveTags.some(pt => t.toLowerCase().includes(pt)));
  if (hasPositiveTag) score += 2;

  // Engagement contribution (reviews relative to orders, or just high reviews if orders missing)
  if (orders > 0) {
    const ratio = reviews / orders;
    if (ratio > 0.1) score += 2; // High engagement
    else if (ratio > 0.02) score += 1;
  } else {
    if (reviews > 1000) score += 2;
    else if (reviews > 100) score += 1;
  }

  if (score >= 5) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

/**
 * Main AI Analysis Engine function. 
 * Processes raw scraped data and outputs the enriched AI dataset.
 */
export function runAIAnalysis(products: ProductData[]): AnalyzedProduct[] {
  if (!products.length) return [];

  // Calculate category averages for Demand Forecasting
  const validOrders = products.map(p => p.ordersCount).filter(o => o > 0);
  const validReviews = products.map(p => p.reviewsCount).filter(r => r > 0);
  
  const avgOrders = validOrders.length ? validOrders.reduce((a, b) => a + b, 0) / validOrders.length : 0;
  const avgReviews = validReviews.length ? validReviews.reduce((a, b) => a + b, 0) / validReviews.length : 0;

  return products.map(product => {
    const ratingValue = parseRating(product.rating);
    const priceValue = parsePrice(product.price);
    const reviewDeficit = calculateReviewDeficit(ratingValue, product.reviewsCount);
    
    // Demand Forecasting
    let demandStatus: 'High Demand' | 'Low Demand' | 'Average' = 'Average';
    if (product.ordersCount > 0 && avgOrders > 0) {
      if (product.ordersCount > avgOrders * 1.5) demandStatus = 'High Demand';
      else if (product.ordersCount < avgOrders * 0.5) demandStatus = 'Low Demand';
    } else {
      // Fallback to reviews if orders are missing
      if (product.reviewsCount > avgReviews * 1.5) demandStatus = 'High Demand';
      else if (product.reviewsCount < avgReviews * 0.5) demandStatus = 'Low Demand';
    }

    const repurchaseValue = calculateRepurchaseValue(ratingValue, product.tags, product.reviewsCount, product.ordersCount);

    return {
      ...product,
      ratingValue,
      priceValue,
      reviewDeficit,
      demandStatus,
      repurchaseValue
    };
  });
}
