// Popup script
document.addEventListener('DOMContentLoaded', async () => {
  const authView = document.getElementById('auth-view');
  const mainView = document.getElementById('main-view');
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');
  const signinBtn = document.getElementById('signin-btn');
  const signupBtn = document.getElementById('signup-btn');
  const signoutBtn = document.getElementById('signout-btn');
  const savePageBtn = document.getElementById('save-page-btn');
  const savesList = document.getElementById('saves-list');
  const openAppLink = document.getElementById('open-app-link');

  // Form elements
  const folderSelect = document.getElementById('folder-select');
  const tagsInput = document.getElementById('tags-input');
  const selectedTagsContainer = document.getElementById('selected-tags');
  const tagsSuggestions = document.getElementById('tags-suggestions');
  const notesInput = document.getElementById('notes-input');

  // Product detection elements
  const productBanner = document.getElementById('product-banner');
  const productPriceDisplay = document.getElementById('product-price-display');
  const saveAsProductCheckbox = document.getElementById('save-as-product');

  // State
  let availableTags = [];
  let selectedTagIds = [];
  let detectedProduct = null;

  // Single-user mode - skip auth, go straight to main view
  showMainView();
  loadRecentSaves();
  loadFoldersAndTags();
  detectProductOnPage();

  function showAuthView() {
    authView.classList.remove('hidden');
    mainView.classList.add('hidden');
  }

  function showMainView() {
    authView.classList.add('hidden');
    mainView.classList.remove('hidden');
  }

  // Sign in
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signinBtn.disabled = true;
    signinBtn.textContent = 'Signing in...';
    authError.textContent = '';

    const response = await chrome.runtime.sendMessage({
      action: 'signIn',
      email,
      password,
    });

    if (response.success) {
      showMainView();
      loadRecentSaves();
    } else {
      authError.textContent = response.error;
    }

    signinBtn.disabled = false;
    signinBtn.textContent = 'Sign In';
  });

  // Sign up
  signupBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
      authError.textContent = 'Please enter email and password';
      return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = 'Signing up...';
    authError.textContent = '';

    // For signup, we'll redirect to the web app
    // Supabase email confirmation is required by default
    const signupUrl = `${CONFIG.WEB_APP_URL}/signup`;
    chrome.tabs.create({ url: signupUrl });

    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  });

  // Sign out
  signoutBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'signOut' });
    showAuthView();
  });

  // Load folders and tags
  async function loadFoldersAndTags() {
    const [foldersRes, tagsRes] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'getFolders' }),
      chrome.runtime.sendMessage({ action: 'getTags' }),
    ]);

    if (foldersRes.success && foldersRes.folders) {
      folderSelect.innerHTML = '<option value="">No folder</option>' +
        foldersRes.folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
    }

    if (tagsRes.success && tagsRes.tags) {
      availableTags = tagsRes.tags;
    }
  }

  // Tags input handling
  tagsInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      tagsSuggestions.classList.add('hidden');
      return;
    }

    const matches = availableTags.filter(t =>
      t.name.toLowerCase().includes(query) && !selectedTagIds.includes(t.id)
    );

    if (matches.length) {
      tagsSuggestions.innerHTML = matches.slice(0, 5).map(t =>
        `<div class="tag-suggestion" data-id="${t.id}" data-name="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>`
      ).join('');
    } else {
      tagsSuggestions.innerHTML = `<div class="tag-suggestion new" data-name="${escapeHtml(e.target.value)}">Create "${escapeHtml(e.target.value)}"</div>`;
    }
    tagsSuggestions.classList.remove('hidden');
  });

  tagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstSuggestion = tagsSuggestions.querySelector('.tag-suggestion');
      if (firstSuggestion) {
        firstSuggestion.click();
      }
    }
  });

  tagsSuggestions.addEventListener('click', (e) => {
    const suggestion = e.target.closest('.tag-suggestion');
    if (!suggestion) return;

    const tagId = suggestion.dataset.id;
    const tagName = suggestion.dataset.name;

    if (tagId) {
      selectedTagIds.push(tagId);
      addTagChip(tagId, tagName);
    } else {
      // Create new tag - prefix with 'new:' for backend to handle
      const tempId = 'new:' + tagName;
      selectedTagIds.push(tempId);
      addTagChip(tempId, tagName);
    }

    tagsInput.value = '';
    tagsSuggestions.classList.add('hidden');
  });

  function addTagChip(id, name) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.dataset.id = id;
    chip.innerHTML = `${escapeHtml(name)} <button class="tag-chip-remove">&times;</button>`;

    chip.querySelector('.tag-chip-remove').addEventListener('click', () => {
      selectedTagIds = selectedTagIds.filter(t => t !== id);
      chip.remove();
    });

    selectedTagsContainer.appendChild(chip);
  }

  function resetForm() {
    selectedTagIds = [];
    selectedTagsContainer.innerHTML = '';
    folderSelect.value = '';
    notesInput.value = '';
    tagsInput.value = '';
  }

  // Detect product on current page
  async function detectProductOnPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      // Try to get product data from content script
      let article;
      try {
        article = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
      } catch (e) {
        // Content script not loaded, inject it first
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['Readability.js', 'content.js']
        });
        await new Promise(r => setTimeout(r, 100));
        article = await chrome.tabs.sendMessage(tab.id, { action: 'extractArticle' });
      }

      if (article && article.isProduct) {
        detectedProduct = {
          isProduct: true,
          price: article.productPrice,
          currency: article.productCurrency || 'USD',
          availability: article.productAvailability,
        };

        // Show product banner
        productBanner.classList.remove('hidden');

        // Display price
        if (detectedProduct.price) {
          const currencySymbol = detectedProduct.currency === 'USD' ? '$' : detectedProduct.currency + ' ';
          productPriceDisplay.textContent = currencySymbol + detectedProduct.price;
        } else {
          productPriceDisplay.textContent = '';
        }
      }
    } catch (err) {
      console.log('Product detection failed:', err);
    }
  }

  // Save page
  savePageBtn.addEventListener('click', async () => {
    const folderId = folderSelect.value || null;
    const notes = notesInput.value.trim() || null;

    // Check if saving as product
    const saveAsProduct = detectedProduct && saveAsProductCheckbox.checked;

    savePageBtn.disabled = true;
    savePageBtn.innerHTML = `
      <svg class="spinning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
      Saving...
    `;

    await chrome.runtime.sendMessage({
      action: 'savePage',
      folderId,
      tagIds: selectedTagIds,
      notes,
      // Product data
      isProduct: saveAsProduct,
      productPrice: saveAsProduct ? detectedProduct.price : null,
      productCurrency: saveAsProduct ? detectedProduct.currency : null,
      productAvailability: saveAsProduct ? detectedProduct.availability : null,
    });

    // Reset form
    resetForm();

    savePageBtn.disabled = false;
    savePageBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Saved!
    `;

    setTimeout(() => {
      savePageBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Save This Page
      `;
      loadRecentSaves();
    }, 1500);
  });

  // Load recent saves
  async function loadRecentSaves() {
    const response = await chrome.runtime.sendMessage({ action: 'getRecentSaves' });

    if (!response.success || !response.saves?.length) {
      savesList.innerHTML = '<p class="empty">No saves yet. Save your first page!</p>';
      return;
    }

    savesList.innerHTML = response.saves.map(save => {
      const isHighlight = !!save.highlight;
      const title = save.title || save.highlight?.substring(0, 50) || 'Untitled';
      const date = new Date(save.created_at).toLocaleDateString();

      return `
        <div class="save-item" data-url="${save.url}">
          <div class="icon ${isHighlight ? 'highlight' : ''}">
            ${isHighlight ? '✨' : '📄'}
          </div>
          <div class="content">
            <div class="title">${escapeHtml(title)}</div>
            <div class="meta">${save.site_name || ''} · ${date}</div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    savesList.querySelectorAll('.save-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });
  }

  // Open web app
  openAppLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: CONFIG.WEB_APP_URL });
  });

  // Helper
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

});

// Add spinning animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spinning {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);
