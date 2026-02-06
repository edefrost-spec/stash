// Content script - runs on every page
// Handles article extraction and highlight detection

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractArticle') {
    // Handle async extraction
    extractArticle().then(article => {
      sendResponse(article);
    }).catch(err => {
      console.error('Extract error:', err);
      sendResponse(null);
    });
    return true; // Keep channel open for async response
  } else if (request.action === 'getSelection') {
    const selection = window.getSelection().toString().trim();
    sendResponse({ selection });
    return false; // Synchronous response, don't keep channel open
  }
});

async function extractArticle() {
  try {
    // Clone the document for Readability (it modifies the DOM)
    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone, {
      charThreshold: 100,
      classesToPreserve: ['article', 'content', 'post'],
    });
    const article = reader.parse();

    if (article && article.textContent && article.textContent.length > 200) {
      const productData = extractProductData();
      const bookData = extractBookData();
      return {
        success: true,
        title: article.title || document.title,
        content: htmlToText(article.content),
        excerpt: bookData.isBook && bookData.description
          ? bookData.description
          : (article.excerpt || article.textContent?.substring(0, 300) + '...'),
        siteName: article.siteName || extractSiteName(),
        author: bookData.author || article.byline,
        publishedTime: extractPublishedTime(),
        imageUrl: extractMainImage(),
        // Product data
        isProduct: productData.isProduct,
        productPrice: productData.price,
        productCurrency: productData.currency,
        productAvailability: productData.availability,
        productDescription: productData.description,
        // Book data
        isBook: bookData.isBook,
        bookPageCount: bookData.pageCount,
        bookDescription: bookData.description,
      };
    }
  } catch (e) {
    console.error('Readability failed:', e);
  }

  // Fallback: try to find article content more intelligently
  const content = extractFallbackContent();
  const productData = extractProductData();
  const bookData = extractBookData();

  return {
    success: true,
    title: document.title,
    content: cleanContent(content),
    excerpt: bookData.isBook && bookData.description
      ? bookData.description
      : (document.querySelector('meta[name="description"]')?.content ||
         content.substring(0, 300) + '...'),
    siteName: extractSiteName(),
    author: bookData.author || extractAuthor(),
    publishedTime: extractPublishedTime(),
    imageUrl: extractMainImage(),
    // Product data
    isProduct: productData.isProduct,
    productPrice: productData.price,
    productCurrency: productData.currency,
    productAvailability: productData.availability,
    // Book data
    isBook: bookData.isBook,
    bookPageCount: bookData.pageCount,
    bookDescription: bookData.description,
  };
}

function extractFallbackContent() {
  // Try specific article selectors first
  const selectors = [
    'article',
    '[role="article"]',
    '.article-body',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.story-body',
    'main article',
    'main .content',
    '.c-entry-content', // Vox/Verge
    '.article__body',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = extractTextFromElement(el);
      if (text.length > 500) {
        return text;
      }
    }
  }

  // Fallback: get all paragraphs from main content area
  const mainContent = document.querySelector('main') || document.querySelector('article') || document.body;
  const paragraphs = [];

  mainContent.querySelectorAll('p').forEach(p => {
    const text = p.innerText?.trim();
    // Filter out short paragraphs (likely nav/footer) and common junk
    if (text && text.length > 50 && !isBoilerplate(text)) {
      paragraphs.push(text);
    }
  });

  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n');
  }

  // Last resort: body text, but limited
  return document.body.innerText.substring(0, 50000);
}

function extractTextFromElement(el) {
  const paragraphs = [];
  el.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').forEach(child => {
    const text = child.innerText?.trim();
    if (text && text.length > 20 && !isBoilerplate(text)) {
      paragraphs.push(text);
    }
  });
  return paragraphs.join('\n\n');
}

function isBoilerplate(text) {
  const lower = text.toLowerCase();
  const boilerplatePatterns = [
    'subscribe',
    'sign up for',
    'newsletter',
    'follow us',
    'share this',
    'related articles',
    'recommended',
    'advertisement',
    'sponsored',
    'cookie',
    'privacy policy',
    'terms of service',
    'all rights reserved',
    'featured video',
    'watch now',
    'read more',
    'see also',
  ];
  return boilerplatePatterns.some(pattern => lower.includes(pattern));
}

