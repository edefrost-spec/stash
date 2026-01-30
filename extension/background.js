// Background service worker
// Handles context menus and saving

importScripts('config.js', 'supabase.js');

let supabase = null;

// Initialize on startup
chrome.runtime.onInstalled.addListener(() => {
  initSupabase();
  setupContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  initSupabase();
});

async function initSupabase() {
  supabase = new SupabaseClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  await supabase.init();
}

// Trigger auto-tagging via edge function (fire-and-forget)
async function triggerAutoTag(saveId, userId) {
  try {
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/functions/v1/auto-tag`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          save_id: saveId,
          user_id: userId,
        }),
      }
    );
    if (!response.ok) {
      console.warn('Auto-tag failed:', await response.text());
    }
  } catch (err) {
    console.warn('Auto-tag error:', err);
  }
}

// Context menu for "Save highlight to Stash"
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Save highlight to Stash',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: 'save-page',
      title: 'Save page to Stash',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'save-image',
      title: 'Save image to Stash',
      contexts: ['image'],
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!supabase) await initSupabase();

  if (info.menuItemId === 'save-highlight') {
    await saveHighlight(tab, info.selectionText);
  } else if (info.menuItemId === 'save-page') {
    await savePage(tab);
  } else if (info.menuItemId === 'save-image') {
    await saveImage(tab, info.srcUrl, info.pageUrl);
  }
});

// Save highlighted text
async function saveHighlight(tab, selectionText) {
  try {
    const result = await supabase.insert('saves', {
      user_id: CONFIG.USER_ID,
      url: tab.url,
      title: tab.title,
      highlight: selectionText,
      site_name: new URL(tab.url).hostname.replace('www.', ''),
      source: 'extension',
    });

    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Highlight saved!',
    });

    // Trigger auto-tagging in background
    if (result && result[0]?.id) {
      triggerAutoTag(result[0].id, CONFIG.USER_ID);
    }
  } catch (err) {
    console.error('Save highlight failed:', err);
    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Failed to save: ' + err.message,
      isError: true,
    });
  }
}

// Save full page
async function savePage(tab) {
  try {
    console.log('savePage called for:', tab.url);
    let article;

    // Extract from current page - inject content script first if needed
    console.log('Extracting article...');

    try {
      article = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    } catch (e) {
      // Content script not loaded, inject it first
      console.log('Content script not loaded, injecting...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['Readability.js', 'content.js']
      });
      // Wait a moment for script to initialize
      await new Promise(r => setTimeout(r, 100));
      article = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    }

    console.log('Article extracted:', article?.title, 'content length:', article?.content?.length);

    if (!article) {
      throw new Error('Failed to extract article content');
    }

    console.log('Inserting into Supabase...');
    const result = await supabase.insert('saves', {
      user_id: CONFIG.USER_ID,
      url: tab.url,
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      site_name: article.siteName,
      author: article.author,
      published_at: article.publishedTime,
      image_url: article.imageUrl,
      source: 'extension',
    });
    console.log('Insert result:', result);

    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Page saved!',
    });

    // Trigger auto-tagging in background
    if (result && result[0]?.id) {
      triggerAutoTag(result[0].id, CONFIG.USER_ID);
    }
  } catch (err) {
    console.error('Save page failed:', err);
    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Failed to save: ' + err.message,
      isError: true,
    });
  }
}

function sanitizeFilename(name) {
  if (!name) return 'image';
  const cleaned = name.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || 'image';
}

function extensionFromType(contentType) {
  if (!contentType) return '';
  const type = contentType.split(';')[0].trim().toLowerCase();
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
  };
  return map[type] ? `.${map[type]}` : '';
}

function buildFilenameFromUrl(srcUrl, contentType) {
  let name = 'image';

  try {
    const url = new URL(srcUrl);
    const lastSegment = url.pathname.split('/').filter(Boolean).pop();
    if (lastSegment) {
      name = decodeURIComponent(lastSegment);
    }
  } catch (err) {
    // data: or invalid URL; keep default
  }

  name = sanitizeFilename(name);

  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    const ext = extensionFromType(contentType);
    if (ext) name += ext;
  }

  return name;
}

function encodeStoragePath(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function fetchImageBlob(srcUrl) {
  const response = await fetch(srcUrl, { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status})`);
  }
  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
  return { blob, contentType };
}

async function uploadImageToStorage(path, blob, contentType) {
  const uploadUrl = `${CONFIG.SUPABASE_URL}/storage/v1/object/uploads/${encodeStoragePath(path)}`;
  const authToken = supabase?.accessToken || CONFIG.SUPABASE_ANON_KEY;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: blob,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Upload failed');
  }
}

