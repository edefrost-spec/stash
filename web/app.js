// Stash Web App (Single-user mode - no auth required)
class StashApp {
  constructor() {
    this.supabase = null;
    this.user = { id: CONFIG.USER_ID }; // Hardcoded single user
    this.currentView = 'all';
    this.currentSave = null;
    this.saves = [];
    this.tags = [];
    this.folders = [];
    this.pendingKindleImport = null; // Stores parsed highlights before import
    this.pendingImageFile = null; // Stores image file before upload

    // Filter state for folders/tags
    this.currentFolderId = null;
    this.currentTagId = null;

    // Card display preferences
    this.showAnnotations = false;
    this.isMoodBoard = false;
    this.colorFilter = 'all';

    // Card metadata maps
    this.saveTagMap = {};
    this.saveColorMap = {};
    this.imageColorCache = this.loadImageColorCache();
    this.colorDataInFlight = false;

    this.colorBuckets = [
      { key: 'all', label: 'All', swatch: '#111827' },
      { key: 'red', label: 'Red', swatch: '#ef4444' },
      { key: 'orange', label: 'Orange', swatch: '#f97316' },
      { key: 'yellow', label: 'Yellow', swatch: '#facc15' },
      { key: 'green', label: 'Green', swatch: '#22c55e' },
      { key: 'teal', label: 'Teal', swatch: '#14b8a6' },
      { key: 'blue', label: 'Blue', swatch: '#3b82f6' },
      { key: 'purple', label: 'Purple', swatch: '#8b5cf6' },
      { key: 'pink', label: 'Pink', swatch: '#ec4899' },
      { key: 'neutral', label: 'Neutral', swatch: '#9ca3af' },
    ];

    // Audio player state
    this.audio = null;
    this.isPlaying = false;

    // Notes auto-save timeout
    this.notesTimeout = null;

    // Masonry layout instance
    this.masonry = null;

    // Rediscovery saves cache
    this.rediscoverySaves = [];

    this.init();
  }

  async init() {
    // Initialize Supabase
    this.supabase = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    );

    // Load theme preference
    this.loadTheme();
    this.loadCardPreferences();
    this.applyFeatureFlags();
    this.hideQuickAddModal();

    // Skip auth - go straight to main screen
    this.showMainScreen();
    this.loadData();