function cleanContent(text) {
  if (!text) return '';

  return text
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    // Remove common UI text patterns
    .replace(/^(Share|Tweet|Email|Print|Save)[\s\n]+/gim, '')
    .replace(/\n(Share|Tweet|Email|Print|Save)\n/gi, '\n')
    // Clean up
    .trim();
}

// Convert HTML to plain text while preserving structure
function htmlToText(html) {
  if (!html) return '';

  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Process the DOM to preserve formatting
  function processNode(node) {
    let result = '';

    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();

        // Block elements that need line breaks
        if (['p', 'div', 'article', 'section', 'header', 'footer', 'main'].includes(tag)) {
          result += '\n\n' + processNode(child) + '\n\n';
        }
        // Headings
        else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
          result += '\n\n' + processNode(child) + '\n\n';
        }
        // Line breaks
        else if (tag === 'br') {
          result += '\n';
        }
        // List items
        else if (tag === 'li') {
          result += '\n• ' + processNode(child);
        }
        // Lists
        else if (['ul', 'ol'].includes(tag)) {
          result += '\n' + processNode(child) + '\n';
        }
        // Blockquotes
        else if (tag === 'blockquote') {
          const text = processNode(child).trim().split('\n').map(line => '> ' + line).join('\n');
          result += '\n\n' + text + '\n\n';
        }
        // Links - convert to markdown
        else if (tag === 'a') {
          const href = child.getAttribute('href');
          const text = processNode(child).trim();
          if (href && text && !href.startsWith('#') && !href.startsWith('javascript:')) {
            // Make relative URLs absolute
            const absoluteUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
            result += `[${text}](${absoluteUrl})`;
          } else {
            result += text;
          }
        }
        // Bold
        else if (['strong', 'b'].includes(tag)) {
          result += '**' + processNode(child) + '**';
        }
        // Italic
        else if (['em', 'i'].includes(tag)) {
          result += '*' + processNode(child) + '*';
        }
        // Code
        else if (tag === 'code') {
          result += '`' + processNode(child) + '`';
        }
        // Pre/code blocks
        else if (tag === 'pre') {
          result += '\n\n```\n' + processNode(child) + '\n```\n\n';
        }
        // Skip script, style, etc.
        else if (['script', 'style', 'noscript', 'iframe'].includes(tag)) {
          // Skip
        }
        // Other inline elements
        else {
          result += processNode(child);
        }
      }
    }

    return result;
  }

  let text = processNode(temp);

  // Clean up excessive whitespace while preserving intentional line breaks
  text = text
    .replace(/[ \t]+/g, ' ')           // Collapse horizontal whitespace
    .replace(/\n[ \t]+/g, '\n')        // Remove leading spaces on lines
    .replace(/[ \t]+\n/g, '\n')        // Remove trailing spaces on lines
    .replace(/\n{3,}/g, '\n\n')        // Max 2 consecutive newlines
    .trim();

  return text;
}

function extractAuthor() {
  return document.querySelector('meta[name="author"]')?.content ||
         document.querySelector('meta[property="article:author"]')?.content ||
         document.querySelector('[rel="author"]')?.innerText?.trim() ||
         document.querySelector('.author, .byline, .author-name')?.innerText?.trim() ||
         null;
}

function extractSiteName() {
  return document.querySelector('meta[property="og:site_name"]')?.content ||
         document.querySelector('meta[name="application-name"]')?.content ||
         window.location.hostname.replace('www.', '');
}

function extractPublishedTime() {
  const timeEl = document.querySelector('time[datetime]');
  if (timeEl) return timeEl.getAttribute('datetime');

  const metaTime = document.querySelector('meta[property="article:published_time"]')?.content;
  if (metaTime) return metaTime;

  return null;
}

function extractMainImage() {
  return document.querySelector('meta[property="og:image"]')?.content ||
         document.querySelector('meta[name="twitter:image"]')?.content ||
         null;
}