async function generateImageEmbedding(saveId, userId, imageUrl) {
  try {
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/functions/v1/generate-image-embedding`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          save_id: saveId,
          user_id: userId,
          image_url: imageUrl,
        }),
      }
    );

    if (!response.ok) {
      console.warn('Image embedding failed:', await response.text());
    }
  } catch (err) {
    console.warn('Image embedding error:', err);
  }
}

async function saveImage(tab, srcUrl, pageUrl) {
  try {
    if (!srcUrl) throw new Error('No image URL found');
    if (!supabase) await initSupabase();

    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Saving image...',
    });

    const { blob, contentType } = await fetchImageBlob(srcUrl);
    const filename = buildFilenameFromUrl(srcUrl, contentType);
    const path = `${CONFIG.USER_ID}/${Date.now()}-${filename}`;

    await uploadImageToStorage(path, blob, contentType);

    const imageUrl = `${CONFIG.SUPABASE_URL}/storage/v1/object/public/uploads/${encodeStoragePath(path)}`;
    let siteName = 'Image';
    const sourcePage = pageUrl || tab?.url;
    if (sourcePage) {
      try {
        siteName = new URL(sourcePage).hostname.replace('www.', '');
      } catch (err) {
        siteName = 'Image';
      }
    }

    const result = await supabase.insert('saves', {
      user_id: CONFIG.USER_ID,
      url: imageUrl,
      title: filename,
      image_url: imageUrl,
      site_name: siteName,
      source: 'upload',
      content: null,
    });

    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Image saved!',
    });

    if (result && result[0]?.id) {
      triggerAutoTag(result[0].id, CONFIG.USER_ID);
      generateImageEmbedding(result[0].id, CONFIG.USER_ID, imageUrl);
    }
  } catch (err) {
    console.error('Save image failed:', err);
    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Failed to save image: ' + err.message,
      isError: true,
    });
  }
}

// Save full page with folder, tags, notes, product data, and book data (from popup)
async function savePageWithOptions(tab, folderId = null, tagIds = [], notes = null, productData = null, bookData = null) {
  if (!supabase) await initSupabase();

  try {
    console.log('savePageWithOptions called for:', tab.url);
    let article;

    // Extract from current page
    try {
      article = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    } catch (e) {
      // Content script not loaded, inject it first
      console.log('Content script not loaded, injecting...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['Readability.js', 'content.js']
      });
      await new Promise(r => setTimeout(r, 100));
      article = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
    }

    if (!article) {
      throw new Error('Failed to extract article content');
    }

    // Insert the save with folder, notes, and product data
    const saveData = {
      user_id: CONFIG.USER_ID,
      url: tab.url,
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      site_name: article.siteName,
      author: article.author,
      published_at: article.publishedTime,
      image_url: article.imageUrl,
      source: 'extension',
      folder_id: folderId,
      notes: notes,
    };

    // Add product fields if this is a product save
    if (productData && productData.isProduct) {
      saveData.is_product = true;
      saveData.product_price = productData.price;
      saveData.product_currency = productData.currency || 'USD';
      saveData.product_availability = productData.availability;
      // Use cleaned product description as excerpt if available
      if (article.productDescription) {
        saveData.excerpt = article.productDescription;
      }
    }

    // Add book fields if this is a book save (from popup toggle or auto-detected)
    if (bookData && bookData.isBook) {
      saveData.is_book = true;
      saveData.book_page_count = bookData.pageCount;
      // Use author from bookData if provided
      if (bookData.author) {
        saveData.author = bookData.author;
      }
      // Use book description for excerpt if available
      if (article.bookDescription) {
        saveData.excerpt = article.bookDescription;
      }
    } else if (article.isBook) {
      // Fallback to auto-detected book data from article
      saveData.is_book = true;
      saveData.book_page_count = article.bookPageCount;
      // Use book description for excerpt if available
      if (article.bookDescription) {
        saveData.excerpt = article.bookDescription;
      }
    }

    const result = await supabase.insert('saves', saveData);

    // Handle tags
    if (tagIds && tagIds.length > 0 && result && result[0]) {
      const saveId = result[0].id;

      for (const tagId of tagIds) {
        if (tagId.startsWith('new:')) {
          // Create new tag first
          const tagName = tagId.substring(4);
          const tagResult = await supabase.insert('tags', {
            user_id: CONFIG.USER_ID,
            name: tagName,
          });
          if (tagResult && tagResult[0]) {
            await supabase.insert('save_tags', {
              save_id: saveId,
              tag_id: tagResult[0].id,
            });
          }
        } else {
          await supabase.insert('save_tags', {
            save_id: saveId,
            tag_id: tagId,
          });
        }
      }
    }

    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Page saved!',
    });

    // Trigger auto-tagging in background (will add AI-suggested tags alongside manual ones)
    if (result && result[0]?.id) {
      triggerAutoTag(result[0].id, CONFIG.USER_ID);
    }
  } catch (err) {
    console.error('Save page failed:', err);
    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      message: 'Failed to save: ' + err.message,
      isError: true,
    });
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'savePage') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        const productData = request.isProduct ? {
          isProduct: request.isProduct,
          price: request.productPrice,
          currency: request.productCurrency,
          availability: request.productAvailability,
        } : null;

        const bookData = request.isBook ? {
          isBook: request.isBook,
          author: request.bookAuthor,
          pageCount: request.bookPageCount,
        } : null;

        await savePageWithOptions(tabs[0], request.folderId, request.tagIds, request.notes, productData, bookData);
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (request.action === 'getFolders') {
    (async () => {
      if (!supabase) await initSupabase();
      try {
        const folders = await supabase.select('folders', { order: 'name.asc' });
        sendResponse({ success: true, folders });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'getTags') {
    (async () => {
      if (!supabase) await initSupabase();
      try {
        const tags = await supabase.select('tags', { order: 'name.asc' });
        sendResponse({ success: true, tags });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'getUser') {
    (async () => {
      if (!supabase) await initSupabase();
      const user = await supabase.getUser();
      sendResponse({ user });
    })();
    return true;
  }

  if (request.action === 'signIn') {
    (async () => {
      if (!supabase) await initSupabase();
      try {
        await supabase.signIn(request.email, request.password);
        const user = await supabase.getUser();
        sendResponse({ success: true, user });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (request.action === 'signOut') {
    (async () => {
      if (!supabase) await initSupabase();
      await supabase.signOut();
      sendResponse({ success: true });
    })();
    return true;
  }

  if (request.action === 'getRecentSaves') {
    (async () => {
      if (!supabase) await initSupabase();
      try {
        const saves = await supabase.select('saves', {
          order: 'created_at.desc',
          limit: 10,
        });
        sendResponse({ success: true, saves });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