    this.bindEvents();
  }

  // Theme Management
  loadTheme() {
    const savedTheme = localStorage.getItem('stash-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeToggle(savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('stash-theme', newTheme);
    this.updateThemeToggle(newTheme);
  }

  updateThemeToggle(theme) {
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const label = document.querySelector('.theme-label');

    if (theme === 'dark') {
      sunIcon?.classList.add('hidden');
      moonIcon?.classList.remove('hidden');
      if (label) label.textContent = 'Light Mode';
    } else {
      sunIcon?.classList.remove('hidden');
      moonIcon?.classList.add('hidden');
      if (label) label.textContent = 'Dark Mode';
    }
  }

  applyFeatureFlags() {
    const enabled = !!(CONFIG?.FEATURES?.VISION_V2);
    document.body.classList.toggle('vision-v2', enabled);
    document.querySelectorAll('[data-feature="vision-v2"]').forEach(el => {
      if (!enabled) {
        el.classList.add('hidden');
        return;
      }
      // Keep modals hidden until explicitly opened.
      if (el.classList.contains('modal')) return;
      el.classList.remove('hidden');
    });
  }

  loadCardPreferences() {
    this.showAnnotations = localStorage.getItem('stash-show-annotations') === 'true';
    this.isMoodBoard = localStorage.getItem('stash-mood-board') === 'true';
    this.colorFilter = localStorage.getItem('stash-color-filter') || 'all';
    document.body.classList.toggle('show-annotations', this.showAnnotations);
    this.updateAnnotationsToggleUI();
    this.updateMoodBoardToggleUI();
    this.updateColorFilterVisibility();
  }

  updateAnnotationsToggleUI() {
    const btn = document.getElementById('toggle-annotations-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', this.showAnnotations ? 'true' : 'false');
    btn.textContent = this.showAnnotations ? 'Hide notes + tags' : 'Show notes + tags';
  }

  updateMoodBoardToggleUI() {
    const btn = document.getElementById('toggle-moodboard-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', this.isMoodBoard ? 'true' : 'false');
    btn.textContent = this.isMoodBoard ? 'Standard view' : 'Mood board';
  }

  updateColorFilterVisibility() {
    const filter = document.getElementById('color-filter');
    if (!filter) return;
    const viewAllows = !['weekly', 'stats', 'kindle'].includes(this.currentView);
    if (this.isMoodBoard && viewAllows) {
      filter.classList.remove('hidden');
    } else {
      filter.classList.add('hidden');
    }
  }

  toggleAnnotations() {
    this.showAnnotations = !this.showAnnotations;
    localStorage.setItem('stash-show-annotations', this.showAnnotations);
    document.body.classList.toggle('show-annotations', this.showAnnotations);
    this.updateAnnotationsToggleUI();
  }

  toggleMoodBoard() {
    this.isMoodBoard = !this.isMoodBoard;
    localStorage.setItem('stash-mood-board', this.isMoodBoard);
    this.updateMoodBoardToggleUI();
    this.updateColorFilterVisibility();
    if (!this.isMoodBoard) {
      this.colorFilter = 'all';
      localStorage.setItem('stash-color-filter', this.colorFilter);
    }
    const viewAllows = !['weekly', 'stats', 'kindle'].includes(this.currentView);
    if (viewAllows) {
      this.renderSaves();
      if (this.isMoodBoard) {
        this.prepareColorData();
      }
    }
  }

  setColorFilter(key) {
    if (!key || key === this.colorFilter) return;
    this.colorFilter = key;
    localStorage.setItem('stash-color-filter', this.colorFilter);
    this.renderColorFilters();
    const viewAllows = !['weekly', 'stats', 'kindle'].includes(this.currentView);
    if (viewAllows) {
      this.renderSaves();
    }
  }

  renderColorFilters() {
    const container = document.getElementById('color-swatches');
    if (!container) return;
    if (!this.isMoodBoard) {
      container.innerHTML = '';
      return;
    }

    const counts = this.getColorCounts();
    const items = this.colorBuckets.filter(bucket => bucket.key === 'all' || (counts[bucket.key] || 0) > 0);

    container.innerHTML = items.map(bucket => {
      if (bucket.key === 'all') {
        return `
          <button type="button" class="color-pill${this.colorFilter === 'all' ? ' active' : ''}" data-color-key="all">
            All (${this.saves.length})
          </button>
        `;
      }

      const count = counts[bucket.key] || 0;
      return `
        <button type="button" class="color-swatch${this.colorFilter === bucket.key ? ' active' : ''}"
          data-color-key="${bucket.key}"
          style="--swatch: ${bucket.swatch}"
          title="${bucket.label} (${count})">
        </button>
      `;
    }).join('');
  }

  getColorCounts() {
    const counts = {};
    this.saves.forEach(save => {
      const bucket = this.getSaveColorBucket(save);
      if (!bucket) return;
      counts[bucket] = (counts[bucket] || 0) + 1;
    });
    return counts;
  }

  getSaveColorBucket(save) {
    if (!save) return null;
    const entry = this.saveColorMap[save.id];
    if (entry?.bucket) return entry.bucket;
    if (!save.image_url) return 'neutral';
    return null;
  }

  loadImageColorCache() {
    try {
      return JSON.parse(localStorage.getItem('stash-image-colors') || '{}');
    } catch (e) {
      return {};
    }
  }

  saveImageColorCache() {
    localStorage.setItem('stash-image-colors', JSON.stringify(this.imageColorCache));
  }

  bindEvents() {
    // Auth form
    document.getElementById('auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.signIn();
    });

    document.getElementById('signup-btn').addEventListener('click', () => {
      this.signUp();
    });

    document.getElementById('signout-btn').addEventListener('click', () => {
      this.signOut();
    });

    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.setView(view);
      });
    });

    // Search
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.search(e.target.value);
      }, 300);
    });

    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.loadSaves();
    });

    // Card display toggles
    document.getElementById('toggle-annotations-btn').addEventListener('click', () => {
      this.toggleAnnotations();
    });

    document.getElementById('toggle-moodboard-btn').addEventListener('click', () => {
      this.toggleMoodBoard();
    });

    const colorSwatches = document.getElementById('color-swatches');
    if (colorSwatches) {
      colorSwatches.addEventListener('click', (e) => {
        const target = e.target.closest('[data-color-key]');
        if (!target) return;
        this.setColorFilter(target.dataset.colorKey);
      });
    }

    // Reading pane
    document.getElementById('close-reading-btn').addEventListener('click', () => {
      this.closeReadingPane();
    });

    document.getElementById('archive-btn').addEventListener('click', () => {
      this.toggleArchive();
    });

    document.getElementById('favorite-btn').addEventListener('click', () => {
      this.toggleFavorite();
    });

    document.getElementById('delete-btn').addEventListener('click', () => {
      this.deleteSave();
    });

    document.getElementById('add-tag-btn').addEventListener('click', () => {
      this.addTagToSave();
    });

    // Folder selection in reading pane
    document.getElementById('reading-folder-select').addEventListener('change', (e) => {
      this.updateSaveFolder(e.target.value || null);
    });

    // Notes auto-save
    document.getElementById('reading-notes-textarea').addEventListener('input', (e) => {
      this.debouncedSaveNotes(e.target.value);
    });

    // Mobile menu
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('open');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });

    // Close sidebar when nav item clicked on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
          overlay.classList.remove('open');
        }
      });
    });

    // Add folder
    document.getElementById('add-folder-btn').addEventListener('click', () => {
      this.addFolder();
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Reading progress bar
    const readingContent = document.getElementById('reading-content');
    if (readingContent) {
      readingContent.addEventListener('scroll', () => {
        this.updateReadingProgress();
      });
    }

    // Audio player controls
    document.getElementById('audio-play-btn').addEventListener('click', () => {
      this.toggleAudioPlayback();
    });

    document.getElementById('audio-speed').addEventListener('change', (e) => {
      if (this.audio) {
        this.audio.playbackRate = parseFloat(e.target.value);
      }
    });

    document.getElementById('audio-progress-bar').addEventListener('click', (e) => {
      if (this.audio && this.audio.duration) {
        const rect = e.target.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.audio.currentTime = percent * this.audio.duration;
      }
    });

    // Kindle Import
    document.getElementById('kindle-import-btn').addEventListener('click', () => {
      this.showKindleImportModal();
    });

    const kindleModal = document.getElementById('kindle-import-modal');
    const kindleDropzone = document.getElementById('kindle-dropzone');
    const kindleFileInput = document.getElementById('kindle-file-input');

    // Modal close handlers
    kindleModal.querySelector('.modal-overlay').addEventListener('click', () => {
      this.hideKindleImportModal();
    });
    kindleModal.querySelector('.modal-close-btn').addEventListener('click', () => {
      this.hideKindleImportModal();
    });
    document.getElementById('kindle-cancel-btn').addEventListener('click', () => {
      this.hideKindleImportModal();
    });
    document.getElementById('kindle-confirm-btn').addEventListener('click', () => {
      this.confirmKindleImport();
    });

    // Dropzone interactions
    kindleDropzone.addEventListener('click', () => {
      kindleFileInput.click();
    });

    kindleFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleKindleFile(e.target.files[0]);
      }
    });

    // Drag and drop
    kindleDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      kindleDropzone.classList.add('dragover');
    });

    kindleDropzone.addEventListener('dragleave', () => {
      kindleDropzone.classList.remove('dragover');
    });

    kindleDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      kindleDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this.handleKindleFile(e.dataTransfer.files[0]);
      }
    });

    // Digest Settings Modal
    const digestModal = document.getElementById('digest-modal');

    document.getElementById('digest-settings-btn').addEventListener('click', () => {
      this.showDigestModal();
    });

    digestModal.querySelector('.modal-overlay').addEventListener('click', () => {
      this.hideDigestModal();
    });
    digestModal.querySelector('.modal-close-btn').addEventListener('click', () => {
      this.hideDigestModal();
    });
    document.getElementById('digest-cancel-btn').addEventListener('click', () => {
      this.hideDigestModal();
    });
    document.getElementById('digest-save-btn').addEventListener('click', () => {
      this.saveDigestPreferences();
    });

    // Toggle enabled/disabled state of options
    document.getElementById('digest-enabled').addEventListener('change', () => {
      this.updateDigestOptionsState();
    });

    // Quick Add (Vision V2)
    const quickAddBtn = document.getElementById('quick-add-btn');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', () => this.showQuickAddModal());
    }

    const quickAddModal = document.getElementById('quick-add-modal');
    if (quickAddModal) {
      quickAddModal.querySelector('.modal-overlay').addEventListener('click', () => {
        this.hideQuickAddModal();
      });
      document.getElementById('quick-add-close-btn')?.addEventListener('click', () => {
        this.hideQuickAddModal();
      });
      document.getElementById('quick-add-cancel-btn')?.addEventListener('click', () => {
        this.hideQuickAddModal();
      });
      document.getElementById('quick-add-save-btn')?.addEventListener('click', () => {
        this.saveQuickAdd();
      });

      quickAddModal.querySelectorAll('.quick-add-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this.switchQuickAddType(tab.dataset.type);
        });
      });

      // Image dropzone handlers
      this.bindImageDropzone();
    }

    // Global drag & drop for images
    this.bindGlobalDragDrop();

    // Global clipboard paste for images
    this.bindClipboardPaste();
  }

  // Image dropzone in Quick Add modal
  bindImageDropzone() {
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('quick-add-file');
    const previewRemove = document.getElementById('image-preview-remove');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('.image-preview-remove')) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleImageFile(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        this.handleImageFile(file);
      }
    });

    previewRemove?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearImagePreview();
    });
  }

  // Global drag & drop overlay
  bindGlobalDragDrop() {
    const overlay = document.getElementById('global-drop-overlay');
    if (!overlay) return;

    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      // Only show for files
      if (!e.dataTransfer.types.includes('Files')) return;
      dragCounter++;
      if (dragCounter === 1) {
        overlay.classList.add('visible');
      }
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        overlay.classList.remove('visible');
      }
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('visible');

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        this.saveImageDirectly(file);
      }
    });
  }

  // Global clipboard paste for screenshots
  bindClipboardPaste() {
    document.addEventListener('paste', (e) => {
      // Don't intercept if user is typing in an input/textarea
      const activeEl = document.activeElement;
      const isTyping = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isTyping && !activeEl.closest('#quick-add-modal')) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // If Quick Add modal is open with file tab, use that
            const modal = document.getElementById('quick-add-modal');
            const fileTabActive = document.querySelector('.quick-add-tab[data-type="file"].active');
            if (modal && !modal.classList.contains('hidden') && fileTabActive) {
              this.handleImageFile(file);
            } else {
              this.saveImageDirectly(file);
            }
          }
          break;
        }
      }
    });
  }

  // Handle image file for preview in Quick Add
  handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      this.setQuickAddStatus('Please select an image file.', 'error');
      return;
    }

    this.pendingImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImg = document.getElementById('image-preview-img');
      const previewContainer = document.getElementById('image-preview');
      const dropzoneContent = document.getElementById('image-dropzone-content');
      const dropzone = document.getElementById('image-dropzone');

      if (previewImg && previewContainer && dropzoneContent && dropzone) {
        previewImg.src = e.target.result;
        previewContainer.classList.remove('hidden');
        dropzoneContent.classList.add('hidden');
        dropzone.classList.add('has-preview');
      }
    };
    reader.readAsDataURL(file);
  }

  clearImagePreview() {
    this.pendingImageFile = null;
    const previewImg = document.getElementById('image-preview-img');
    const previewContainer = document.getElementById('image-preview');
    const dropzoneContent = document.getElementById('image-dropzone-content');
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('quick-add-file');

    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (dropzoneContent) dropzoneContent.classList.remove('hidden');
    if (dropzone) dropzone.classList.remove('has-preview');
    if (fileInput) fileInput.value = '';
  }

  // Save image directly (from global drop or paste)
  async saveImageDirectly(file) {
    if (!file || !file.type.startsWith('image/')) return;

    // Show a quick toast/notification
    this.showToast('Saving image...');

    try {
      const path = `${this.user.id}/${Date.now()}-${file.name || 'pasted-image.png'}`;
      const { error: uploadError } = await this.supabase
        .storage
        .from('uploads')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = this.supabase.storage.from('uploads').getPublicUrl(path);
      const imageUrl = data?.publicUrl || null;

      const payload = {
        user_id: this.user.id,
        title: file.name || 'Image',
        url: imageUrl,
        image_url: imageUrl,
        site_name: 'Image',
        source: 'upload',
        content: null,
      };

      const { data: insertedSave, error } = await this.supabase
        .from('saves')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      this.showToast('Image saved!', 'success');
      this.loadSaves();

      // Trigger auto-tagging in background
      if (insertedSave?.id) {
        this.triggerAutoTag(insertedSave.id);
        // Generate image embedding for similarity search
        this.generateImageEmbedding({
          id: insertedSave.id,
          image_url: imageUrl,
        }).catch(err => console.warn('Embedding generation failed:', err));
      }
    } catch (err) {
      console.error('Error saving image:', err);
      this.showToast('Failed to save image', 'error');
    }
  }

  // Trigger auto-tagging via edge function (fire-and-forget)
  async triggerAutoTag(saveId) {
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
            user_id: this.user.id,
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

  // Find similar images by aesthetic vibe
  async findSimilarImages(save) {
    this.showToast('Finding similar images...');

    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/find-similar-images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            save_id: save.id,
            user_id: this.user.id,
            limit: 12,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // If embedding doesn't exist, generate it first
        if (data.needsEmbedding) {
          this.showToast('Analyzing image aesthetics...');
          await this.generateImageEmbedding(save);
          // Retry the search
          return this.findSimilarImages(save);
        }
        throw new Error(data.error || 'Failed to find similar images');
      }

      if (!data.similar || data.similar.length === 0) {
        this.showToast('No similar images found');
        return;
      }

      this.showSimilarImagesModal(save, data.similar, data.source_description);

    } catch (err) {
      console.error('Find similar error:', err);
      this.showToast('Failed to find similar images', 'error');
    }
  }

  // Generate aesthetic embedding for an image
  async generateImageEmbedding(save) {
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
          save_id: save.id,
          user_id: this.user.id,
          image_url: save.image_url,
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to generate embedding');
    }

    return response.json();
  }

  // Show modal with similar images
  showSimilarImagesModal(sourceSave, similarImages, description) {
    // Remove existing modal
    document.querySelector('.similar-images-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'modal similar-images-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content similar-images-content">
        <div class="modal-header">
          <h2>Similar Vibes</h2>
          <button class="btn icon modal-close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          ${description ? `<p class="similar-vibe-description">${this.escapeHtml(description)}</p>` : ''}
          <div class="similar-images-grid">
            ${similarImages.map(img => `
              <div class="similar-image-card" data-id="${img.id}">
                <img src="${img.image_url}" alt="${this.escapeHtml(img.title || 'Image')}" loading="lazy">
                <div class="similar-image-info">
                  <span class="similar-score">${Math.round(img.similarity * 100)}%</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => modal.classList.add('visible'));

    // Event handlers
    const closeModal = () => {
      modal.classList.remove('visible');
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);

    // Click on similar image to view it
    modal.querySelectorAll('.similar-image-card').forEach(card => {
      card.addEventListener('click', async () => {
        const imageId = card.dataset.id;
        const { data: save } = await this.supabase
          .from('saves')
          .select('*')
          .eq('id', imageId)
          .single();

        if (save) {
          closeModal();
          document.querySelector('.image-lightbox')?.remove();
          this.openImageLightbox(save);
        }
      });
    });

    // Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  // Simple toast notification
  showToast(message, type = '') {
    // Remove existing toast
    document.querySelector('.toast')?.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
  }

  showMainScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
  }

  async signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    const btn = document.getElementById('signin-btn');

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.textContent = '';

    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      errorEl.textContent = error.message;
    }

    btn.disabled = false;
    btn.textContent = 'Sign In';
  }

  async signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    const messageEl = document.getElementById('auth-message');
    const btn = document.getElementById('signup-btn');

    if (!email || !password) {
      errorEl.textContent = 'Please enter email and password';
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account...';
    errorEl.textContent = '';
    messageEl.textContent = '';

    const { error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      errorEl.textContent = error.message;
    } else {
      messageEl.textContent = 'Check your email to confirm your account!';
    }

    btn.disabled = false;
    btn.textContent = 'Create Account';
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }

  async loadData() {
    await Promise.all([
      this.loadSaves(),
      this.loadTags(),
      this.loadFolders(),
    ]);
  }

  async loadSaves() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    loading.classList.remove('hidden');
    container.innerHTML = '';

    const sortValue = document.getElementById('sort-select').value;
    const [column, direction] = sortValue.split('.');

    let query = this.supabase
      .from('saves')
      .select('*')
      .order(column, { ascending: direction === 'asc' });

    // Apply view filters
    if (this.currentView === 'highlights') {
      query = query.not('highlight', 'is', null);
    } else if (this.currentView === 'articles') {
      query = query.is('highlight', null).neq('source', 'upload');
    } else if (this.currentView === 'images') {
      query = query.eq('source', 'upload');
    } else if (this.currentView === 'archived') {
      query = query.eq('is_archived', true);
    } else if (this.currentView === 'weekly') {
      // Weekly review - get this week's saves
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (this.currentView !== 'folder' && this.currentView !== 'tag') {
      query = query.eq('is_archived', false);
    }

    // Apply folder filter
    if (this.currentFolderId) {
      query = query.eq('folder_id', this.currentFolderId);
    }

    // Apply tag filter - need to get save IDs first
    if (this.currentTagId) {
      const { data: taggedSaves } = await this.supabase
        .from('save_tags')
        .select('save_id')
        .eq('tag_id', this.currentTagId);

      const saveIds = taggedSaves?.map(ts => ts.save_id) || [];
      if (saveIds.length === 0) {
        // No saves with this tag
        loading.classList.add('hidden');
        this.saves = [];
        empty.classList.remove('hidden');
        return;
      }
      query = query.in('id', saveIds);
    }

    const { data, error } = await query;

    loading.classList.add('hidden');

    if (error) {
      console.error('Error loading saves:', error);
      return;
    }

    this.saves = data || [];

    await this.loadSaveTagMapForSaves(this.saves);

    if (this.saves.length === 0) {
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      // Use special rendering for weekly view
      if (this.currentView === 'weekly') {
        this.renderWeeklyReview();
      } else {
        this.renderSaves();
      }
    }
  }

  renderSaves() {
    const container = document.getElementById('saves-container');
    if (!container) return;

    const viewAllows = !['weekly', 'stats', 'kindle'].includes(this.currentView);
    const useMoodBoard = this.isMoodBoard && viewAllows;
    const savesToRender = this.filterSavesForDisplay(this.saves, useMoodBoard);

    // Destroy existing masonry instance before re-rendering
    if (this.masonry) {
      this.masonry.destroy();
      this.masonry = null;
    }

    container.classList.toggle('mood-board', useMoodBoard);

    // Add grid-sizer for masonry column width calculation
    const cardsHtml = savesToRender.map(save => this.renderSaveCard(save, { moodBoard: useMoodBoard })).join('');
    container.innerHTML = `<div class="grid-sizer"></div>${cardsHtml}`;

    if (useMoodBoard) {
      this.renderColorFilters();
      this.prepareColorData();
    }

    // Bind click events
    container.querySelectorAll('.save-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const save = this.saves.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });

    // Initialize Masonry layout
    this.initMasonry(container);
  }

  initMasonry(container) {
    // Check if Masonry is available
    if (typeof Masonry === 'undefined') {
      console.warn('Masonry library not loaded');
      return;
    }

    // Initialize Masonry
    this.masonry = new Masonry(container, {
      itemSelector: '.save-card',
      columnWidth: '.grid-sizer',
      percentPosition: true,
      gutter: 16
    });

    // Re-layout after images load for proper positioning
    if (typeof imagesLoaded !== 'undefined') {
      imagesLoaded(container, () => {
        if (this.masonry) {
          this.masonry.layout();
        }
      });
    }
  }

  // Weekly Review special rendering
  renderWeeklyReview() {
    const container = document.getElementById('saves-container');

    // Calculate stats
    const articles = this.saves.filter(s => !s.highlight);
    const highlights = this.saves.filter(s => s.highlight);
    const totalWords = articles.reduce((sum, s) => {
      const words = (s.content || '').split(/\s+/).length;
      return sum + words;
    }, 0);

    // Get unique sites
    const sites = [...new Set(this.saves.map(s => s.site_name).filter(Boolean))];

    container.innerHTML = `
      <div class="weekly-review">
        <div class="weekly-header">
          <h3>Your Week in Review</h3>
          <p class="weekly-dates">${this.getWeekDateRange()}</p>
        </div>

        <div class="weekly-stats">
          <div class="weekly-stat">
            <span class="weekly-stat-value">${this.saves.length}</span>
            <span class="weekly-stat-label">items saved</span>
          </div>
          <div class="weekly-stat">
            <span class="weekly-stat-value">${articles.length}</span>
            <span class="weekly-stat-label">articles</span>
          </div>
          <div class="weekly-stat">
            <span class="weekly-stat-value">${highlights.length}</span>
            <span class="weekly-stat-label">highlights</span>
          </div>
          <div class="weekly-stat">
            <span class="weekly-stat-value">${Math.round(totalWords / 1000)}k</span>
            <span class="weekly-stat-label">words</span>
          </div>
        </div>

        ${sites.length > 0 ? `
          <div class="weekly-section">
            <h4>Sources</h4>
            <div class="weekly-sources">
              ${sites.slice(0, 10).map(site => `<span class="weekly-source">${this.escapeHtml(site)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="weekly-section" id="rediscovery-section">
          <h4>Rediscover</h4>
          <p class="weekly-rediscovery-hint">Loading a random gem from your archive...</p>
        </div>

        <div class="weekly-section">
          <h4>This Week's Saves</h4>
        </div>

        <div class="saves-grid">
          ${this.saves.map(save => this.renderSaveCard(save)).join('')}
        </div>
      </div>
    `;

    // Bind click events
    container.querySelectorAll('.save-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const save = this.saves.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });

    // Load rediscovery after DOM is ready
    this.loadRediscovery();
  }

  async loadRediscovery() {
    const section = document.getElementById('rediscovery-section');
    if (!section) {
      console.log('Rediscovery section not found');
      return;
    }

    try {
      const { data, error } = await this.supabase
        .from('saves')
        .select('*')
        .eq('user_id', this.user.id)
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      if (error) {
        console.error('Rediscovery query error:', error);
        section.innerHTML = `
          <div class="rediscovery-header">
            <h4>Rediscover</h4>
          </div>
          <p class="weekly-rediscovery-hint">Could not load archived saves.</p>
        `;
        return;
      }

      if (data && data.length > 0) {
        const save = data[Math.floor(Math.random() * data.length)];
        this.rediscoverySaves = data; // Store for shuffle
        this.updateRediscovery(save);
      } else {
        section.innerHTML = `
          <div class="rediscovery-header">
            <h4>Rediscover</h4>
          </div>
          <p class="weekly-rediscovery-hint">Keep saving! Your gems will appear here after 30 days.</p>
        `;
      }
    } catch (err) {
      console.error('Rediscovery error:', err);
      section.innerHTML = `
        <div class="rediscovery-header">
          <h4>Rediscover</h4>
        </div>
        <p class="weekly-rediscovery-hint">Something went wrong loading your archive.</p>
      `;
    }
  }

  shuffleRediscovery() {
    if (!this.rediscoverySaves || this.rediscoverySaves.length === 0) return;
    const save = this.rediscoverySaves[Math.floor(Math.random() * this.rediscoverySaves.length)];
    this.updateRediscovery(save);
  }

  updateRediscovery(save) {
    const section = document.getElementById('rediscovery-section');
    if (!section || !save) return;

    const date = new Date(save.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const saveType = this.getSaveType(save);
    const hasImage = save.image_url && saveType !== 'note';

    section.innerHTML = `
      <div class="rediscovery-header">
        <h4>Rediscover</h4>
        <button class="rediscovery-shuffle" title="Show another">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
          </svg>
        </button>
      </div>
      <div class="rediscovery-card ${hasImage ? 'has-image' : ''}" data-id="${save.id}">
        ${hasImage ? `<img class="rediscovery-image" src="${save.image_url}" alt="" onerror="this.style.display='none'">` : ''}
        <div class="rediscovery-content">
          <div class="rediscovery-meta">
            <span class="rediscovery-type">${saveType.charAt(0).toUpperCase() + saveType.slice(1)}</span>
            <span class="rediscovery-date">Saved ${date}</span>
          </div>
          <div class="rediscovery-title">${this.escapeHtml(save.title || 'Untitled')}</div>
          ${save.highlight ? `<div class="rediscovery-highlight">"${this.escapeHtml(this.truncateText(save.highlight, 150))}"</div>` : ''}
          ${save.excerpt && !save.highlight ? `<div class="rediscovery-excerpt">${this.escapeHtml(this.truncateText(save.excerpt, 120))}</div>` : ''}
          <div class="rediscovery-source">${this.escapeHtml(save.site_name || '')}</div>
        </div>
      </div>
    `;

    section.querySelector('.rediscovery-card')?.addEventListener('click', () => {
      this.openReadingPane(save);
    });

    section.querySelector('.rediscovery-shuffle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.shuffleRediscovery();
    });
  }

  /**
   * Determine the save type for card rendering
   * @param {Object} save - The save object
   * @returns {'highlight'|'image'|'note'|'link'|'article'} - The save type
   */
  getSaveType(save) {
    if (save.highlight) return 'highlight';
    if (save.source === 'upload' && save.image_url) return 'image';
    if (save.site_name === 'Note' || (!save.url && (save.notes || save.content))) return 'note';
    if (save.url && !save.content && !save.excerpt) return 'link';
    return 'article';
  }

  renderSaveCard(save, options = {}) {
    const { moodBoard = false } = options;
    const saveType = this.getSaveType(save);
    const date = new Date(save.created_at).toLocaleDateString();
    const annotations = this.renderCardAnnotations(save, { compact: moodBoard || saveType === 'image' });
    const colorEntry = this.saveColorMap[save.id];
    const dominantStyle = colorEntry?.color ? `style="--dominant: ${colorEntry.color}"` : '';

    // Mood board mode - visual-focused layout
    if (moodBoard) {
      const meta = `${this.escapeHtml(save.site_name || '')}${save.site_name ? ' · ' : ''}${date}`;
      if (saveType === 'highlight') {
        return `
          <div class="save-card mood-card highlight" data-id="${save.id}" ${dominantStyle}>
            <div class="mood-media">
              <div class="mood-placeholder"></div>
              <div class="mood-overlay">
                <div class="mood-title">${this.escapeHtml(save.title || 'Untitled')}</div>
                <div class="save-card-highlight">"${this.escapeHtml(save.highlight)}"</div>
                <div class="mood-meta">${meta}</div>
                ${annotations}
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="save-card mood-card${saveType === 'image' ? ' image-save' : ''}" data-id="${save.id}" ${dominantStyle}>
          <div class="mood-media">
            ${save.image_url ? `<img src="${save.image_url}" alt="" onerror="this.style.display='none'">` : '<div class="mood-placeholder"></div>'}
            <div class="mood-overlay">
              <div class="mood-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="mood-meta">${meta}</div>
              ${annotations}
            </div>
          </div>
        </div>
      `;
    }

    // Type-specific card templates
    switch (saveType) {
      case 'highlight':
        return `
          <div class="save-card highlight" data-id="${save.id}">
            <div class="save-card-content">
              <div class="save-card-site">${this.escapeHtml(save.site_name || '')}</div>
              <div class="save-card-highlight">"${this.escapeHtml(save.highlight)}"</div>
              <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="save-card-meta">
                <span class="save-card-date">${date}</span>
              </div>
              ${annotations}
            </div>
          </div>
        `;

      case 'image':
        // Image card - just the image, annotations on hover
        return `
          <div class="save-card image-save" data-id="${save.id}">
            <img class="save-card-image" src="${save.image_url}" alt="">
            <div class="save-card-content">
              ${annotations}
            </div>
          </div>
        `;

      case 'note':
        // Note card - text-focused, no image
        const noteContent = save.notes || save.content || '';
        return `
          <div class="save-card note-save" data-id="${save.id}">
            <div class="save-card-content">
              <div class="save-card-site">Note</div>
              <div class="save-card-title">${this.escapeHtml(save.title || 'Quick Note')}</div>
              <div class="save-card-note-content">${this.escapeHtml(noteContent)}</div>
              <div class="save-card-meta">
                <span class="save-card-date">${date}</span>
              </div>
              ${annotations}
            </div>
          </div>
        `;

      case 'link':
        // Link card - minimal with favicon
        const domain = save.url ? new URL(save.url).hostname.replace('www.', '') : '';
        const faviconUrl = save.url ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';
        return `
          <div class="save-card link-save" data-id="${save.id}">
            <div class="save-card-content">
              <div class="link-header">
                ${faviconUrl ? `<img class="link-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">` : ''}
                <span class="link-domain">${this.escapeHtml(domain)}</span>
              </div>
              <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="save-card-url">${this.escapeHtml(save.url || '')}</div>
              <div class="save-card-meta">
                <span class="save-card-date">${date}</span>
              </div>
              ${annotations}
            </div>
          </div>
        `;

      case 'article':
      default:
        // Article card - standard with image, title, excerpt
        return `
          <div class="save-card article-save" data-id="${save.id}">
            ${save.image_url ? `<img class="save-card-image" src="${save.image_url}" alt="" onerror="this.style.display='none'">` : ''}
            <div class="save-card-content">
              <div class="save-card-site">${this.escapeHtml(save.site_name || '')}</div>
              <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="save-card-excerpt">${this.escapeHtml(save.excerpt || '')}</div>
              <div class="save-card-meta">
                <span class="save-card-date">${date}</span>
              </div>
              ${annotations}
            </div>
          </div>
        `;
    }
  }

  renderCardAnnotations(save, options = {}) {
    const { compact = false } = options;
    const tags = this.saveTagMap[save.id] || [];
    const notes = (save.notes || '').trim();
    const noteLimit = compact ? 80 : 160;
    const noteText = notes ? this.escapeHtml(this.truncateText(notes, noteLimit)) : '';

    const tagsMarkup = tags.length
      ? tags.map(tag => {
          const color = tag.color || '#94a3b8';
          return `
            <span class="save-card-tag" style="background: ${color}20; border-color: ${color}">
              ${this.escapeHtml(tag.name)}
            </span>
          `;
        }).join('')
      : `<span class="save-card-tag empty">No tags</span>`;

    const notesMarkup = notes
      ? `<div class="save-card-notes"><strong>Notes</strong>${noteText}</div>`
      : '';

    return `
      <div class="save-card-annotations">
        <div class="save-card-tags-inline">${tagsMarkup}</div>
        ${notesMarkup}
      </div>
    `;
  }

  filterSavesForDisplay(saves, useMoodBoard) {
    if (!useMoodBoard || this.colorFilter === 'all') {
      return saves;
    }

    return saves.filter(save => this.getSaveColorBucket(save) === this.colorFilter);
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}…`;
  }

  getWeekDateRange() {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const options = { month: 'short', day: 'numeric' };
    return `${weekAgo.toLocaleDateString('en-US', options)} - ${now.toLocaleDateString('en-US', options)}`;
  }

  async loadSaveTagMapForSaves(saves) {
    const saveIds = saves.map(save => save.id);
    if (saveIds.length === 0) {
      this.saveTagMap = {};
      return;
    }

    const { data } = await this.supabase
      .from('save_tags')
      .select('save_id, tags(id, name, color)')
      .in('save_id', saveIds);

    const map = {};
    (data || []).forEach(row => {
      if (!row.tags) return;
      if (!map[row.save_id]) map[row.save_id] = [];
      map[row.save_id].push(row.tags);
    });

    this.saveTagMap = map;
  }

  async prepareColorData() {
    if (this.colorDataInFlight || !this.isMoodBoard) return;
    this.colorDataInFlight = true;

    const updated = await this.populateColorMapForSaves(this.saves);
    this.colorDataInFlight = false;

    if (updated) {
      this.renderColorFilters();
      if (this.colorFilter !== 'all') {
        this.renderSaves();
      } else {
        this.updateSaveCardsWithColors();
      }
    }
  }

  async populateColorMapForSaves(saves) {
    let updated = false;

    for (const save of saves) {
      if (this.saveColorMap[save.id]) continue;
      if (!save.image_url) {
        this.saveColorMap[save.id] = { color: '#9ca3af', bucket: 'neutral' };
        updated = true;
        continue;
      }

      const color = await this.getDominantColor(save.image_url);
      const bucket = this.getColorBucketFromHex(color || '#9ca3af');
      this.saveColorMap[save.id] = { color: color || '#9ca3af', bucket };
      updated = true;
    }

    if (updated) {
      this.saveImageColorCache();
    }

    return updated;
  }

  async getDominantColor(imageUrl) {
    if (!imageUrl) return null;
    if (this.imageColorCache[imageUrl]) {
      return this.imageColorCache[imageUrl];
    }

    try {
      const color = await this.computeDominantColorFromImage(imageUrl);
      if (color) {
        this.imageColorCache[imageUrl] = color;
      }
      return color;
    } catch (e) {
      return null;
    }
  }

  computeDominantColorFromImage(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(null);
            return;
          }
          const size = 24;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          let r = 0;
          let g = 0;
          let b = 0;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha < 200) continue;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count += 1;
          }

          if (count === 0) {
            resolve(null);
            return;
          }

          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          resolve(this.rgbToHex(r, g, b));
        } catch (e) {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }

  rgbToHex(r, g, b) {
    const toHex = (value) => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  getColorBucketFromHex(hex) {
    if (!hex) return 'neutral';
    const rgb = hex.replace('#', '');
    const r = parseInt(rgb.slice(0, 2), 16);
    const g = parseInt(rgb.slice(2, 4), 16);
    const b = parseInt(rgb.slice(4, 6), 16);
    const hsl = this.rgbToHsl(r, g, b);
    return this.getColorBucketFromHsl(hsl);
  }

  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r:
          h = ((g - b) / delta) % 6;
          break;
        case g:
          h = (b - r) / delta + 2;
          break;
        default:
          h = (r - g) / delta + 4;
          break;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    return { h, s, l };
  }

  getColorBucketFromHsl(hsl) {
    if (!hsl || hsl.s < 0.18 || hsl.l < 0.12 || hsl.l > 0.92) {
      return 'neutral';
    }
    const hue = hsl.h;
    if (hue < 15 || hue >= 345) return 'red';
    if (hue < 40) return 'orange';
    if (hue < 70) return 'yellow';
    if (hue < 155) return 'green';
    if (hue < 200) return 'teal';
    if (hue < 250) return 'blue';
    if (hue < 290) return 'purple';
    if (hue < 345) return 'pink';
    return 'neutral';
  }

  updateSaveCardsWithColors() {
    const cards = document.querySelectorAll('.save-card');
    cards.forEach(card => {
      const id = card.dataset.id;
      const entry = this.saveColorMap[id];
      if (!entry) return;
      card.style.setProperty('--dominant', entry.color);
    });
  }

  async loadTags() {
    const { data } = await this.supabase
      .from('tags')
      .select('*')
      .order('name');

    this.tags = data || [];
    this.renderTags();
  }

  renderTags() {
    const container = document.getElementById('tags-list');
    container.innerHTML = this.tags.map(tag => `
      <span class="tag${this.currentTagId === tag.id ? ' active' : ''}" data-id="${tag.id}">${this.escapeHtml(tag.name)}</span>
    `).join('');

    container.querySelectorAll('.tag').forEach(el => {
      el.addEventListener('click', () => {
        this.filterByTag(el.dataset.id);
      });
    });
  }

  filterByTag(tagId) {
    this.currentTagId = tagId;
    this.currentFolderId = null;
    this.currentView = 'tag';

    // Update nav UI - clear other active states
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.tag').forEach(item => item.classList.remove('active'));
    document.querySelector(`.tag[data-id="${tagId}"]`)?.classList.add('active');

    // Update title
    const tag = this.tags.find(t => t.id === tagId);
    document.getElementById('view-title').textContent = tag?.name ? `#${tag.name}` : 'Tag';
    this.updateColorFilterVisibility();

    this.loadSaves();
  }

  async loadFolders() {
    const { data } = await this.supabase
      .from('folders')
      .select('*')
      .order('name');

    this.folders = data || [];
    this.renderFolders();
  }

  renderFolders() {
    const container = document.getElementById('folders-list');
    container.innerHTML = this.folders.map(folder => `
      <a href="#" class="nav-item folder-item${this.currentFolderId === folder.id ? ' active' : ''}" data-folder="${folder.id}">
        <span style="color: ${folder.color}">📁</span>
        ${this.escapeHtml(folder.name)}
      </a>
    `).join('');

    // Add click handlers for folder filtering
    container.querySelectorAll('.folder-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.filterByFolder(el.dataset.folder);
      });
    });
  }

  filterByFolder(folderId) {
    this.currentFolderId = folderId;
    this.currentTagId = null;
    this.currentView = 'folder';

    // Update nav UI - clear other active states
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-folder="${folderId}"]`)?.classList.add('active');

    // Update title
    const folder = this.folders.find(f => f.id === folderId);
    document.getElementById('view-title').textContent = folder?.name || 'Folder';
    this.updateColorFilterVisibility();

    this.loadSaves();
  }

  setView(view) {
    this.currentView = view;

    // Clear folder/tag filters when switching views
    this.currentFolderId = null;
    this.currentTagId = null;

    // Update nav - clear all active states first
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.tag').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    // Update title
    const titles = {
      all: 'All Saves',
      highlights: 'Highlights',
      articles: 'Articles',
      images: 'Images',
      kindle: 'Kindle Highlights',
      archived: 'Archived',
      stats: 'Stats',
    };
    document.getElementById('view-title').textContent = titles[view] || 'Saves';
    this.updateColorFilterVisibility();

    if (view === 'stats') {
      this.showStats();
    } else if (view === 'kindle') {
      this.loadKindleHighlights();
    } else {
      this.loadSaves();
    }
  }

  async search(query) {
    if (!query.trim()) {
      this.loadSaves();
      return;
    }

    const { data } = await this.supabase.rpc('search_saves', {
      search_query: query,
      user_uuid: this.user.id,
    });

    this.saves = data || [];
    await this.loadSaveTagMapForSaves(this.saves);
    this.renderSaves();
  }

  openReadingPane(save) {
    this.currentSave = save;

    // For image saves, show lightbox instead
    const isImageSave = save.source === 'upload' && save.image_url;
    if (isImageSave) {
      this.openImageLightbox(save);
      return;
    }

    const pane = document.getElementById('reading-pane');

    // Stop any existing audio
    this.stopAudio();

    document.getElementById('reading-title').textContent = save.title || 'Untitled';
    document.getElementById('reading-meta').innerHTML = `
      ${save.site_name || ''} ${save.author ? `· ${save.author}` : ''} · ${new Date(save.created_at).toLocaleDateString()}
    `;

    // Handle audio player visibility
    const audioPlayer = document.getElementById('audio-player');
    const audioGenerating = document.getElementById('audio-generating');

    if (save.audio_url) {
      // Audio is ready - show player
      audioPlayer.classList.remove('hidden');
      audioGenerating.classList.add('hidden');
      this.initAudio(save.audio_url);
    } else if (save.content && save.content.length > 100 && !save.highlight) {
      // Content exists but no audio yet - show generating indicator
      audioPlayer.classList.add('hidden');
      audioGenerating.classList.remove('hidden');
    } else {
      // No audio applicable (highlights, short content)
      audioPlayer.classList.add('hidden');
      audioGenerating.classList.add('hidden');
    }

    if (save.highlight) {
      document.getElementById('reading-body').innerHTML = `
        <blockquote style="font-style: italic; background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          "${this.escapeHtml(save.highlight)}"
        </blockquote>
        <p><a href="${save.url}" target="_blank" style="color: var(--primary);">View original →</a></p>
      `;
    } else {
      const content = save.content || save.excerpt || 'No content available.';
      document.getElementById('reading-body').innerHTML = this.renderMarkdown(content);
    }

    document.getElementById('open-original-btn').href = save.url || '#';

    // Update button states
    document.getElementById('archive-btn').classList.toggle('active', save.is_archived);
    document.getElementById('favorite-btn').classList.toggle('active', save.is_favorite);

    // Populate folder dropdown
    const folderSelect = document.getElementById('reading-folder-select');
    folderSelect.innerHTML = '<option value="">No folder</option>' +
      this.folders.map(f => `<option value="${f.id}"${save.folder_id === f.id ? ' selected' : ''}>${this.escapeHtml(f.name)}</option>`).join('');

    // Load tags for this save
    this.loadSaveTags(save.id);

    // Populate notes
    document.getElementById('reading-notes-textarea').value = save.notes || '';
    document.getElementById('notes-status').textContent = '';

    pane.classList.remove('hidden');
    // Add open class for mobile slide-in animation
    requestAnimationFrame(() => {
      pane.classList.add('open');
    });
  }

  // Image lightbox
  openImageLightbox(save) {
    // Remove existing lightbox
    document.querySelector('.image-lightbox')?.remove();

    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.innerHTML = `
      <img src="${save.image_url}" alt="${this.escapeHtml(save.title || 'Image')}">
      <button class="image-lightbox-close" title="Close">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="image-lightbox-actions">
        <button class="btn icon lightbox-similar" title="Find Similar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        </button>
        <button class="btn icon lightbox-delete" title="Delete">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <a class="btn icon" href="${save.image_url}" download="${save.title || 'image'}" title="Download">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </a>
      </div>
    `;

    document.body.appendChild(lightbox);

    // Trigger animation
    requestAnimationFrame(() => {
      lightbox.classList.add('visible');
    });

    // Close handlers
    const closeLightbox = () => {
      lightbox.classList.remove('visible');
      setTimeout(() => lightbox.remove(), 300);
      this.currentSave = null;
    };

    lightbox.querySelector('.image-lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    // Delete handler
    lightbox.querySelector('.lightbox-delete')?.addEventListener('click', async () => {
      if (!confirm('Delete this image? This cannot be undone.')) return;
      await this.supabase.from('saves').delete().eq('id', save.id);
      closeLightbox();
      this.loadSaves();
    });

    // Find Similar handler
    lightbox.querySelector('.lightbox-similar')?.addEventListener('click', () => {
      this.findSimilarImages(save);
    });

    // Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  closeReadingPane() {
    const pane = document.getElementById('reading-pane');
    pane.classList.remove('open');
    // Stop audio when closing
    this.stopAudio();
    // Reset progress bar
    const progressFill = document.getElementById('reading-progress-fill');
    if (progressFill) progressFill.style.width = '0%';
    // Wait for animation on mobile before hiding
    setTimeout(() => {
      if (!pane.classList.contains('open')) {
        pane.classList.add('hidden');
      }
    }, 300);
    this.currentSave = null;
  }

  // Reading Progress Bar
  updateReadingProgress() {
    const readingContent = document.getElementById('reading-content');
    const progressFill = document.getElementById('reading-progress-fill');

    if (!readingContent || !progressFill) return;

    const scrollTop = readingContent.scrollTop;
    const scrollHeight = readingContent.scrollHeight - readingContent.clientHeight;

    if (scrollHeight > 0) {
      const progress = (scrollTop / scrollHeight) * 100;
      progressFill.style.width = `${Math.min(progress, 100)}%`;
    }
  }

  // Audio player methods
  async initAudio(url) {
    this.stopAudio();

    // Extract filename from URL and get a signed URL
    const filename = url.split('/').pop();
    const signedUrl = await this.getSignedAudioUrl(filename);

    if (!signedUrl) {
      console.error('Failed to get signed URL for audio');
      return;
    }

    this.audio = new Audio(signedUrl);
    this.isPlaying = false;

    // Reset UI
    document.getElementById('audio-progress').style.width = '0%';
    document.getElementById('audio-current').textContent = '0:00';
    document.getElementById('audio-duration').textContent = '0:00';
    document.getElementById('audio-speed').value = '1';
    this.updatePlayButton();

    // Set up event listeners
    this.audio.addEventListener('loadedmetadata', () => {
      document.getElementById('audio-duration').textContent = this.formatTime(this.audio.duration);
    });

    this.audio.addEventListener('timeupdate', () => {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      document.getElementById('audio-progress').style.width = `${progress}%`;
      document.getElementById('audio-current').textContent = this.formatTime(this.audio.currentTime);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updatePlayButton();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });
  }

  toggleAudioPlayback() {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      this.audio.play();
      this.isPlaying = true;
    }
    this.updatePlayButton();
  }

  stopAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
      this.isPlaying = false;
      this.updatePlayButton();
    }
  }

  updatePlayButton() {
    const playIcon = document.querySelector('#audio-play-btn .play-icon');
    const pauseIcon = document.querySelector('#audio-play-btn .pause-icon');

    if (this.isPlaying) {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
    } else {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async getSignedAudioUrl(path) {
    // Get a signed URL for the audio file (valid for 1 hour)
    const { data, error } = await this.supabase.storage
      .from('audio')
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
    return data.signedUrl;
  }

  async toggleArchive() {
    if (!this.currentSave) return;

    const newValue = !this.currentSave.is_archived;
    await this.supabase
      .from('saves')
      .update({ is_archived: newValue })
      .eq('id', this.currentSave.id);

    this.currentSave.is_archived = newValue;
    this.loadSaves();
    if (newValue) this.closeReadingPane();
  }

  async toggleFavorite() {
    if (!this.currentSave) return;

    const newValue = !this.currentSave.is_favorite;
    await this.supabase
      .from('saves')
      .update({ is_favorite: newValue })
      .eq('id', this.currentSave.id);

    this.currentSave.is_favorite = newValue;
    document.getElementById('favorite-btn').classList.toggle('active', newValue);
  }

  async deleteSave() {
    if (!this.currentSave) return;

    if (!confirm('Delete this save? This cannot be undone.')) return;

    await this.supabase
      .from('saves')
      .delete()
      .eq('id', this.currentSave.id);

    this.closeReadingPane();
    this.loadSaves();
  }

  async addTagToSave() {
    if (!this.currentSave) return;

    const tagName = prompt('Enter tag name:');
    if (!tagName?.trim()) return;

    // Get or create tag
    let { data: existingTag } = await this.supabase
      .from('tags')
      .select('*')
      .eq('name', tagName.trim())
      .single();

    if (!existingTag) {
      const { data: newTag } = await this.supabase
        .from('tags')
        .insert({ user_id: this.user.id, name: tagName.trim() })
        .select()
        .single();
      existingTag = newTag;
    }

    if (existingTag) {
      await this.supabase
        .from('save_tags')
        .insert({ save_id: this.currentSave.id, tag_id: existingTag.id });

      this.loadTags();
      this.loadSaveTags(this.currentSave.id);
      await this.loadSaveTagMapForSaves(this.saves);
      if (this.showAnnotations) this.renderSaves();
    }
  }

  async loadSaveTags(saveId) {
    const { data } = await this.supabase
      .from('save_tags')
      .select('tag_id, tags(id, name, color)')
      .eq('save_id', saveId);

    this.currentSaveTags = data || [];
    this.renderSaveTags();
  }

  renderSaveTags() {
    const container = document.getElementById('reading-tags-list');
    if (!container) return;

    if (!this.currentSaveTags || this.currentSaveTags.length === 0) {
      container.innerHTML = '<span class="no-tags">No tags</span>';
      return;
    }

    container.innerHTML = this.currentSaveTags.map(st => `
      <span class="save-tag" style="background: ${st.tags.color}20; border-color: ${st.tags.color}">
        ${this.escapeHtml(st.tags.name)}
        <button class="tag-remove" data-tag-id="${st.tags.id}" title="Remove tag">&times;</button>
      </span>
    `).join('');

    // Bind remove handlers
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTagFromSave(this.currentSave.id, btn.dataset.tagId);
      });
    });
  }

  async removeTagFromSave(saveId, tagId) {
    await this.supabase
      .from('save_tags')
      .delete()
      .eq('save_id', saveId)
      .eq('tag_id', tagId);

    this.loadSaveTags(saveId);
    await this.loadSaveTagMapForSaves(this.saves);
    if (this.showAnnotations) this.renderSaves();
  }

  async updateSaveFolder(folderId) {
    if (!this.currentSave) return;

    await this.supabase
      .from('saves')
      .update({ folder_id: folderId })
      .eq('id', this.currentSave.id);

    this.currentSave.folder_id = folderId;

    // Refresh saves list if filtering by folder
    if (this.currentFolderId) {
      this.loadSaves();
    }
  }

  debouncedSaveNotes(notes) {
    document.getElementById('notes-status').textContent = 'Saving...';

    clearTimeout(this.notesTimeout);
    this.notesTimeout = setTimeout(() => {
      this.saveNotes(notes);
    }, 1000); // 1 second debounce
  }

  async saveNotes(notes) {
    if (!this.currentSave) return;

    try {
      await this.supabase
        .from('saves')
        .update({ notes })
        .eq('id', this.currentSave.id);

      this.currentSave.notes = notes;
      document.getElementById('notes-status').textContent = 'Saved';
      if (this.showAnnotations) this.renderSaves();
      setTimeout(() => {
        const status = document.getElementById('notes-status');
        if (status.textContent === 'Saved') {
          status.textContent = '';
        }
      }, 2000);
    } catch (err) {
      document.getElementById('notes-status').textContent = 'Failed to save';
    }
  }

  async addFolder() {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;

    await this.supabase
      .from('folders')
      .insert({ user_id: this.user.id, name: name.trim() });

    this.loadFolders();
  }

  async showStats() {
    const { data: saves } = await this.supabase
      .from('saves')
      .select('created_at, highlight, is_archived');

    const totalSaves = saves?.length || 0;
    const highlights = saves?.filter(s => s.highlight)?.length || 0;
    const articles = totalSaves - highlights;
    const archived = saves?.filter(s => s.is_archived)?.length || 0;

    // Group by month
    const byMonth = {};
    saves?.forEach(s => {
      const month = new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    const content = document.querySelector('.content');
    content.innerHTML = `
      <div class="stats-container">
        <div class="stats-header">
          <h2>Your Stats</h2>
          <button class="btn secondary" onclick="app.setView('all')">← Back</button>
        </div>

        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-card-value">${totalSaves}</div>
            <div class="stat-card-label">Total Saves</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${articles}</div>
            <div class="stat-card-label">Articles</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${highlights}</div>
            <div class="stat-card-label">Highlights</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${archived}</div>
            <div class="stat-card-label">Archived</div>
          </div>
        </div>

        <div class="stats-section">
          <h3>Saves by Month</h3>
          <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px;">
            ${Object.entries(byMonth).slice(-6).map(([month, count]) => `
              <div>
                <div style="font-size: 24px; font-weight: 600; color: var(--primary);">${count}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${month}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Kindle Highlights View
  async loadKindleHighlights() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    loading.classList.remove('hidden');
    container.innerHTML = '';

    const { data, error } = await this.supabase
      .from('saves')
      .select('*')
      .eq('source', 'kindle')
      .order('title', { ascending: true });

    loading.classList.add('hidden');

    if (error) {
      console.error('Error loading Kindle highlights:', error);
      return;
    }

    if (!data || data.length === 0) {
      empty.classList.remove('hidden');
      document.querySelector('.empty-icon').textContent = '📚';
      document.querySelector('.empty-state h3').textContent = 'No Kindle highlights yet';
      document.querySelector('.empty-state p').textContent = 'Import your Kindle highlights using the "Import Kindle" button in the sidebar, or sync from the Chrome extension.';
      return;
    }

    empty.classList.add('hidden');

    // Group by book title
    const books = {};
    data.forEach(save => {
      const key = save.title || 'Unknown Book';
      if (!books[key]) {
        books[key] = {
          title: save.title,
          author: save.author,
          highlights: [],
        };
      }
      books[key].highlights.push(save);
    });

    // Sort books by highlight count (most first)
    const sortedBooks = Object.values(books).sort((a, b) => b.highlights.length - a.highlights.length);

    this.renderKindleBooks(sortedBooks);
  }

  renderKindleBooks(books) {
    const container = document.getElementById('saves-container');

    container.innerHTML = `
      <div class="kindle-stats">
        <div class="kindle-stat">
          <span class="kindle-stat-value">${books.reduce((sum, b) => sum + b.highlights.length, 0)}</span>
          <span class="kindle-stat-label">highlights</span>
        </div>
        <div class="kindle-stat">
          <span class="kindle-stat-value">${books.length}</span>
          <span class="kindle-stat-label">books</span>
        </div>
        <button class="btn secondary kindle-clear-btn" id="clear-kindle-btn">Clear All Kindle Data</button>
      </div>
      <div class="kindle-books-grid">
        ${books.map(book => `
          <div class="kindle-book-card" data-title="${this.escapeHtml(book.title || '')}">
            <div class="kindle-book-header">
              <div class="kindle-book-icon">📖</div>
              <div class="kindle-book-info">
                <h3 class="kindle-book-title">${this.escapeHtml(book.title || 'Unknown Book')}</h3>
                ${book.author ? `<p class="kindle-book-author">${this.escapeHtml(book.author)}</p>` : ''}
              </div>
              <span class="kindle-book-count">${book.highlights.length}</span>
            </div>
            <div class="kindle-highlights-preview">
              ${book.highlights.slice(0, 3).map(h => `
                <div class="kindle-highlight-snippet" data-id="${h.id}">
                  "${this.escapeHtml(h.highlight?.substring(0, 150) || '')}${h.highlight?.length > 150 ? '...' : ''}"
                </div>
              `).join('')}
              ${book.highlights.length > 3 ? `
                <div class="kindle-more-highlights">+${book.highlights.length - 3} more highlights</div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind click events to open highlights
    container.querySelectorAll('.kindle-highlight-snippet').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const allHighlights = books.flatMap(b => b.highlights);
        const save = allHighlights.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });

    // Bind book card clicks to expand
    container.querySelectorAll('.kindle-book-card').forEach(card => {
      card.addEventListener('click', () => {
        const title = card.dataset.title;
        const book = books.find(b => (b.title || '') === title);
        if (book) this.showBookHighlights(book);
      });
    });

    // Clear Kindle data button
    const clearBtn = document.getElementById('clear-kindle-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearKindleData());
    }
  }

  async clearKindleData() {
    const count = this.saves?.length || 0;
    if (!confirm(`Delete all ${count} Kindle highlights? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('saves')
        .delete()
        .eq('source', 'kindle');

      if (error) throw error;

      alert('All Kindle data cleared. You can now re-sync from the Chrome extension.');
      this.loadKindleHighlights();
    } catch (err) {
      console.error('Error clearing Kindle data:', err);
      alert('Failed to clear data: ' + err.message);
    }
  }

  showBookHighlights(book) {
    const container = document.getElementById('saves-container');

    container.innerHTML = `
      <div class="kindle-book-detail">
        <button class="btn secondary kindle-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to all books
        </button>
        <div class="kindle-book-detail-header">
          <div class="kindle-book-icon-large">📖</div>
          <div>
            <h2>${this.escapeHtml(book.title || 'Unknown Book')}</h2>
            ${book.author ? `<p class="kindle-book-author">${this.escapeHtml(book.author)}</p>` : ''}
            <p class="kindle-book-meta">${book.highlights.length} highlights</p>
          </div>
        </div>
        <div class="kindle-highlights-list">
          ${book.highlights.map(h => `
            <div class="kindle-highlight-card" data-id="${h.id}">
              <div class="kindle-highlight-text">"${this.escapeHtml(h.highlight || '')}"</div>
              <div class="kindle-highlight-meta">
                ${new Date(h.created_at).toLocaleDateString()}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Back button
    container.querySelector('.kindle-back-btn').addEventListener('click', () => {
      this.loadKindleHighlights();
    });

    // Highlight clicks
    container.querySelectorAll('.kindle-highlight-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const save = book.highlights.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });
  }

  // Kindle Import Methods
  showKindleImportModal() {
    const modal = document.getElementById('kindle-import-modal');
    modal.classList.remove('hidden');
    this.resetKindleImportModal();
  }

  hideKindleImportModal() {
    const modal = document.getElementById('kindle-import-modal');
    modal.classList.add('hidden');
    this.resetKindleImportModal();
  }

  resetKindleImportModal() {
    this.pendingKindleImport = null;
    document.getElementById('kindle-file-input').value = '';
    document.getElementById('kindle-import-preview').classList.add('hidden');
    document.getElementById('kindle-import-footer').classList.add('hidden');
    const dropzone = document.getElementById('kindle-dropzone');
    dropzone.classList.remove('success', 'processing');
  }

  async handleKindleFile(file) {
    if (!file.name.endsWith('.txt')) {
      alert('Please upload a .txt file (My Clippings.txt from your Kindle)');
      return;
    }

    const dropzone = document.getElementById('kindle-dropzone');
    dropzone.classList.add('processing');

    try {
      const content = await file.text();
      const highlights = this.parseMyClippings(content);

      if (highlights.length === 0) {
        alert('No highlights found in this file. Make sure it\'s a valid My Clippings.txt file.');
        dropzone.classList.remove('processing');
        return;
      }

      // Check for duplicates against existing saves
      const { data: existingSaves } = await this.supabase
        .from('saves')
        .select('highlight, title')
        .not('highlight', 'is', null);

      const existingSet = new Set(
        (existingSaves || []).map(s => `${s.highlight}|||${s.title}`)
      );

      let duplicateCount = 0;
      const newHighlights = highlights.filter(h => {
        const key = `${h.highlight}|||${h.title}`;
        if (existingSet.has(key)) {
          duplicateCount++;
          return false;
        }
        return true;
      });

      this.pendingKindleImport = newHighlights;

      // Group by book for display
      const bookCounts = {};
      newHighlights.forEach(h => {
        const key = h.title;
        if (!bookCounts[key]) {
          bookCounts[key] = { title: h.title, author: h.author, count: 0 };
        }
        bookCounts[key].count++;
      });

      // Update UI
      dropzone.classList.remove('processing');
      dropzone.classList.add('success');

      document.getElementById('import-total').textContent = newHighlights.length;
      document.getElementById('import-books').textContent = Object.keys(bookCounts).length;
      document.getElementById('import-duplicates').textContent = duplicateCount;

      const booksList = document.getElementById('import-books-list');
      booksList.innerHTML = Object.values(bookCounts)
        .sort((a, b) => b.count - a.count)
        .map(book => `
          <div class="import-book-item">
            <div>
              <div class="import-book-title">${this.escapeHtml(book.title)}</div>
              ${book.author ? `<div class="import-book-author">${this.escapeHtml(book.author)}</div>` : ''}
            </div>
            <span class="import-book-count">${book.count}</span>
          </div>
        `).join('');

      document.getElementById('kindle-import-preview').classList.remove('hidden');
      document.getElementById('kindle-import-footer').classList.remove('hidden');

    } catch (error) {
      console.error('Error parsing Kindle file:', error);
      alert('Error reading the file. Please try again.');
      dropzone.classList.remove('processing');
    }
  }

  parseMyClippings(content) {
    // Split by the Kindle clipping delimiter
    const clippings = content.split('==========').filter(c => c.trim());
    const highlights = [];

    for (const clipping of clippings) {
      const lines = clipping.trim().split('\n').filter(l => l.trim());
      if (lines.length < 3) continue;

      // First line: Book Title (Author)
      const titleLine = lines[0].trim();
      let title = titleLine;
      let author = null;

      // Extract author from parentheses at the end
      const authorMatch = titleLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (authorMatch) {
        title = authorMatch[1].trim();
        author = authorMatch[2].trim();
      }

      // Second line: metadata (type, location, date)
      const metaLine = lines[1].trim();

      // Check if this is a highlight (not a bookmark or note)
      if (!metaLine.toLowerCase().includes('highlight')) {
        continue; // Skip bookmarks and notes
      }

      // Extract date from metadata line
      let addedAt = null;
      const dateMatch = metaLine.match(/Added on (.+)$/i);
      if (dateMatch) {
        try {
          addedAt = new Date(dateMatch[1]).toISOString();
        } catch (e) {
          // Ignore date parsing errors
        }
      }

      // Remaining lines are the highlight text
      const highlightText = lines.slice(2).join('\n').trim();

      if (!highlightText) continue;

      highlights.push({
        title,
        author,
        highlight: highlightText,
        addedAt,
      });
    }

    return highlights;
  }

  async confirmKindleImport() {
    if (!this.pendingKindleImport || this.pendingKindleImport.length === 0) {
      this.hideKindleImportModal();
      return;
    }

    const confirmBtn = document.getElementById('kindle-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing...';

    try {
      // Prepare saves for batch insert
      const saves = this.pendingKindleImport.map(h => ({
        user_id: this.user.id,
        title: h.title,
        author: h.author,
        highlight: h.highlight,
        site_name: 'Kindle',
        source: 'kindle',
        created_at: h.addedAt || new Date().toISOString(),
      }));

      // Insert in batches of 50 to avoid request size limits
      const batchSize = 50;
      for (let i = 0; i < saves.length; i += batchSize) {
        const batch = saves.slice(i, i + batchSize);
        const { error } = await this.supabase.from('saves').insert(batch);
        if (error) throw error;
      }

      // Success - close modal and refresh
      this.hideKindleImportModal();
      this.loadSaves();

      alert(`Successfully imported ${saves.length} highlights!`);

    } catch (error) {
      console.error('Error importing highlights:', error);
      alert('Error importing highlights. Please try again.');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Import Highlights';
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderMarkdown(text) {
    if (!text) return '';

    // Configure marked for safe rendering
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,  // Convert \n to <br>
        gfm: true,     // GitHub Flavored Markdown
      });

      try {
        return marked.parse(text);
      } catch (e) {
        console.error('Markdown parse error:', e);
        // Fallback to escaped plain text
        return `<div style="white-space: pre-wrap;">${this.escapeHtml(text)}</div>`;
      }
    }

    // Fallback if marked isn't loaded
    return `<div style="white-space: pre-wrap;">${this.escapeHtml(text)}</div>`;
  }

  // Digest Settings Methods
  showDigestModal() {
    const modal = document.getElementById('digest-modal');
    modal.classList.remove('hidden');
    this.loadDigestPreferences();
  }

  hideDigestModal() {
    const modal = document.getElementById('digest-modal');
    modal.classList.add('hidden');
    document.getElementById('digest-status').classList.add('hidden');
  }

  // Quick Add (Vision V2)
  showQuickAddModal() {
    const modal = document.getElementById('quick-add-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.resetQuickAddForm();
  }

  hideQuickAddModal() {
    const modal = document.getElementById('quick-add-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    this.resetQuickAddForm();
  }

  resetQuickAddForm() {
    document.getElementById('quick-add-title').value = '';
    document.getElementById('quick-add-url').value = '';
    document.getElementById('quick-add-note').value = '';
    document.getElementById('quick-add-file').value = '';
    this.clearImagePreview();
    this.switchQuickAddType('url');
    this.setQuickAddStatus('', '');
  }

  switchQuickAddType(type) {
    const tabs = document.querySelectorAll('.quick-add-tab');
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.type === type));

    document.querySelectorAll('.quick-add-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.panel !== type);
    });
  }

  setQuickAddStatus(message, type) {
    const status = document.getElementById('quick-add-status');
    if (!status) return;
    if (!message) {
      status.classList.add('hidden');
      status.textContent = '';
      status.className = 'quick-add-status hidden';
      return;
    }
    status.textContent = message;
    status.className = `quick-add-status ${type || ''}`;
    status.classList.remove('hidden');
  }

  async saveQuickAdd() {
    const activeTab = document.querySelector('.quick-add-tab.active');
    const type = activeTab?.dataset.type || 'url';
    const title = document.getElementById('quick-add-title').value.trim();
    const url = document.getElementById('quick-add-url').value.trim();
    const note = document.getElementById('quick-add-note').value.trim();
    const file = this.pendingImageFile;

    if (type === 'url' && !url) {
      this.setQuickAddStatus('Please enter a URL.', 'error');
      return;
    }

    if (type === 'note' && !note) {
      this.setQuickAddStatus('Please enter a note.', 'error');
      return;
    }

    if (type === 'file' && !file) {
      this.setQuickAddStatus('Please select an image to upload.', 'error');
      return;
    }

    this.setQuickAddStatus('Saving...', '');

    try {
      let imageUrl = null;
      let storedUrl = null;

      if (type === 'file' && file) {
        const path = `${this.user.id}/${Date.now()}-${file.name || 'image.png'}`;
        const { error: uploadError } = await this.supabase
          .storage
          .from('uploads')
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data } = this.supabase.storage.from('uploads').getPublicUrl(path);
        storedUrl = data?.publicUrl || null;
        imageUrl = storedUrl;
      }

      const payload = {
        user_id: this.user.id,
        title: title || (type === 'file' ? (file?.name || 'Image') : (type === 'note' ? 'Quick Note' : url)),
        url: type === 'url' ? url : storedUrl,
        content: type === 'note' ? note : null,
        excerpt: type === 'note' ? note.slice(0, 180) : null,
        notes: type === 'note' ? note : null,
        site_name: type === 'note' ? 'Note' : (type === 'file' ? 'Image' : null),
        source: type === 'file' ? 'upload' : 'manual',
        image_url: imageUrl,
      };

      const { data: insertedSave, error } = await this.supabase
        .from('saves')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      this.setQuickAddStatus('Saved!', 'success');
      this.loadSaves();
      setTimeout(() => this.hideQuickAddModal(), 600);

      // Trigger auto-tagging in background
      if (insertedSave?.id) {
        this.triggerAutoTag(insertedSave.id);
        // Generate image embedding for file uploads (similarity search)
        if (type === 'file' && imageUrl) {
          this.generateImageEmbedding({
            id: insertedSave.id,
            image_url: imageUrl,
          }).catch(err => console.warn('Embedding generation failed:', err));
        }
      }
    } catch (err) {
      console.error('Quick add error:', err);
      this.setQuickAddStatus('Failed to save. Please try again.', 'error');
    }
  }

  async loadDigestPreferences() {
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', this.user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      // Populate form with existing preferences or defaults
      const prefs = data || {};
      document.getElementById('digest-enabled').checked = prefs.digest_enabled || false;
      document.getElementById('digest-email').value = prefs.digest_email || '';
      document.getElementById('digest-day').value = prefs.digest_day ?? 0;
      document.getElementById('digest-hour').value = prefs.digest_hour ?? 9;

      // Update UI state
      this.updateDigestOptionsState();

    } catch (error) {
      console.error('Error loading digest preferences:', error);
    }
  }

  updateDigestOptionsState() {
    const enabled = document.getElementById('digest-enabled').checked;
    const options = document.getElementById('digest-options');
    const schedule = document.getElementById('digest-schedule-group');

    if (enabled) {
      options.classList.remove('disabled');
      schedule.classList.remove('disabled');
    } else {
      options.classList.add('disabled');
      schedule.classList.add('disabled');
    }
  }

  async saveDigestPreferences() {
    const status = document.getElementById('digest-status');
    const saveBtn = document.getElementById('digest-save-btn');

    const enabled = document.getElementById('digest-enabled').checked;
    const email = document.getElementById('digest-email').value.trim();
    const day = parseInt(document.getElementById('digest-day').value);
    const hour = parseInt(document.getElementById('digest-hour').value);

    // Validate email if enabled
    if (enabled && !email) {
      status.textContent = 'Please enter an email address';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
      return;
    }

    if (enabled && !email.includes('@')) {
      status.textContent = 'Please enter a valid email address';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      // Upsert preferences (insert or update)
      const { error } = await this.supabase
        .from('user_preferences')
        .upsert({
          user_id: this.user.id,
          digest_enabled: enabled,
          digest_email: email || null,
          digest_day: day,
          digest_hour: hour,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      status.textContent = enabled
        ? 'Digest enabled! You\'ll receive emails weekly.'
        : 'Digest disabled. You won\'t receive emails.';
      status.className = 'digest-status success';
      status.classList.remove('hidden');

      // Close modal after delay
      setTimeout(() => this.hideDigestModal(), 1500);

    } catch (error) {
      console.error('Error saving digest preferences:', error);
      status.textContent = 'Error saving preferences. Please try again.';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  }
}

// Initialize app (expose for debugging in console)
window.StashApp = StashApp;
window.stashApp = new StashApp();