// Clean product description by removing common noise
function cleanProductDescription(text) {
  if (!text) return '';

  // Remove common noise patterns
  const noisePatterns = [
    /size\s*(chart|guide)/gi,
    /specifications?:/gi,
    /dimensions?:/gi,
    /material:/gi,
    /care\s*instructions?/gi,
    /shipping\s*(info|information|details|&\s*returns?)/gi,
    /returns?\s*(policy|info)/gi,
    /delivery\s*(info|details)/gi,
    /\bsku\b\s*[:#]?\s*\S+/gi,
    /\bitem\s*#?\s*\S+/gi,
    /\bupc\b\s*[:#]?\s*\S+/gi,
    /\basin\b\s*[:#]?\s*\S+/gi,
    /model\s*(number|#|no\.?)\s*[:#]?\s*\S+/gi,
    /sold\s*(&|and)\s*shipped\s*by/gi,
    /free\s*shipping/gi,
    /add\s*to\s*(cart|bag|basket)/gi,
    /buy\s*now/gi,
    /in\s*stock/gi,
    /out\s*of\s*stock/gi,
    /usually\s*ships/gi,
  ];

  let cleaned = text;
  noisePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();

  // Truncate to first meaningful content (before specs start)
  const paragraphs = cleaned.split(/\n\n+/);
  if (paragraphs.length > 2) {
    cleaned = paragraphs.slice(0, 2).join(' ');
  }

  // Limit to reasonable length
  if (cleaned.length > 500) {
    cleaned = cleaned.slice(0, 500).replace(/\s+\S*$/, '') + '...';
  }

  return cleaned.trim();
}

// Extract clean product description
function extractProductDescription() {
  // Try structured data first
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent);
      if (data['@graph']) {
        data = data['@graph'].find(item =>
          item['@type'] === 'Product' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Product'))
        );
      }
      if (data?.description) {
        return cleanProductDescription(data.description);
      }
    } catch (e) {}
  }

  // Try meta description
  const metaDesc = document.querySelector('meta[property="og:description"]')?.content ||
                   document.querySelector('meta[name="description"]')?.content;
  if (metaDesc && metaDesc.length > 50) {
    return cleanProductDescription(metaDesc);
  }

  // Try common product description selectors
  const descSelectors = [
    '[itemprop="description"]',
    '.product-description',
    '#product-description',
    '.product-summary',
    '.product-details-description',
    '#feature-bullets', // Amazon
    '.a-expander-content', // Amazon
  ];

  for (const selector of descSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent?.trim();
      if (text && text.length > 50) {
        return cleanProductDescription(text);
      }
    }
  }

  return null;
}

// Extract product data from schema.org markup and meta tags
function extractProductData() {
  const product = {
    isProduct: false,
    price: null,
    currency: 'USD',
    availability: null,
    description: null
  };

  // Check JSON-LD schema (highest priority)
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent);

      // Handle @graph arrays
      if (data['@graph']) {
        data = data['@graph'].find(item =>
          item['@type'] === 'Product' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Product'))
        );
        if (!data) continue;
      }

      const type = data['@type'];
      if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
        product.isProduct = true;

        if (data.offers) {
          const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
          product.price = offer.price || offer.lowPrice || offer.highPrice;
          product.currency = offer.priceCurrency || 'USD';
          product.availability = offer.availability?.replace('https://schema.org/', '')?.replace('http://schema.org/', '');
        }
        break;
      }
    } catch (e) {
      // JSON parse error, skip this script
    }
  }

  // Check Open Graph product meta tags (fallback)
  if (!product.isProduct) {
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType?.content === 'product' || ogType?.content === 'og:product') {
      product.isProduct = true;
    }

    const priceAmount = document.querySelector('meta[property="product:price:amount"]') ||
                        document.querySelector('meta[property="og:price:amount"]');
    const priceCurrency = document.querySelector('meta[property="product:price:currency"]') ||
                          document.querySelector('meta[property="og:price:currency"]');

    if (priceAmount) {
      product.isProduct = true;
      product.price = priceAmount.content;
      product.currency = priceCurrency?.content || 'USD';
    }
  }

  // Check common ecommerce domains for confidence boost
  const hostname = window.location.hostname.toLowerCase();
  const ecommerceDomains = ['amazon.', 'ebay.', 'etsy.', 'shopify.', 'walmart.', 'target.', 'bestbuy.'];
  if (ecommerceDomains.some(domain => hostname.includes(domain))) {
    // If on ecommerce domain, try harder to find price
    if (!product.price) {
      // Look for common price selectors
      const priceSelectors = [
        '[data-price]',
        '.price',
        '.product-price',
        '.a-price .a-offscreen', // Amazon
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.x-price-primary',
        '[itemprop="price"]'
      ];

      for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const priceText = el.getAttribute('data-price') || el.textContent;
          const match = priceText?.match(/[\d,.]+/);
          if (match) {
            product.price = match[0].replace(',', '');
            product.isProduct = true;
            break;
          }
        }
      }
    }
  }

  // Extract clean product description if this is a product
  if (product.isProduct) {
    product.description = extractProductDescription();
  }

  return product;
}

// Clean author text by removing common noise patterns from book sites
function cleanAuthorText(text) {
  if (!text) return '';

  let cleaned = text.trim();

  // Take only the first line (author name is usually first)
  cleaned = cleaned.split('\n')[0].trim();

  // Remove follower counts (e.g., "15.3k followers", "1,234 followers")
  cleaned = cleaned.replace(/[\d,.]+k?\s*followers?/gi, '');

  // Remove book counts (e.g., "87 books", "12 books")
  cleaned = cleaned.replace(/[\d,.]+\s*books?/gi, '');

  // Remove rating counts
  cleaned = cleaned.replace(/[\d,.]+\s*ratings?/gi, '');

  // Remove "Follow" button text
  cleaned = cleaned.replace(/\bFollow\b/gi, '');

  // Remove parenthetical content like "(Goodreads Author)"
  cleaned = cleaned.replace(/\([^)]*\)/g, '');

  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// Extract book description - separate from product description
function extractBookDescription() {
  // Try JSON-LD first
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent);
      if (data['@graph']) {
        data = data['@graph'].find(item =>
          item['@type'] === 'Book' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Book'))
        );
      }
      if (data?.description) {
        return data.description;
      }
    } catch (e) {}
  }

  // Try Goodreads-specific selectors
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('goodreads.com')) {
    // Goodreads description selectors - try multiple options
    const descSelectors = [
      '.BookPageMetadataSection__description .Formatted',
      '[data-testid="description"] .Formatted',
      '.DetailsLayoutRightParagraph__widthConstrained .Formatted',
      '#description span[style*="display"]',
      '.readable.stacked span[style*="display: none"]', // Hidden full description
      '.readable.stacked span:not([style])', // Visible description
      '[data-testid="description"]',
      '#description'
    ];

    for (const selector of descSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        let text = el.textContent?.trim();
        // Clean up the description
        if (text && text.length > 50) {
          // Remove "...more" or "...less" buttons
          text = text.replace(/\.\.\.more$/i, '').replace(/\.\.\.less$/i, '').trim();
          return text;
        }
      }
    }
  }

  // Try meta description
  const metaDesc = document.querySelector('meta[property="og:description"]')?.content ||
                   document.querySelector('meta[name="description"]')?.content;
  if (metaDesc && metaDesc.length > 50) {
    return metaDesc;
  }

  // Generic book description selectors
  const descSelectors = [
    '[itemprop="description"]',
    '.book-description',
    '#book-description',
    '.synopsis',
    '.summary'
  ];

  for (const selector of descSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent?.trim();
      if (text && text.length > 50) {
        return text;
      }
    }
  }

  return null;
}

// Extract book data from schema.org markup, meta tags, and URL patterns
function extractBookData() {
  const book = {
    isBook: false,
    author: null,
    pageCount: null,
    description: null
  };

  // Strategy 1: Check JSON-LD Schema.org Book markup (highest priority)
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent);

      // Handle @graph arrays
      if (data['@graph']) {
        data = data['@graph'].find(item =>
          item['@type'] === 'Book' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Book'))
        );
        if (!data) continue;
      }

      const type = data['@type'];
      if (type === 'Book' || (Array.isArray(type) && type.includes('Book'))) {
        book.isBook = true;

        // Extract author (can be string or object)
        if (data.author) {
          if (typeof data.author === 'string') {
            book.author = data.author;
          } else if (Array.isArray(data.author)) {
            book.author = data.author.map(a => a.name || a).join(', ');
          } else {
            book.author = data.author.name || data.author;
          }
        }

        // Extract page count
        book.pageCount = data.numberOfPages;

        break;
      }
    } catch (e) {
      // JSON parse error, skip this script
    }
  }

  // Strategy 2: URL pattern matching for book sites
  const url = window.location.href;
  const hostname = window.location.hostname.toLowerCase();

  const bookPatterns = [
    { regex: /amazon\.com\/.*\/dp\/([A-Z0-9]{10})/i, site: 'amazon' },
    { regex: /goodreads\.com\/book\/show/i, site: 'goodreads' },
    { regex: /google\.com\/books/i, site: 'google-books' },
    { regex: /barnesandnoble\.com\/w\//i, site: 'bn' },
    { regex: /bookshop\.org\/books/i, site: 'bookshop' }
  ];

  for (const pattern of bookPatterns) {
    if (pattern.regex.test(url)) {
      book.isBook = true;

      // Try to extract author if not already found
      if (!book.author) {
        // Goodreads-specific: Try meta tag FIRST (cleanest source)
        if (pattern.site === 'goodreads') {
          // Check for Twitter/OG meta with author info
          const twitterCreator = document.querySelector('meta[name="twitter:creator"]')?.content;
          if (twitterCreator && !twitterCreator.startsWith('@')) {
            book.author = twitterCreator;
          }

          // Try the specific author name span INSIDE the contributor link
          if (!book.author) {
            const nameSpan = document.querySelector('.ContributorLink__name');
            if (nameSpan) {
              book.author = nameSpan.textContent.trim();
            }
          }

          // Try contributor link but ONLY get the name data attribute or aria-label
          if (!book.author) {
            const contributorLink = document.querySelector('a.ContributorLink[href*="/author/"]');
            if (contributorLink) {
              // Try aria-label first (usually cleanest)
              const ariaLabel = contributorLink.getAttribute('aria-label');
              if (ariaLabel) {
                book.author = ariaLabel.replace(/^by\s+/i, '').trim();
              } else {
                // Get innerText but only from name span child
                const nameChild = contributorLink.querySelector('[class*="name"], span:first-child');
                if (nameChild) {
                  book.author = nameChild.textContent.trim();
                }
              }
            }
          }

          // Last resort: try to parse from title which often has "by Author"
          if (!book.author) {
            const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
            if (ogTitle) {
              const byMatch = ogTitle.match(/\s+by\s+(.+)$/i);
              if (byMatch) {
                book.author = byMatch[1].trim();
              }
            }
          }
        }

        // Generic selectors for other book sites
        if (!book.author) {
          const authorSelectors = [
            '[data-author]',
            '.author',
            '.book-author',
            '[itemprop="author"]'
          ];

          for (const selector of authorSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
              let authorText = cleanAuthorText(el.textContent);
              if (authorText.length > 0 && authorText.length < 100) {
                book.author = authorText;
                break;
              }
            }
          }
        }
      }

      // Try to extract page count for Goodreads
      if (!book.pageCount && pattern.site === 'goodreads') {
        const pageCountSelectors = [
          '[itemprop="numberOfPages"]',
          '[data-testid="pagesFormat"]',
          'p[data-testid="pagesFormat"]'
        ];
        for (const selector of pageCountSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent) {
            const match = el.textContent.match(/(\d+)\s*pages?/i);
            if (match) {
              book.pageCount = parseInt(match[1], 10);
              break;
            }
          }
        }
      }

      break;
    }
  }

  // Strategy 3: Check Open Graph book meta tags (fallback)
  if (!book.isBook) {
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType?.content === 'book' || ogType?.content === 'books.book') {
      book.isBook = true;

      const authorMeta = document.querySelector('meta[property="books:author"]') ||
                         document.querySelector('meta[name="author"]');
      if (authorMeta) {
        book.author = authorMeta.content;
      }
    }
  }

  // Extract book description
  if (book.isBook) {
    book.description = extractBookDescription();
  }

  return book;
}

// Show save confirmation toast
function showToast(message, isError = false) {
  const existing = document.getElementById('stash-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'stash-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${isError ? '#ef4444' : '#10b981'};
    color: white;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: stashSlideIn 0.3s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes stashSlideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'stashSlideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Listen for save confirmations
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showToast') {
    showToast(request.message, request.isError);
  }
});
