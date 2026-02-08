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

    // Quick Note state
    this.pendingNoteColor = null;
    this.pendingNoteGradient = null;

    // Focus Bar state
    this.pinnedSaves = [];

    // Spaces modal state
    this.pendingSpaceName = '';
    this.pendingSpaceColor = '';
    this.spaceColorOptions = [
      '#FFADDE',
      '#54BA6E',
      '#00203E',
      '#F3FFB2',
      '#FF2E2E',
      '#CFEDD3',
      '#ADFFFF',
      '#670626',
      '#B2CDFF',
      '#F7DEED',
      '#D8EB27',
      '#DBBDDC',
      '#F47358',
      '#CFD357',
      '#FFBDC5',
    ];

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
    this.bindQuickNoteEvents();
    this.bindQuickNoteKeyboardShortcut();
    this.bindFormatBar();
    this.bindPinButton();
    this.bindProductModal();
    this.bindEditNoteModal();
    this.bindContextMenu();
    this.bindModalContextMenu();
    this.bindSpacesPage();
    this.bindNavTabs();
    this.bindDropZone();
    this.loadPinnedSaves();
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

    // Sticky search bar scroll detection
    const searchBar = document.querySelector('.search-bar-redesigned');
    const content = document.querySelector('.content');
    if (searchBar && content) {
      content.addEventListener('scroll', () => {
        if (content.scrollTop > 50) {
          searchBar.classList.add('scrolled');
        } else {
          searchBar.classList.remove('scrolled');
        }
      });
      // Also listen on window scroll for cases where content doesn't scroll
      window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
          searchBar.classList.add('scrolled');
        } else {
          searchBar.classList.remove('scrolled');
        }
      });
    }

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

    // Preserve Quick Note input before clearing container
    const quickNoteInput = document.getElementById('quick-note-input');
    const tempHolder = document.createDocumentFragment();
    if (quickNoteInput) {
      tempHolder.appendChild(quickNoteInput);
    }

    loading.classList.remove('hidden');
    container.innerHTML = '';

    // Re-insert Quick Note input immediately
    if (quickNoteInput) {
      container.appendChild(quickNoteInput);
    }

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
    } else if (this.currentView === 'products') {
      query = query.eq('is_product', true).eq('is_archived', false);
    } else if (this.currentView === 'books') {
      query = query.eq('is_book', true).eq('is_archived', false);
    } else if (this.currentView === 'notes') {
      query = query.eq('is_archived', false).or('site_name.eq.Note,and(url.is.null,or(notes.not.is.null,content.not.is.null))');
    } else if (this.currentView === 'music') {
      query = query.eq('is_archived', false).or('url.ilike.%spotify.com%,url.ilike.%music.apple.com%,url.ilike.%soundcloud.com%,url.ilike.%bandcamp.com%');
    } else if (this.currentView === 'video') {
      query = query.eq('is_archived', false).or('url.ilike.%youtube.com%,url.ilike.%youtu.be%,url.ilike.%vimeo.com%,url.ilike.%tiktok.com%');
    } else if (this.currentView === 'links') {
      query = query
        .eq('is_archived', false)
        .not('url', 'is', null)
        .is('content', null)
        .is('excerpt', null)
        .eq('is_product', false)
        .eq('is_book', false);
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

    // Save reference to quick note input before clearing
    const quickNoteInput = document.getElementById('quick-note-input');

    container.classList.toggle('mood-board', useMoodBoard);

    // Add grid-sizer for masonry column width calculation
    const cardsHtml = savesToRender.map(save => this.renderSaveCard(save, { moodBoard: useMoodBoard })).join('');
    container.innerHTML = `<div class="grid-sizer"></div>${cardsHtml}`;

    // Re-insert quick note input at the beginning (after grid-sizer) for allowed views
    if (quickNoteInput && viewAllows) {
      const gridSizer = container.querySelector('.grid-sizer');
      if (gridSizer) {
        container.insertBefore(quickNoteInput, gridSizer.nextSibling);
      } else {
        container.prepend(quickNoteInput);
      }
      quickNoteInput.classList.remove('hidden');
    } else if (quickNoteInput) {
      // Hide Quick Note for views that don't support it
      quickNoteInput.classList.add('hidden');
    }

    if (useMoodBoard) {
      this.renderColorFilters();
      this.prepareColorData();
    }

    // Bind click events and make cards draggable
    container.querySelectorAll('.save-card').forEach(card => {
      // Make card draggable for Focus Bar
      card.setAttribute('draggable', 'true');

      card.addEventListener('click', (e) => {
        // Don't open reading pane if clicking a checkbox
        if (e.target.classList.contains('task-checkbox')) return;
        const id = card.dataset.id;
        const save = this.saves.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });

      // Right-click context menu
      card.addEventListener('contextmenu', (e) => {
        const id = card.dataset.id;
        const save = this.saves.find(s => s.id === id);
        if (save) this.showContextMenu(e, save);
      });
    });

    // Bind task checkbox interactions
    this.bindTaskCheckboxes(container);

    // Initialize Masonry layout
    this.initMasonry(container);
  }

  initMasonry(container) {
    // Check if Masonry is available
    if (typeof Masonry === 'undefined') {
      console.warn('Masonry library not loaded');
      return;
    }

    // Get stamp element (quick note) if it exists
    const stampElem = container.querySelector('.quick-note-input');

    // Initialize Masonry - quick-note-input is stamped in place, layout flows around it
    this.masonry = new Masonry(container, {
      itemSelector: '.save-card',
      columnWidth: '.grid-sizer',
      percentPosition: true,
      gutter: 16,
      stamp: stampElem ? '.quick-note-input' : null
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
    if (save.is_book) return 'book';
    if (save.is_product) return 'product';
    if (save.highlight) return 'highlight';
    if (save.source === 'upload' && save.image_url) return 'image';
    if (save.site_name === 'Note' || (!save.url && (save.notes || save.content))) return 'note';

    // Detect music from URL patterns
    if (save.url) {
      const url = save.url.toLowerCase();
      if (url.includes('spotify.com') || url.includes('music.apple.com') ||
          url.includes('soundcloud.com') || url.includes('bandcamp.com')) {
        return 'music';
      }
      // Detect video from URL patterns
      if (url.includes('youtube.com') || url.includes('youtu.be') ||
          url.includes('vimeo.com') || url.includes('tiktok.com')) {
        return 'video';
      }
    }

    if (save.url && !save.content && !save.excerpt) return 'link';
    return 'article';
  }

  viewForSaveType(saveType) {
    const map = {
      article: 'articles',
      link: 'links',
      highlight: 'highlights',
      image: 'images',
      product: 'products',
      book: 'books',
      note: 'notes',
      music: 'music',
      video: 'video',
    };
    return map[saveType] || 'all';
  }

  filterBySaveType(saveType) {
    const view = this.viewForSaveType(saveType);
    this.setView(view);
  }

  renderModalSaveTypePill(saveType) {
    const assets = {
      article: {
        label: 'Article',
        icon: 'https://www.figma.com/api/mcp/asset/be26309e-b0a4-4698-a545-3343032f5d37',
        size: 12,
      },
      book: {
        label: 'Book',
        icon: 'https://www.figma.com/api/mcp/asset/8a450998-358c-4752-9c7b-b408cad6464d',
        size: 16,
      },
      video: {
        label: 'Video',
        icon: 'https://www.figma.com/api/mcp/asset/6106c1c5-02cf-471d-b41b-0a62117b1699',
        size: 16,
      },
      image: {
        label: 'Image',
        icon: 'https://www.figma.com/api/mcp/asset/57066f98-cd61-4e37-ae93-386aeeca16ac',
        size: 16,
      },
      product: {
        label: 'Product',
        icon: 'https://www.figma.com/api/mcp/asset/33b49b13-c191-4856-8cb8-e3e86366bf98',
        size: 16,
      },
      music: {
        label: 'Music',
        icon: 'https://www.figma.com/api/mcp/asset/b5022f9f-b3a8-45e0-930b-df595c515086',
        size: 16,
      },
      highlight: {
        label: 'Quote',
        icon: 'https://www.figma.com/api/mcp/asset/14bee86b-fdc7-4d1b-9f50-df3dc1dc67be',
        size: 12,
      },
      note: {
        label: 'Note',
        icon: 'https://www.figma.com/api/mcp/asset/ad2a0beb-3130-4741-bd8e-7fc48f1cacc2',
        size: 9,
      },
      link: {
        label: 'Link',
        icon: 'https://www.figma.com/api/mcp/asset/be26309e-b0a4-4698-a545-3343032f5d37',
        size: 12,
      },
    };

    const data = assets[saveType] || assets.article;
    return `
      <span class="modal-save-type-pill" data-save-type="${saveType}">
        <img src="${data.icon}" alt="" style="width: ${data.size}px; height: ${data.size}px;">
        <span>${data.label}</span>
      </span>
    `;
  }

  renderModalSpacePill(folderId) {
    if (!folderId) return '';
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return '';
    const color = folder.color || '#8aa7ff';
    return `
      <span class="modal-space-tag-pill">
        <span class="modal-space-dot" style="border-color: ${color};"></span>
        <span>${this.escapeHtml(folder.name)}</span>
      </span>
    `;
  }

  hexToRgba(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
      case 'book':
        // Book card - cover image with 3D effect
        return `
          <div class="save-card book-save" data-id="${save.id}">
            <div class="book-cover-container">
              <img src="${save.image_url}" alt="${this.escapeHtml(save.title)}" class="book-cover">
            </div>
          </div>
        `;

      case 'product':
        // Product card - like image save with price badge
        const priceDisplay = this.formatPrice(save.product_price, save.product_currency);
        return `
          <div class="save-card product-save" data-id="${save.id}">
            ${save.image_url ? `<img class="save-card-image" src="${save.image_url}" alt="">` : ''}
            ${priceDisplay ? `<span class="product-price-badge">${priceDisplay}</span>` : ''}
            <div class="save-card-content">
              ${annotations}
            </div>
          </div>
        `;

      case 'highlight':
        return `
          <div class="save-card highlight" data-id="${save.id}">
            <div class="save-card-content">
              <div class="save-card-site">${this.escapeHtml(save.site_name || '')}</div>
              <div class="save-card-highlight">"${this.escapeHtml(save.highlight)}"</div>
              <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
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
        // Apply saved color/gradient as background
        let noteStyle = '';
        if (save.note_gradient) {
          noteStyle = `background: ${save.note_gradient};`;
        } else if (save.note_color) {
          noteStyle = `background: linear-gradient(135deg, ${save.note_color} 0%, ${this.lightenColor(save.note_color, 15)} 100%);`;
        }
        return `
          <div class="save-card note-save" data-id="${save.id}" style="${noteStyle}">
            <div class="save-card-content">
              <div class="save-card-title">${this.escapeHtml(save.title || 'Quick Note')}</div>
              <div class="save-card-note-content">${this.renderMarkdownPreview(noteContent)}</div>
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
              ${annotations}
            </div>
          </div>
        `;

      case 'music':
        // Music card - album art with track info
        const musicDomain = save.url ? new URL(save.url).hostname.replace('www.', '') : '';
        return `
          <div class="save-card music-card" data-id="${save.id}">
            ${save.image_url ? `<img class="album-art" src="${save.image_url}" alt="">` : ''}
            <div class="music-info">
              <div>
                <div class="music-title">${this.escapeHtml(save.title || 'Untitled')}</div>
                <div class="music-artist">${this.escapeHtml(save.site_name || musicDomain)}</div>
              </div>
              <span class="track-count">${this.escapeHtml(musicDomain)}</span>
            </div>
            ${annotations}
          </div>
        `;

      case 'video':
        // Video card - thumbnail with play button
        return `
          <div class="save-card video-card" data-id="${save.id}">
            <div class="video-thumbnail">
              ${save.image_url ? `<img src="${save.image_url}" alt="">` : ''}
              <div class="play-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </div>
            </div>
            <div class="video-info">
              <div class="video-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="video-channel">${this.escapeHtml(save.site_name || '')}</div>
            </div>
            ${annotations}
          </div>
        `;

      case 'article':
      default:
        // Article card - new design with optional image
        const publisherLabel = this.getArticlePublisherLabel(save);
        const publisherDomain = this.getArticlePublisherDomain(save);
        const brandfetchLogoUrl = publisherDomain
          ? `https://cdn.brandfetch.io/${encodeURIComponent(publisherDomain)}/logo?c=1idTAprk8CUU5DSoOo1`
          : '';
        return `
          <div class="save-card article-card${save.image_url ? ' article-card--image' : ' article-card--noimage'}" data-id="${save.id}">
            <div class="article-card-content${save.image_url ? '' : ' article-card-content--bookmark'}">
              <div class="article-card-publisher-logo">
                ${brandfetchLogoUrl
                  ? `<img src="${brandfetchLogoUrl}" alt="${this.escapeHtml(publisherLabel)}" loading="lazy" onload="if(this.naturalWidth<=50||(this.naturalWidth===820&&this.naturalHeight===220)){this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='block'}" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='block'"><span class="article-card-publisher-text" style="display:none">${this.escapeHtml(publisherLabel)}</span>`
                  : `<span class="article-card-publisher-text">${this.escapeHtml(publisherLabel)}</span>`
                }
              </div>
              ${save.image_url ? `<div class="article-card-headline">${this.escapeHtml(save.title || '')}</div>` : ''}
            </div>
            ${save.image_url ? `
              <div class="article-card-media">
                <img src="${save.image_url}" alt="" onerror="this.style.display='none'">
              </div>
            ` : `
              <div class="article-card-noimage-body">
                <div class="article-card-headline">${this.escapeHtml(save.title || '')}</div>
              </div>
            `}
          </div>
        `;
    }
  }

  renderArticlePublisher(save) {
    const publisher = (save.site_name || '').trim();
    if (publisher) {
      return `<div class="article-card-publisher">${this.escapeHtml(publisher)}</div>`;
    }

    if (save.url) {
      const sourceLabel = this.getSourceLabel(save.url);
      if (sourceLabel) {
        return `<div class="article-card-publisher is-url">${this.escapeHtml(sourceLabel)}</div>`;
      }
    }

    return `<div class="article-card-publisher"></div>`;
  }

  getArticlePublisherLabel(save) {
    const siteName = (save.site_name || '').trim();
    if (siteName) return siteName;
    if (save.url) {
      const label = this.getSourceLabel(save.url);
      if (label) return label;
    }
    return '';
  }

  getArticlePublisherDomain(save) {
    if (!save.url) return '';
    try {
      return new URL(save.url).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
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
    this.updateMainViewVisibility();

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
    this.updateMainViewVisibility();
    this.updateSpaceTitleBar(folder?.name || 'Folder');

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
      books: 'Books',
      products: 'Products',
      images: 'Images',
      notes: 'Notes',
      links: 'Links',
      music: 'Music',
      video: 'Video',
      kindle: 'Kindle Highlights',
      archived: 'Archived',
      stats: 'Stats',
      weekly: 'This Week',
    };
    document.getElementById('view-title').textContent = titles[view] || 'Saves';
    this.updateColorFilterVisibility();
    this.updateMainViewVisibility();

    if (view === 'stats') {
      this.showStats();
    } else if (view === 'kindle') {
      this.loadKindleHighlights();
    } else if (view === 'spaces') {
      this.loadSpacesPage();
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
    // Use unified modal for all save types (including notes)
    this.openUnifiedModal(save);
  }

  // Legacy reading pane (kept for backward compatibility)
  openLegacyReadingPane(save) {
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
    document.getElementById('pin-btn')?.classList.toggle('active', save.is_pinned);

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
        <button class="btn icon lightbox-similar" title="SAME VIBE">
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
        <a class="btn icon" href="${save.image_url}" download="${save.title || 'image'}" title="DOWNLOAD">
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

  // ==========================================
  // Unified Modal System
  // ==========================================

  openUnifiedModal(save) {
    const modal = document.getElementById('unified-modal');
    const saveType = this.getSaveType(save);
    const modalLayout = modal.querySelector('.modal-layout');
    const modalMain = modal.querySelector('.modal-main');
    const modalSidebar = modal.querySelector('.modal-sidebar');
    const modalHeader = modal.querySelector('.modal-header');

    // Stop any existing audio
    this.stopAudio();

    // Reset modal layout classes
    modalLayout.classList.remove('book-modal-active');
    modalMain.style.display = '';
    modalSidebar.style.display = '';
    if (modalHeader) modalHeader.style.display = '';

    // Render body based on save type
    const modalBody = document.getElementById('modal-body');
    modalBody.className = `modal-body modal-body-${saveType}`;

    // Special handling for books - use full-width custom layout
    if (saveType === 'book') {
      modalLayout.classList.add('book-modal-active');
      if (modalHeader) modalHeader.style.display = 'none';
      modalSidebar.style.display = 'none';
      modalBody.innerHTML = this.renderBookModalBody(save);
      // Fixed background color #3E3D52 - no dominant color extraction needed
      this.attachBookModalEventListeners(save);

      // Show modal
      modal.classList.remove('hidden');
      return;
    }

    // Regular modal flow for other save types
    // Populate header
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
      modalTitle.textContent = save.title || 'Untitled';
    }
    const modalMeta = document.getElementById('modal-meta');
    if (modalMeta) {
      modalMeta.innerHTML = `
        ${save.site_name || ''} ${save.author ? `· ${save.author}` : ''} · ${new Date(save.created_at).toLocaleDateString()}
      `;
    }

    switch(saveType) {
      case 'book':
        modalBody.innerHTML = this.renderBookModalBody(save);
        // Fixed background color #3E3D52 - no dominant color extraction needed
        break;
      case 'image':
        modalBody.innerHTML = this.renderImageModalBody(save);
        break;
      case 'product':
        modalBody.innerHTML = this.renderProductModalBody(save);
        break;
      case 'note':
        modalBody.innerHTML = this.renderNoteModalBody(save);
        break;
      case 'highlight':
        modalBody.innerHTML = this.renderHighlightModalBody(save);
        break;
      default: // article, link
        modalBody.innerHTML = this.renderArticleModalBody(save);
    }

    // Populate sidebar
    this.populateModalSidebar(save);

    // Show modal
    modal.classList.remove('hidden');

    // Attach event listeners
    this.attachModalEventListeners(save);
  }

  renderArticleModalBody(save) {
    const content = save.content || save.excerpt || 'No content available.';
    return `
      ${save.image_url ? `<img src="${save.image_url}" class="modal-hero-image" alt="">` : ''}
      <div class="modal-article-content">
        ${this.renderMarkdown(content)}
      </div>
    `;
  }

  renderImageModalBody(save) {
    return `
      <div class="modal-image-container">
        <img src="${save.image_url}" alt="${this.escapeHtml(save.title || 'Image')}" class="modal-full-image">
        <div class="modal-image-actions">
          <button id="modal-image-similar" class="image-action-btn">
            <img src="https://www.figma.com/api/mcp/asset/09ace2b5-c661-462c-ae60-3e2ce5952d28" alt="">
            <span>Same Vibe</span>
          </button>
          <button id="modal-image-autotag" class="image-action-btn">
            <span>Auto-tag</span>
          </button>
          <a href="${save.image_url}" download class="image-action-btn">
            <span>Download</span>
          </a>
        </div>
      </div>
    `;
  }

  renderHighlightModalBody(save) {
    return `
      <blockquote class="modal-highlight">
        "${this.escapeHtml(save.highlight)}"
      </blockquote>
      ${save.url ? `<p><a href="${save.url}" target="_blank" class="modal-source-link">View original →</a></p>` : ''}
    `;
  }

  renderNoteModalBody(save) {
    return `
      <div class="modal-note-editor">
        <div class="modal-note-toolbar">
          <button type="button" class="note-format-btn" data-format="bold" title="Bold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="italic" title="Italic">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="heading" title="Heading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4v16"></path><path d="M18 4v16"></path><path d="M6 12h12"></path></svg>
          </button>
          <span class="note-toolbar-divider"></span>
          <button type="button" class="note-format-btn" data-format="bullet" title="Bullet List">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><circle cx="4" cy="6" r="1" fill="currentColor"></circle><circle cx="4" cy="12" r="1" fill="currentColor"></circle><circle cx="4" cy="18" r="1" fill="currentColor"></circle></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="todo" title="To-do List">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="6" height="6" rx="1"></rect><path d="M11 7h10"></path><rect x="3" y="13" width="6" height="6" rx="1"></rect><path d="M11 15h10"></path></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="blockquote" title="Quote">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"></path></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="code" title="Code Block">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="divider" title="Divider">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <span class="note-toolbar-divider"></span>
          <button type="button" class="note-format-btn" id="modal-note-preview-toggle" title="Toggle Preview">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button type="button" class="note-format-btn" id="modal-note-color-btn" title="Background Color">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
          </button>
        </div>
        <textarea id="modal-note-content" class="modal-note-textarea" placeholder="Write your note...">${this.escapeHtml(save.content || save.notes || '')}</textarea>
        <div id="modal-note-preview" class="modal-note-preview hidden"></div>
      </div>
    `;
  }

  renderProductModalBody(save) {
    const siteLabel = save.site_name ? `Purchase at ${this.escapeHtml(save.site_name)}` : 'Purchase';
    const description = this.escapeHtml(save.excerpt || '');
    return `
      <div class="modal-product-view">
        <div class="modal-product-image">
          <img src="${save.image_url}" alt="${this.escapeHtml(save.title || 'Product')}">
        </div>
        <a href="${save.url || '#'}" target="_blank" class="modal-product-purchase">
          <img src="https://www.figma.com/api/mcp/asset/3908d328-f6ca-45a7-b406-24fa5ac56bb1" alt="">
          <span>${siteLabel}</span>
        </a>
        ${description ? `<div class="modal-product-description">${description}</div>` : ''}
      </div>
    `;
  }

  renderBookModalBody(save) {
    const description = save.excerpt || save.content || '';
    return `
      <div class="book-modal-layout">
        <!-- Left panel: Metadata on left side, Book cover on right side -->
        <div class="book-modal-left" id="book-modal-left">
          <div class="book-meta-section">
            ${save.author ? `
              <div class="book-meta-item">
                <svg class="book-meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <div class="book-meta-content">
                  <div class="book-meta-label">AUTHOR</div>
                  <div class="book-meta-value">${this.escapeHtml(save.author)}</div>
                </div>
              </div>
            ` : ''}
            ${save.book_page_count ? `
              <div class="book-meta-item">
                <svg class="book-meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <div class="book-meta-content">
                  <div class="book-meta-label">PAGE COUNT</div>
                  <div class="book-meta-value">${save.book_page_count} Pages</div>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="book-cover-section">
            <div class="book-cover-3d">
              <img src="${save.image_url}" alt="${this.escapeHtml(save.title)}" id="book-modal-cover">
            </div>
          </div>

          <button class="book-read-btn${save.read_status === 'finished' ? ' finished' : ''}" id="book-read-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${save.read_status === 'finished' ?
                '<polyline points="20 6 9 17 4 12"></polyline>' :
                '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>'
              }
            </svg>
            <span>${save.read_status === 'finished' ? 'Finished' : "I've read this book"}</span>
          </button>
        </div>

        <!-- Right panel: Title, TLDR, Tags, Notes (scrollable) -->
        <div class="book-modal-right">
          <button class="book-modal-close" id="book-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div class="book-modal-scroll">
            <div class="book-modal-header">
              <h1 class="book-modal-title">${this.escapeHtml(save.title || 'Untitled')}</h1>
              ${save.site_name ? `
                <a href="${save.url || '#'}" target="_blank" class="book-modal-source">
                  ${this.escapeHtml(save.site_name)}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 17L17 7"></path>
                    <path d="M7 7h10v10"></path>
                  </svg>
                </a>
              ` : ''}
            </div>

            ${description ? `
              <div class="book-tldr-section">
                <label class="book-section-label">TLDR</label>
                <div class="book-tldr-content" id="book-tldr-content">
                  <div class="book-tldr-text">${this.escapeHtml(description)}</div>
                </div>
              </div>
            ` : ''}

            <div class="book-tags-section">
              <label class="book-section-label">MIND TAGS <span class="book-section-icon">🧠</span></label>
              <div id="book-modal-tags" class="book-modal-tags"></div>
              <button class="book-add-tag-btn" id="book-add-tag-btn">+ Add tag</button>
              <div class="book-tag-input-wrapper hidden" id="book-tag-input-wrapper">
                <input type="text" class="book-tag-input" id="book-tag-input" placeholder="Enter tag name...">
                <button class="book-tag-add-btn" id="book-tag-submit-btn">Add</button>
              </div>
            </div>

            <div class="book-notes-section">
              <label class="book-section-label">MIND NOTES <span class="book-section-icon">📝</span></label>
              <textarea id="book-modal-notes" class="book-modal-notes" placeholder="Type here to add a note...">${this.escapeHtml(save.notes || '')}</textarea>
            </div>

            <div class="book-modal-actions">
              <button class="book-action-btn" id="book-delete-btn" title="Delete">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button class="book-action-btn" id="book-share-btn" title="Share">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
              </button>
              <button class="book-action-btn" id="book-more-btn" title="More">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="19" cy="12" r="1"></circle>
                  <circle cx="5" cy="12" r="1"></circle>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async initBookCoverColor(save) {
    if (!save.image_url) return;

    try {
      let dominantColor = save.dominant_color;

      // Extract and store dominant color if not already cached
      if (!dominantColor) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = save.image_url;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        dominantColor = this.extractDominantColor(imageData);

        // Store in database for future use
        await this.supabase
          .from('saves')
          .update({ dominant_color: dominantColor })
          .eq('id', save.id);

        save.dominant_color = dominantColor;
      }

      // Apply dominant color (toned down 30%) to the left panel
      const leftPanel = document.getElementById('book-modal-left');
      if (leftPanel && dominantColor) {
        // Tone down the color by mixing with dark gray
        const tonedColor = this.toneDownColor(dominantColor, 0.3);
        leftPanel.style.background = tonedColor;
      }
    } catch (e) {
      console.error('Failed to extract book cover color:', e);
    }
  }

  // Tone down a color by mixing it with a dark base
  toneDownColor(hexColor, amount) {
    // Parse hex color
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Mix with dark base (#3E3D52) - tone down by amount
    const darkR = 62, darkG = 61, darkB = 82;
    const newR = Math.round(r * (1 - amount) + darkR * amount);
    const newG = Math.round(g * (1 - amount) + darkG * amount);
    const newB = Math.round(b * (1 - amount) + darkB * amount);

    // Ensure the result is not too bright - cap at 60% brightness
    const brightness = (newR + newG + newB) / 3;
    if (brightness > 100) {
      const factor = 100 / brightness;
      return `rgb(${Math.round(newR * factor)}, ${Math.round(newG * factor)}, ${Math.round(newB * factor)})`;
    }

    return `rgb(${newR}, ${newG}, ${newB})`;
  }

  extractDominantColor(imageData) {
    const data = imageData.data;
    const colorCounts = {};

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip very light or very dark colors
      if (r > 240 && g > 240 && b > 240) continue;
      if (r < 20 && g < 20 && b < 20) continue;

      const key = `${Math.floor(r/10)*10},${Math.floor(g/10)*10},${Math.floor(b/10)*10}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    }

    // Find most common color
    let maxCount = 0;
    let dominantColor = '0,0,0';
    for (const [color, count] of Object.entries(colorCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    }

    return `rgb(${dominantColor})`;
  }

  attachBookModalEventListeners(save) {
    this.currentSave = save;

    // Populate tags
    this.populateBookModalTags(save);

    // Close button
    document.getElementById('book-modal-close')?.addEventListener('click', () => {
      this.closeUnifiedModal();
    });

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeUnifiedModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Delete button
    document.getElementById('book-delete-btn')?.addEventListener('click', async () => {
      if (confirm('Delete this book?')) {
        await this.supabase.from('saves').delete().eq('id', save.id);
        this.closeUnifiedModal();
        this.loadSaves();
        this.showToast('Book deleted', 'success');
      }
    });

    // Read status button
    document.getElementById('book-read-btn')?.addEventListener('click', async () => {
      const newStatus = save.read_status === 'finished' ? 'unread' : 'finished';
      await this.supabase
        .from('saves')
        .update({ read_status: newStatus })
        .eq('id', save.id);
      save.read_status = newStatus;

      const btn = document.getElementById('book-read-btn');
      if (btn) {
        btn.classList.toggle('finished', newStatus === 'finished');
        const iconSvg = btn.querySelector('svg');
        const textSpan = btn.querySelector('span');
        if (newStatus === 'finished') {
          iconSvg.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
          textSpan.textContent = 'Finished';
        } else {
          iconSvg.innerHTML = '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>';
          textSpan.textContent = "I've read this book";
        }
      }
      this.showToast(newStatus === 'finished' ? 'Marked as read!' : 'Marked as unread', 'success');
    });

    // Add tag button - toggle input form
    const addTagBtn = document.getElementById('book-add-tag-btn');
    const tagInputWrapper = document.getElementById('book-tag-input-wrapper');
    const tagInput = document.getElementById('book-tag-input');
    const tagSubmitBtn = document.getElementById('book-tag-submit-btn');

    addTagBtn?.addEventListener('click', () => {
      tagInputWrapper?.classList.toggle('hidden');
      if (!tagInputWrapper?.classList.contains('hidden')) {
        tagInput?.focus();
      }
    });

    // Submit tag
    const submitTag = async () => {
      const tagName = tagInput?.value?.trim();
      if (tagName) {
        await this.addTagByName(save, tagName);
        tagInput.value = '';
        tagInputWrapper?.classList.add('hidden');
        this.populateBookModalTags(save);
      }
    };

    tagSubmitBtn?.addEventListener('click', submitTag);
    tagInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitTag();
      }
    });

    // TLDR click to expand/collapse
    const tldrContent = document.getElementById('book-tldr-content');
    if (tldrContent) {
      tldrContent.addEventListener('click', () => {
        tldrContent.classList.toggle('expanded');
      });
    }

    // Notes auto-save
    const notesTextarea = document.getElementById('book-modal-notes');
    if (notesTextarea) {
      let saveTimeout;
      notesTextarea.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await this.supabase
            .from('saves')
            .update({ notes: notesTextarea.value })
            .eq('id', save.id);
          save.notes = notesTextarea.value;
        }, 500);
      });
    }

    // Share button
    document.getElementById('book-share-btn')?.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: save.title,
            url: save.url || window.location.href
          });
        } catch (e) {
          // User cancelled or share failed
        }
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(save.url || save.title);
        this.showToast('Link copied!', 'success');
      }
    });
  }

  async renderBookModalTags(save) {
    const container = document.getElementById('book-modal-tags');
    if (!container) return;

    const tags = this.saveTagMap[save.id] || [];
    if (tags.length === 0) {
      container.innerHTML = '<span class="no-tags" style="color: var(--text-muted); font-size: 13px;">No tags yet</span>';
      return;
    }
    container.innerHTML = tags.map(tag => `
      <span class="book-tag" data-tag-id="${tag.id}">${this.escapeHtml(tag.name)}</span>
    `).join('');
  }

  populateModalSidebar(save) {
    const saveType = this.getSaveType(save);

    this.updateModalSaveSummary(save);

    // Update button states
    document.getElementById('modal-archive-btn').classList.toggle('active', save.is_archived);
    this.updateModalContextMenuState(save);

    // Show/hide book-specific sections
    const tldrSection = document.getElementById('modal-tldr-section');
    const readStatusSection = document.getElementById('modal-read-status-section');

    if (saveType === 'book') {
      // Show TLDR section if excerpt exists
      if (save.excerpt || save.content) {
        tldrSection.classList.remove('hidden');
        const tldrContent = save.excerpt || (save.content ? save.content.substring(0, 300) + '...' : '');
        document.getElementById('modal-tldr-content').textContent = tldrContent;
      } else {
        tldrSection.classList.add('hidden');
      }

      // Show reading status dropdown
      readStatusSection.classList.remove('hidden');
      document.getElementById('modal-read-status-select').value = save.read_status || 'unread';
    } else {
      tldrSection.classList.add('hidden');
      readStatusSection.classList.add('hidden');
    }

    // Load and display tags
    this.loadModalTags(save);

    // Populate notes
    document.getElementById('modal-notes-textarea').value = save.notes || '';
    document.getElementById('modal-notes-status').textContent = '';
  }

  async loadModalTags(save) {
    const tagsList = document.getElementById('modal-tags-list');
    if (!tagsList) return;

    const saveTags = this.saveTagMap[save.id] || [];
    const saveType = this.getSaveType(save);
    const saveTypePill = this.renderModalSaveTypePill(saveType);
    const spacePill = this.renderModalSpacePill(save.folder_id);

    const tagPills = saveTags.map(tag => {
      const color = '#FF794E';
      const bg = '#FF794E';
      return `
        <span class="modal-tag-pill" style="--tag-color: ${color}; --tag-bg: ${bg}">
          <span class="modal-tag-text">${this.escapeHtml(tag.name)}</span>
          <button class="modal-tag-remove" data-tag-id="${tag.id}" title="Remove tag">×</button>
        </span>
      `;
    }).join('');

    tagsList.innerHTML = saveTypePill + spacePill + tagPills;

    tagsList.querySelector('.modal-save-type-pill')?.addEventListener('click', () => {
      this.filterBySaveType(saveType);
      this.closeUnifiedModal();
    });

    tagsList.querySelectorAll('.modal-tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTagFromSave(save.id, btn.dataset.tagId);
      });
    });
  }

  updateModalSaveSummary(save) {
    const titleEl = document.getElementById('modal-save-title');
    const dateEl = document.getElementById('modal-save-date');
    const sourceEl = document.getElementById('modal-save-source');
    const sourceTextEl = document.getElementById('modal-save-source-text');
    const separatorEl = document.getElementById('modal-save-separator');
    if (!titleEl || !dateEl || !sourceEl || !sourceTextEl || !separatorEl) return;

    const displayTitle = this.getSaveDisplayTitle(save);
    titleEl.textContent = displayTitle;
    titleEl.dataset.originalTitle = displayTitle;

    const saveDate = new Date(save.created_at);
    dateEl.textContent = saveDate.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });

    if (save.url) {
      const sourceLabel = this.getSourceLabel(save.url);
      sourceTextEl.textContent = sourceLabel;
      sourceEl.href = save.url;
      sourceEl.classList.remove('hidden');
      separatorEl.classList.remove('hidden');
    } else {
      sourceEl.classList.add('hidden');
      separatorEl.classList.add('hidden');
    }

    titleEl.onfocus = () => {
      titleEl.dataset.originalTitle = titleEl.textContent.trim();
    };

    titleEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl.blur();
      }
    };

    titleEl.onblur = async () => {
      const nextTitle = titleEl.textContent.trim() || 'Untitled';
      const original = titleEl.dataset.originalTitle || '';
      if (nextTitle !== original) {
        await this.updateSaveTitle(save, nextTitle);
        titleEl.dataset.originalTitle = nextTitle;
      } else {
        titleEl.textContent = nextTitle;
      }
    };
  }

  getSaveDisplayTitle(save) {
    if (save?.title?.trim()) return save.title.trim();

    const saveType = this.getSaveType(save);
    if (saveType === 'product' && save.product_name) {
      return save.product_name;
    }
    if (saveType === 'book' && save.book_title) {
      return save.book_title;
    }
    if (saveType === 'image') {
      const filename = this.getFilenameFromUrl(save.image_url || save.url);
      if (filename) return filename;
    }

    return 'Untitled';
  }

  getFilenameFromUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const filename = parts[parts.length - 1];
      return filename ? decodeURIComponent(filename) : '';
    } catch (e) {
      return '';
    }
  }

  getSourceLabel(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return this.getPrimaryDomain(host);
    } catch (e) {
      return '';
    }
  }

  getPrimaryDomain(host) {
    if (!host) return '';
    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) {
      return parts[0] || host;
    }

    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    const third = parts[parts.length - 3];

    const commonSecondLevel = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'io']);
    if (commonSecondLevel.has(sld) && third) {
      return third;
    }

    return sld || host;
  }

  async updateSaveTitle(save, title) {
    const { error } = await this.supabase
      .from('saves')
      .update({ title })
      .eq('id', save.id);

    if (!error) {
      save.title = title;
      const modalTitle = document.getElementById('modal-title');
      if (modalTitle) modalTitle.textContent = title;
      this.loadSaves();
    }
  }

  attachModalEventListeners(save) {
    const modal = document.getElementById('unified-modal');
    const overlay = modal?.querySelector('.modal-overlay');
    const modalContainer = modal?.querySelector('.modal-container');

    const closeModal = () => this.closeUnifiedModal();

    if (overlay) {
      overlay.onclick = closeModal;
      overlay.addEventListener('click', closeModal, { capture: true, once: true });
    }

    // Escape key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    if (this.modalOutsideClickHandler) {
      document.removeEventListener('click', this.modalOutsideClickHandler);
      this.modalOutsideClickHandler = null;
    }

    let ignoreOutsideClick = true;
    setTimeout(() => {
      ignoreOutsideClick = false;
    }, 0);

    this.modalOutsideClickHandler = (e) => {
      if (ignoreOutsideClick) return;
      if (!modal || modal.classList.contains('hidden')) return;
      if (e.target.closest('.context-menu')) return;
      if (modalContainer && !modalContainer.contains(e.target)) {
        closeModal();
      }
    };
    document.addEventListener('click', this.modalOutsideClickHandler);

    this.bindModalSwipeToClose(modalContainer, closeModal);

    // Action buttons
    document.getElementById('modal-archive-btn').onclick = () => this.toggleModalArchive(save);
    document.getElementById('modal-share-btn').onclick = () => this.showModalSharePanel(save);
    document.getElementById('modal-more-btn').onclick = (e) => {
      e.stopPropagation();
      this.showModalContextMenu(save);
    };

    // Notes textarea with auto-save
    const notesTextarea = document.getElementById('modal-notes-textarea');
    let notesTimeout;
    notesTextarea.oninput = () => {
      clearTimeout(notesTimeout);
      notesTimeout = setTimeout(() => this.saveModalNotes(save), 1000);
    };

    // Add tag button
    this.bindModalTagInput(save);

    // Image-specific actions
    if (this.getSaveType(save) === 'image') {
      const similarBtn = document.getElementById('modal-image-similar');
      const autotagBtn = document.getElementById('modal-image-autotag');

      if (similarBtn) {
        similarBtn.onclick = () => this.findSimilarImages(save);
      }

      if (autotagBtn) {
        autotagBtn.onclick = async () => {
          try {
            autotagBtn.textContent = 'TAGGING...';
            autotagBtn.disabled = true;

            const { data, error } = await this.supabase.functions.invoke('auto-tag-image', {
              body: {
                save_id: save.id,
                user_id: this.user.id,
                image_url: save.image_url
              }
            });

            if (error) {
              console.error('Auto-tag error:', error);
              this.showToast(`Auto-tag failed: ${error.message || 'Unknown error'}`, 'error');
              autotagBtn.textContent = 'Auto-tag';
              autotagBtn.disabled = false;
              return;
            }

            // Reload tags to show newly added ones
            await this.loadModalTags(save);

            const tagCount = data?.tags?.length || 0;
            if (tagCount > 0) {
              this.showToast(`Added ${tagCount} tag${tagCount > 1 ? 's' : ''}!`, 'success');
            } else {
              this.showToast('No tags generated', 'info');
            }

            autotagBtn.textContent = 'Auto-tag';
            autotagBtn.disabled = false;
          } catch (err) {
            console.error('Auto-tag exception:', err);
            this.showToast('Auto-tag failed', 'error');
            autotagBtn.textContent = 'Auto-tag';
            autotagBtn.disabled = false;
          }
        };
      }
    }

    // Note-specific actions
    if (this.getSaveType(save) === 'note') {
      const noteContent = document.getElementById('modal-note-content');
      const notePreview = document.getElementById('modal-note-preview');
      const previewToggle = document.getElementById('modal-note-preview-toggle');
      const colorBtn = document.getElementById('modal-note-color-btn');

      // Store note state for color updates
      this.editingNote = save;
      this.editNoteColor = save.note_color || null;
      this.editNoteGradient = save.note_gradient || null;

      if (noteContent) {
        noteContent.oninput = () => {
          clearTimeout(notesTimeout);
          notesTimeout = setTimeout(() => this.saveModalNoteContent(save), 1000);
        };
      }

      // Formatting buttons
      document.querySelectorAll('.note-format-btn[data-format]').forEach(btn => {
        btn.onclick = () => {
          const format = btn.dataset.format;
          if (noteContent && format) {
            this.insertNoteFormatting(noteContent, format);
          }
        };
      });

      // Preview toggle
      if (previewToggle) {
        previewToggle.onclick = () => {
          const isShowingPreview = !notePreview.classList.contains('hidden');
          if (isShowingPreview) {
            notePreview.classList.add('hidden');
            noteContent.classList.remove('hidden');
            noteContent.focus();
          } else {
            notePreview.innerHTML = this.renderMarkdown(noteContent.value || '');
            notePreview.classList.remove('hidden');
            noteContent.classList.add('hidden');
          }
        };
      }

      // Color button
      if (colorBtn) {
        colorBtn.onclick = () => this.showEditNoteColorPicker();
      }
    }

    // Book-specific actions
    if (this.getSaveType(save) === 'book') {
      const readStatusSelect = document.getElementById('modal-read-status-select');
      if (readStatusSelect) {
        readStatusSelect.onchange = async (e) => {
          await this.updateBookReadStatus(save, e.target.value);
        };
      }
    }
  }

  closeUnifiedModal() {
    const modal = document.getElementById('unified-modal');
    modal.classList.add('hidden');

    // Reset modal container background
    const modalContainer = document.querySelector('.modal-container');
    modalContainer.style.background = '';

    // Stop audio
    this.stopAudio();

    this.hideModalContextMenu();
    this.hideModalSharePanel();
    this.closeModalTagInput();

    if (this.modalSwipeCleanup) {
      this.modalSwipeCleanup();
      this.modalSwipeCleanup = null;
    }

    if (this.modalOutsideClickHandler) {
      document.removeEventListener('click', this.modalOutsideClickHandler);
      this.modalOutsideClickHandler = null;
    }

    this.currentSave = null;
  }

  bindModalSwipeToClose(container, closeModal) {
    if (!container) return;
    if (this.modalSwipeCleanup) {
      this.modalSwipeCleanup();
      this.modalSwipeCleanup = null;
    }

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse') return;
      isDragging = true;
      startY = e.clientY;
      currentY = 0;
      container.style.transition = 'none';
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      currentY = e.clientY - startY;
      if (currentY > 0) {
        container.style.transform = `translateY(${currentY}px)`;
      }
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.transition = 'transform 0.2s ease';
      if (currentY > 120) {
        container.style.transform = '';
        closeModal();
      } else {
        container.style.transform = '';
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    this.modalSwipeCleanup = () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.style.transition = '';
      container.style.transform = '';
    };
  }

  async toggleModalPin(save) {
    const newPinState = !save.is_pinned;

    const { error } = await this.supabase
      .from('saves')
      .update({
        is_pinned: newPinState,
        pinned_at: newPinState ? new Date().toISOString() : null
      })
      .eq('id', save.id);

    if (!error) {
      save.is_pinned = newPinState;
      this.updateModalContextMenuState(save);
      this.loadPinnedSaves();
      this.loadSaves();
    }
  }

  async toggleModalFavorite(save) {
    const newFavState = !save.is_favorite;

    const { error } = await this.supabase
      .from('saves')
      .update({ is_favorite: newFavState })
      .eq('id', save.id);

    if (!error) {
      save.is_favorite = newFavState;
      this.updateModalContextMenuState(save);
      this.loadSaves();
    }
  }

  bindModalTagInput(save) {
    const actionBtn = document.getElementById('modal-tag-action-btn');
    const inputWrapper = document.getElementById('modal-tag-input-wrapper');
    const input = document.getElementById('modal-tag-input');
    if (!actionBtn || !inputWrapper || !input) return;

    this.modalTagSave = save;

    actionBtn.onclick = (e) => {
      e.stopPropagation();
      if (inputWrapper.classList.contains('hidden')) {
        this.openModalTagInput();
        return;
      }

      if (input.value.trim()) {
        this.saveModalTag();
      } else {
        input.focus();
      }
    };

    input.oninput = () => {
      this.updateModalTagActionLabel();
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (input.value.trim()) {
          this.saveModalTag();
        }
      }
    };
  }

  openModalTagInput() {
    const inputWrapper = document.getElementById('modal-tag-input-wrapper');
    const input = document.getElementById('modal-tag-input');
    if (!inputWrapper || !input) return;

    inputWrapper.classList.remove('hidden');
    input.value = '';
    input.focus();
    this.updateModalTagActionLabel();

    if (!this.modalTagOutsideHandler) {
      this.modalTagOutsideHandler = (e) => {
        const container = document.getElementById('modal-tags-section');
        if (!container || container.contains(e.target)) return;
        this.closeModalTagInput();
      };
      document.addEventListener('click', this.modalTagOutsideHandler);
    }
  }

  closeModalTagInput() {
    const inputWrapper = document.getElementById('modal-tag-input-wrapper');
    const input = document.getElementById('modal-tag-input');
    if (inputWrapper) inputWrapper.classList.add('hidden');
    if (input) input.value = '';
    this.updateModalTagActionLabel();

    if (this.modalTagOutsideHandler) {
      document.removeEventListener('click', this.modalTagOutsideHandler);
      this.modalTagOutsideHandler = null;
    }
  }

  updateModalTagActionLabel() {
    const actionBtn = document.getElementById('modal-tag-action-btn');
    const inputWrapper = document.getElementById('modal-tag-input-wrapper');
    const input = document.getElementById('modal-tag-input');
    if (!actionBtn || !inputWrapper || !input) return;

    if (inputWrapper.classList.contains('hidden')) {
      actionBtn.textContent = '+ Add tag';
      return;
    }

    actionBtn.textContent = input.value.trim() ? '+ Save tag' : '+ Add tag';
  }

  async saveModalTag() {
    const input = document.getElementById('modal-tag-input');
    const save = this.modalTagSave;
    if (!input || !save) return;

    const tagName = input.value.trim();
    if (!tagName) return;

    await this.addTagByName(save, tagName);
    await this.loadModalTags(save);
    this.closeModalTagInput();
  }

  async toggleModalArchive(save) {
    const newArchiveState = !save.is_archived;

    const { error } = await this.supabase
      .from('saves')
      .update({ is_archived: newArchiveState })
      .eq('id', save.id);

    if (!error) {
      save.is_archived = newArchiveState;
      document.getElementById('modal-archive-btn').classList.toggle('active', newArchiveState);
      this.closeUnifiedModal();
      this.loadSaves();
    }
  }

  async deleteModalSave(save) {
    const { error } = await this.supabase
      .from('saves')
      .delete()
      .eq('id', save.id);

    if (!error) {
      this.closeUnifiedModal();
      this.loadSaves();
      this.loadPinnedSaves();
    }
  }

  async updateBookReadStatus(save, status) {
    const { error } = await this.supabase
      .from('saves')
      .update({
        read_status: status
      })
      .eq('id', save.id);

    if (!error) {
      save.read_status = status;
    }
  }

  async updateModalFolder(save, folderId) {
    const { error } = await this.supabase
      .from('saves')
      .update({ folder_id: folderId || null })
      .eq('id', save.id);

    if (!error) {
      save.folder_id = folderId || null;
      this.loadSaves();
    }
  }

  async saveModalNotes(save) {
    const notes = document.getElementById('modal-notes-textarea').value;
    const status = document.getElementById('modal-notes-status');

    status.textContent = 'Saving...';

    const { error } = await this.supabase
      .from('saves')
      .update({ notes })
      .eq('id', save.id);

    if (!error) {
      save.notes = notes;
      status.textContent = 'Saved';
      setTimeout(() => status.textContent = '', 2000);
    } else {
      status.textContent = 'Error saving';
    }
  }

  async saveModalNoteContent(save) {
    const content = document.getElementById('modal-note-content').value;

    const { error } = await this.supabase
      .from('saves')
      .update({
        content,
        notes: content,
        excerpt: content.slice(0, 180),
        note_color: this.editNoteColor,
        note_gradient: this.editNoteGradient,
      })
      .eq('id', save.id);

    if (!error) {
      save.content = content;
      save.notes = content;
      save.excerpt = content.slice(0, 180);
      save.note_color = this.editNoteColor;
      save.note_gradient = this.editNoteGradient;
      this.loadSaves();
    }
  }

  insertNoteFormatting(textarea, format) {
    // Map format names to markdown actions
    const formatMap = {
      'bold': 'bold',
      'italic': 'italic',
      'heading': 'heading',
      'bullet': 'list',
      'todo': 'task',
      'blockquote': 'blockquote',
      'code': 'code',
      'divider': 'divider'
    };

    const action = formatMap[format];
    if (action) {
      this.insertMarkdownFormatting(textarea, action);
      // Trigger auto-save after formatting
      textarea.dispatchEvent(new Event('input'));
    }
  }

  async updateNoteColor(save, color) {
    const { error } = await this.supabase
      .from('saves')
      .update({ note_color: color })
      .eq('id', save.id);

    if (!error) {
      save.note_color = color;
      this.loadSaves();
    }
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

    if (this.currentSave?.id === saveId) {
      this.loadModalTags(this.currentSave);
    }
  }

  async addTagByName(save, tagName) {
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
      // Check if tag already added
      const { data: existing } = await this.supabase
        .from('save_tags')
        .select('*')
        .eq('save_id', save.id)
        .eq('tag_id', existingTag.id)
        .single();

      if (!existing) {
        await this.supabase
          .from('save_tags')
          .insert({ save_id: save.id, tag_id: existingTag.id });
      }

      this.loadTags();
      await this.loadSaveTagMapForSaves(this.saves);
      if (this.showAnnotations) this.renderSaves();
      this.showToast('Tag added', 'success');

      if (this.currentSave?.id === save.id) {
        this.loadModalTags(this.currentSave);
      }
    }
  }

  async populateBookModalTags(save) {
    const container = document.getElementById('book-modal-tags');
    if (!container) return;

    // Fetch tags for this save
    const { data } = await this.supabase
      .from('save_tags')
      .select('tag_id, tags(id, name, color)')
      .eq('save_id', save.id);

    const tags = data || [];

    if (tags.length === 0) {
      container.innerHTML = '<span class="no-tags" style="color: var(--text-muted); font-size: 13px;">No tags yet</span>';
      return;
    }

    container.innerHTML = tags.map(st => `
      <span class="book-tag" data-tag-id="${st.tags.id}">${this.escapeHtml(st.tags.name)}</span>
    `).join('');
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

  formatPrice(price, currency) {
    if (!price) return '';
    const currencySymbols = {
      'USD': '$',
      'GBP': '£',
      'EUR': '€',
      'JPY': '¥',
      'CNY': '¥',
      'KRW': '₩',
      'INR': '₹',
      'AUD': 'A$',
      'CAD': 'C$',
    };
    const symbol = currencySymbols[currency] || (currency ? `${currency} ` : '');
    return `${symbol}${price}`;
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

  renderMarkdownPreview(text, maxLines = 8) {
    if (!text) return '';

    // Truncate to approximate number of lines (rough estimate)
    const lines = text.split('\n');
    const truncated = lines.slice(0, maxLines).join('\n');
    const wasTruncated = lines.length > maxLines;

    // Render markdown
    let html = this.renderMarkdown(truncated);

    // Add ellipsis if truncated
    if (wasTruncated) {
      html += '<span class="note-truncated">...</span>';
    }

    return html;
  }

  bindTaskCheckboxes(container) {
    container.querySelectorAll('.task-list-item input[type="checkbox"]').forEach(checkbox => {
      // Add our custom class for styling
      checkbox.classList.add('task-checkbox');

      checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();

        const card = checkbox.closest('.save-card');
        if (!card) return;

        const saveId = card.dataset.id;
        const save = this.saves.find(s => s.id === saveId);
        if (!save) return;

        await this.toggleTaskInNote(save, checkbox);
      });
    });
  }

  async toggleTaskInNote(save, checkbox) {
    let content = save.content || save.notes || '';
    const lines = content.split('\n');

    // Find which checkbox index was clicked
    const card = checkbox.closest('.save-card');
    const allCheckboxes = card.querySelectorAll('.task-checkbox');
    const checkboxIndex = Array.from(allCheckboxes).indexOf(checkbox);

    // Find and toggle the matching task in the content
    let taskIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^(\s*)?[-*]\s*\[([ xX])\]/)) {
        if (taskIndex === checkboxIndex) {
          const isChecked = checkbox.checked;
          lines[i] = lines[i].replace(
            /^(\s*)?([-*])\s*\[([ xX])\]/,
            isChecked ? '$1$2 [x]' : '$1$2 [ ]'
          );
          break;
        }
        taskIndex++;
      }
    }

    const newContent = lines.join('\n');

    try {
      await this.supabase
        .from('saves')
        .update({
          content: newContent,
          notes: newContent,
        })
        .eq('id', save.id);

      // Update local state
      save.content = newContent;
      save.notes = newContent;
    } catch (err) {
      console.error('Error updating task:', err);
      // Revert checkbox state on error
      checkbox.checked = !checkbox.checked;
    }
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

  // ===================================
  // Quick Note Feature
  // ===================================

  bindQuickNoteEvents() {
    const textarea = document.getElementById('quick-note-textarea');
    const saveBtn = document.getElementById('quick-note-save-btn');
    const expandBtn = document.getElementById('quick-note-expand-btn');
    const colorBtn = document.getElementById('quick-note-color-btn');
    const colorPicker = document.getElementById('quick-note-color-picker');
    const charCount = document.getElementById('quick-note-char-count');
    const quickNoteInput = document.getElementById('quick-note-input');
    const quickNoteFooter = document.querySelector('.quick-note-footer');

    // Textarea input - show/hide save button based on content
    if (textarea) {
      textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        if (charCount) {
          charCount.textContent = len > 0 ? `${len}` : '';
        }
        // Show/hide footer based on content
        if (quickNoteFooter) {
          const wasHidden = quickNoteFooter.classList.contains('hidden');
          if (len > 0) {
            quickNoteFooter.classList.remove('hidden');
            quickNoteInput?.classList.add('has-content');
          } else {
            quickNoteFooter.classList.add('hidden');
            quickNoteInput?.classList.remove('has-content');
          }
          // Trigger Masonry layout update if footer visibility changed
          const isHidden = quickNoteFooter.classList.contains('hidden');
          if (wasHidden !== isHidden && this.masonry) {
            setTimeout(() => this.masonry.layout(), 10);
          }
        }
        // Auto-resize textarea
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
        // Also trigger Masonry layout for height changes
        if (this.masonry) {
          setTimeout(() => this.masonry.layout(), 10);
        }
      });

      // Also handle focus to ensure layout updates
      textarea.addEventListener('focus', () => {
        if (this.masonry) {
          setTimeout(() => this.masonry.layout(), 50);
        }
      });
    }

    // Save button
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveQuickNoteToGrid());
    }

    // Expand button
    if (expandBtn) {
      expandBtn.addEventListener('click', () => this.showQuickNoteModal());
    }

    // Color picker toggle
    if (colorBtn && colorPicker) {
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        colorPicker.classList.toggle('hidden');
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!colorPicker.contains(e.target) && !colorBtn.contains(e.target)) {
          colorPicker.classList.add('hidden');
        }
      });
    }

    // Color presets
    document.querySelectorAll('.color-preset').forEach(preset => {
      preset.addEventListener('click', () => {
        this.setPendingNoteColor(preset.dataset.color, null);
        this.updateColorSelection();
      });
    });

    // Gradient presets
    document.querySelectorAll('.gradient-preset').forEach(preset => {
      preset.addEventListener('click', () => {
        this.setPendingNoteColor(null, preset.dataset.gradient);
        this.updateColorSelection();
      });
    });

    // Hex color picker
    const hexPicker = document.getElementById('quick-note-hex-picker');
    const hexInput = document.getElementById('quick-note-hex-input');

    if (hexPicker) {
      hexPicker.addEventListener('input', (e) => {
        this.setPendingNoteColor(e.target.value, null);
        if (hexInput) hexInput.value = e.target.value;
      });
    }

    if (hexInput) {
      hexInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
          this.setPendingNoteColor(value, null);
          if (hexPicker) hexPicker.value = value;
        }
      });
    }

    // Modal events
    this.bindQuickNoteModalEvents();
  }

  bindQuickNoteKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      // Cmd+J (Mac) or Ctrl+J (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        this.focusQuickNote();
      }
    });
  }

  focusQuickNote() {
    const textarea = document.getElementById('quick-note-textarea');
    if (textarea) {
      textarea.focus();
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  setPendingNoteColor(color, gradient) {
    this.pendingNoteColor = color;
    this.pendingNoteGradient = gradient;
    this.updateColorIndicator();
  }

  updateColorIndicator() {
    const indicator = document.getElementById('color-indicator');
    const modalIndicator = document.getElementById('modal-color-indicator');

    [indicator, modalIndicator].forEach(el => {
      if (!el) return;
      if (this.pendingNoteGradient) {
        el.style.background = this.pendingNoteGradient;
        el.classList.add('has-color');
      } else if (this.pendingNoteColor) {
        el.style.background = this.pendingNoteColor;
        el.classList.add('has-color');
      } else {
        el.style.background = '';
        el.classList.remove('has-color');
      }
    });
  }

  updateColorSelection() {
    document.querySelectorAll('.color-preset, .gradient-preset').forEach(el => {
      el.classList.remove('active');
    });

    if (this.pendingNoteGradient) {
      const match = document.querySelector(`.gradient-preset[data-gradient="${this.pendingNoteGradient}"]`);
      if (match) match.classList.add('active');
    } else if (this.pendingNoteColor) {
      const match = document.querySelector(`.color-preset[data-color="${this.pendingNoteColor}"]`);
      if (match) match.classList.add('active');
    }
  }

  async saveQuickNoteToGrid() {
    const textarea = document.getElementById('quick-note-textarea');
    const modalTextarea = document.getElementById('quick-note-modal-textarea');
    const titleInput = document.getElementById('quick-note-title');
    const modalTitleInput = document.getElementById('quick-note-modal-title');

    const content = (modalTextarea && !modalTextarea.closest('.hidden')
      ? modalTextarea.value
      : textarea?.value || '').trim();

    if (!content) return;

    // Get title from the active input (modal or sticky)
    const customTitle = (modalTitleInput && !modalTitleInput.closest('.hidden')
      ? modalTitleInput.value
      : titleInput?.value || '').trim();

    const saveBtn = document.getElementById('quick-note-save-btn');
    const modalSaveBtn = document.getElementById('quick-note-modal-save');

    // Disable buttons while saving
    if (saveBtn) saveBtn.disabled = true;
    if (modalSaveBtn) modalSaveBtn.disabled = true;

    try {
      const payload = {
        user_id: this.user.id,
        title: customTitle || 'Quick Note',
        content: content,
        notes: content,
        excerpt: content.slice(0, 180),
        site_name: 'Note',
        source: 'manual',
        note_color: this.pendingNoteColor,
        note_gradient: this.pendingNoteGradient,
      };

      const { error } = await this.supabase.from('saves').insert(payload);

      if (error) throw error;

      // Clear input for next note
      if (textarea) {
        textarea.value = '';
        textarea.style.height = 'auto';
      }
      if (modalTextarea) modalTextarea.value = '';
      if (titleInput) titleInput.value = '';
      if (modalTitleInput) modalTitleInput.value = '';

      const charCount = document.getElementById('quick-note-char-count');
      if (charCount) charCount.textContent = '';

      // Reset color selection
      this.pendingNoteColor = null;
      this.pendingNoteGradient = null;
      this.updateColorIndicator();
      this.updateColorSelection();

      // Hide modal if open
      this.hideQuickNoteModal();

      // Reload saves to show new note in grid
      await this.loadSaves();

    } catch (err) {
      console.error('Quick note save error:', err);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
      if (modalSaveBtn) modalSaveBtn.disabled = false;
    }
  }

  bindQuickNoteModalEvents() {
    const modal = document.getElementById('quick-note-modal');
    if (!modal) return;

    const overlay = modal.querySelector('.modal-overlay');
    const closeBtn = document.getElementById('quick-note-modal-close');
    const cancelBtn = document.getElementById('quick-note-modal-cancel');
    const saveBtn = document.getElementById('quick-note-modal-save');
    const previewToggle = document.getElementById('quick-note-preview-toggle');

    overlay?.addEventListener('click', () => this.hideQuickNoteModal());
    closeBtn?.addEventListener('click', () => this.hideQuickNoteModal());
    cancelBtn?.addEventListener('click', () => this.hideQuickNoteModal());

    saveBtn?.addEventListener('click', () => this.saveQuickNoteToGrid());

    // Preview toggle
    previewToggle?.addEventListener('click', () => this.toggleQuickNotePreview());

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this.hideQuickNoteModal();
      }
    });
  }

  showQuickNoteModal() {
    const modal = document.getElementById('quick-note-modal');
    const textarea = document.getElementById('quick-note-modal-textarea');
    const stickyTextarea = document.getElementById('quick-note-textarea');
    const titleInput = document.getElementById('quick-note-modal-title');
    const stickyTitleInput = document.getElementById('quick-note-title');
    const preview = document.getElementById('quick-note-modal-preview');

    if (!modal) return;

    // Sync content from sticky note input
    if (textarea && stickyTextarea) {
      textarea.value = stickyTextarea.value;
    }

    // Sync title from sticky note input
    if (titleInput && stickyTitleInput) {
      titleInput.value = stickyTitleInput.value;
    }

    // Reset to edit mode
    preview?.classList.add('hidden');
    textarea?.classList.remove('hidden');

    // Update preview toggle button text
    const previewToggle = document.getElementById('quick-note-preview-toggle');
    if (previewToggle) {
      previewToggle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Preview
      `;
    }

    modal.classList.remove('hidden');
    textarea?.focus();
  }

  hideQuickNoteModal() {
    const modal = document.getElementById('quick-note-modal');
    const modalTextarea = document.getElementById('quick-note-modal-textarea');
    const stickyTextarea = document.getElementById('quick-note-textarea');
    const modalTitleInput = document.getElementById('quick-note-modal-title');
    const stickyTitleInput = document.getElementById('quick-note-title');

    // Sync content back to sticky note input
    if (modalTextarea && stickyTextarea && !modal?.classList.contains('hidden')) {
      stickyTextarea.value = modalTextarea.value;
      // Update char count
      const charCount = document.getElementById('quick-note-char-count');
      if (charCount) {
        const len = stickyTextarea.value.length;
        charCount.textContent = len > 0 ? `${len}` : '';
      }
    }

    // Sync title back to sticky note input
    if (modalTitleInput && stickyTitleInput && !modal?.classList.contains('hidden')) {
      stickyTitleInput.value = modalTitleInput.value;
    }

    modal?.classList.add('hidden');
  }

  toggleQuickNotePreview() {
    const textarea = document.getElementById('quick-note-modal-textarea');
    const preview = document.getElementById('quick-note-modal-preview');
    const previewToggle = document.getElementById('quick-note-preview-toggle');

    if (!textarea || !preview) return;

    const isShowingPreview = !preview.classList.contains('hidden');

    if (isShowingPreview) {
      // Switch to edit mode
      preview.classList.add('hidden');
      textarea.classList.remove('hidden');
      if (previewToggle) {
        previewToggle.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Preview
        `;
      }
      textarea.focus();
    } else {
      // Switch to preview mode
      const content = textarea.value || '';
      preview.innerHTML = this.renderMarkdown(content);
      preview.classList.remove('hidden');
      textarea.classList.add('hidden');
      if (previewToggle) {
        previewToggle.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        `;
      }
    }
  }

  // Edit Note Modal Methods
  bindEditNoteModal() {
    const modal = document.getElementById('edit-note-modal');
    if (!modal) return;

    const overlay = modal.querySelector('.modal-overlay');
    const closeBtn = document.getElementById('edit-note-modal-close');
    const cancelBtn = document.getElementById('edit-note-modal-cancel');
    const saveBtn = document.getElementById('edit-note-modal-save');
    const previewToggle = document.getElementById('edit-note-preview-toggle');
    const colorBtn = document.getElementById('edit-note-color-btn');

    overlay?.addEventListener('click', () => this.hideEditNoteModal());
    closeBtn?.addEventListener('click', () => this.hideEditNoteModal());
    cancelBtn?.addEventListener('click', () => this.hideEditNoteModal());
    saveBtn?.addEventListener('click', () => this.saveEditedNote());
    previewToggle?.addEventListener('click', () => this.toggleEditNotePreview());

    // Color button opens the color picker
    colorBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showEditNoteColorPicker();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this.hideEditNoteModal();
      }
    });
  }

  openEditNoteModal(save) {
    const modal = document.getElementById('edit-note-modal');
    if (!modal) return;

    this.editingNote = save;

    // Populate fields
    const titleInput = document.getElementById('edit-note-title');
    const textarea = document.getElementById('edit-note-textarea');
    const preview = document.getElementById('edit-note-preview');

    if (titleInput) titleInput.value = save.title || '';
    if (textarea) textarea.value = save.content || save.notes || '';
    if (preview) preview.classList.add('hidden');
    if (textarea) textarea.classList.remove('hidden');

    // Store current color
    this.editNoteColor = save.note_color || null;
    this.editNoteGradient = save.note_gradient || null;
    this.updateEditNoteColorIndicator();

    // Reset preview toggle button
    const previewToggle = document.getElementById('edit-note-preview-toggle');
    if (previewToggle) {
      previewToggle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Preview
      `;
    }

    modal.classList.remove('hidden');
    textarea?.focus();
  }

  hideEditNoteModal() {
    const modal = document.getElementById('edit-note-modal');
    modal?.classList.add('hidden');
    this.editingNote = null;
    this.hideEditNoteColorPicker();
  }

  async saveEditedNote() {
    if (!this.editingNote) return;

    const titleInput = document.getElementById('edit-note-title');
    const textarea = document.getElementById('edit-note-textarea');

    const title = (titleInput?.value || '').trim() || 'Quick Note';
    const content = (textarea?.value || '').trim();

    if (!content) return;

    const saveBtn = document.getElementById('edit-note-modal-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      const { error } = await this.supabase
        .from('saves')
        .update({
          title,
          content,
          notes: content,
          excerpt: content.slice(0, 180),
          note_color: this.editNoteColor,
          note_gradient: this.editNoteGradient,
        })
        .eq('id', this.editingNote.id);

      if (error) throw error;

      this.hideEditNoteModal();
      await this.loadSaves();

    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  }

  toggleEditNotePreview() {
    const textarea = document.getElementById('edit-note-textarea');
    const preview = document.getElementById('edit-note-preview');
    const previewToggle = document.getElementById('edit-note-preview-toggle');

    if (!textarea || !preview) return;

    const isShowingPreview = !preview.classList.contains('hidden');

    if (isShowingPreview) {
      // Switch to edit mode
      preview.classList.add('hidden');
      textarea.classList.remove('hidden');
      if (previewToggle) {
        previewToggle.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Preview
        `;
      }
      textarea.focus();
    } else {
      // Switch to preview mode
      const content = textarea.value || '';
      preview.innerHTML = this.renderMarkdown(content);
      preview.classList.remove('hidden');
      textarea.classList.add('hidden');
      if (previewToggle) {
        previewToggle.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit
        `;
      }
    }
  }

  updateEditNoteColorIndicator() {
    const indicator = document.getElementById('edit-note-color-indicator');
    if (!indicator) return;

    if (this.editNoteGradient) {
      indicator.style.background = this.editNoteGradient;
      indicator.classList.add('has-color');
    } else if (this.editNoteColor) {
      indicator.style.background = this.editNoteColor;
      indicator.classList.add('has-color');
    } else {
      indicator.style.background = '';
      indicator.classList.remove('has-color');
    }
  }

  showEditNoteColorPicker() {
    // Reuse the existing color picker UI, just reposition and bind for edit modal
    const colorPicker = document.getElementById('quick-note-color-picker');
    const colorBtn = document.getElementById('edit-note-color-btn');

    if (!colorPicker || !colorBtn) return;

    // Position color picker near the edit modal color button
    const rect = colorBtn.getBoundingClientRect();
    colorPicker.style.position = 'fixed';
    colorPicker.style.top = `${rect.bottom + 8}px`;
    colorPicker.style.left = `${rect.left}px`;
    colorPicker.style.right = 'auto';
    colorPicker.classList.remove('hidden');

    // Update selection state
    this.updateEditNoteColorSelection();

    // Store that we're editing colors for the edit modal
    this.editNoteColorPickerActive = true;

    // Rebind color preset clicks for edit modal
    this.bindEditNoteColorPresets();
  }

  hideEditNoteColorPicker() {
    const colorPicker = document.getElementById('quick-note-color-picker');
    if (colorPicker) {
      colorPicker.classList.add('hidden');
      colorPicker.style.position = '';
      colorPicker.style.top = '';
      colorPicker.style.left = '';
      colorPicker.style.right = '';
    }
    this.editNoteColorPickerActive = false;
  }

  updateEditNoteColorSelection() {
    const colorPicker = document.getElementById('quick-note-color-picker');
    if (!colorPicker) return;

    // Clear all active states
    colorPicker.querySelectorAll('.color-preset, .gradient-preset').forEach(btn => {
      btn.classList.remove('active');
    });

    // Set active based on current edit note colors
    if (this.editNoteGradient) {
      const match = colorPicker.querySelector(`.gradient-preset[data-gradient="${this.editNoteGradient}"]`);
      if (match) match.classList.add('active');
    } else if (this.editNoteColor) {
      const match = colorPicker.querySelector(`.color-preset[data-color="${this.editNoteColor}"]`);
      if (match) match.classList.add('active');
    }
  }

  bindEditNoteColorPresets() {
    const colorPicker = document.getElementById('quick-note-color-picker');
    if (!colorPicker) return;

    // Create cloned handlers for edit modal
    const colorPresets = colorPicker.querySelectorAll('.color-preset');
    const gradientPresets = colorPicker.querySelectorAll('.gradient-preset');

    colorPresets.forEach(btn => {
      // Remove old listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = newBtn.dataset.color;
        if (this.editNoteColorPickerActive) {
          this.editNoteColor = color;
          this.editNoteGradient = null;
          this.updateEditNoteColorIndicator();
          this.updateEditNoteColorSelection();
        } else {
          this.pendingNoteColor = color;
          this.pendingNoteGradient = null;
          this.updateColorIndicator();
          this.updateColorSelection();
        }
      });
    });

    gradientPresets.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gradient = newBtn.dataset.gradient;
        if (this.editNoteColorPickerActive) {
          this.editNoteGradient = gradient;
          this.editNoteColor = null;
          this.updateEditNoteColorIndicator();
          this.updateEditNoteColorSelection();
        } else {
          this.pendingNoteGradient = gradient;
          this.pendingNoteColor = null;
          this.updateColorIndicator();
          this.updateColorSelection();
        }
      });
    });
  }

  // ===================================
  // Floating Format Bar
  // ===================================

  bindFormatBar() {
    const textareas = [
      document.getElementById('quick-note-textarea'),
      document.getElementById('quick-note-modal-textarea'),
      document.getElementById('edit-note-textarea')
    ].filter(Boolean);

    textareas.forEach(textarea => {
      textarea.addEventListener('mouseup', () => this.checkSelection(textarea));
      textarea.addEventListener('keyup', (e) => {
        // Only check on shift+arrow keys (selection change)
        if (e.shiftKey) {
          this.checkSelection(textarea);
        }
      });
    });

    // Close on outside click
    document.addEventListener('mousedown', (e) => {
      const formatBar = document.getElementById('format-bar');
      if (formatBar && !formatBar.contains(e.target) && !e.target.closest('textarea')) {
        this.hideFormatBar();
      }
    });

    // Format button clicks
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const formatBar = document.getElementById('format-bar');
        const targetId = formatBar?.dataset.targetId;
        const textarea = targetId ? document.getElementById(targetId) : null;
        if (textarea) {
          this.insertMarkdownFormatting(textarea, btn.dataset.action);
        }
      });
    });
  }

  checkSelection(textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      this.showFormatBar(textarea);
    } else {
      this.hideFormatBar();
    }
  }

  showFormatBar(textarea) {
    const bar = document.getElementById('format-bar');
    if (!bar) return;

    const rect = textarea.getBoundingClientRect();

    // Position above the textarea, horizontally centered
    bar.style.top = `${rect.top + window.scrollY - 44}px`;
    bar.style.left = `${rect.left + rect.width / 2 - 80}px`;
    bar.classList.remove('hidden');
    bar.dataset.targetId = textarea.id;
  }

  hideFormatBar() {
    const bar = document.getElementById('format-bar');
    bar?.classList.add('hidden');
  }

  insertMarkdownFormatting(textarea, action) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let before = '';
    let after = '';
    let placeholder = '';

    switch (action) {
      case 'bold':
        before = '**';
        after = '**';
        placeholder = 'bold text';
        break;
      case 'italic':
        before = '*';
        after = '*';
        placeholder = 'italic text';
        break;
      case 'heading':
        before = '## ';
        after = '';
        placeholder = 'Heading';
        break;
      case 'link':
        before = '[';
        after = '](url)';
        placeholder = 'link text';
        break;
      case 'list':
        before = '\n- ';
        after = '';
        placeholder = 'list item';
        break;
      case 'task':
        before = '\n- [ ] ';
        after = '';
        placeholder = 'task';
        break;
      case 'blockquote':
        before = '\n> ';
        after = '';
        placeholder = 'quote text';
        break;
      case 'code':
        before = '\n```\n';
        after = '\n```\n';
        placeholder = 'code';
        break;
      case 'divider':
        before = '\n---\n';
        after = '';
        placeholder = '';
        break;
      default:
        return;
    }

    const insertion = selected || placeholder;
    const newText = text.substring(0, start) + before + insertion + after + text.substring(end);

    textarea.value = newText;
    textarea.focus();

    // Position cursor appropriately
    if (selected) {
      // If there was selected text, place cursor after the formatting
      const newPos = start + before.length + insertion.length + after.length;
      textarea.setSelectionRange(newPos, newPos);
    } else {
      // If no selection, select the placeholder text
      const selectStart = start + before.length;
      const selectEnd = selectStart + placeholder.length;
      textarea.setSelectionRange(selectStart, selectEnd);
    }

    this.hideFormatBar();

    // Trigger input event for any listeners
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Helper to lighten a hex color
  lightenColor(hex, percent) {
    if (!hex) return hex;
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  // ===================================
  // Navigation Tabs
  // ===================================

  bindNavTabs() {
    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const view = tab.dataset.view;

        // Update active state
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Handle view switching
        if (view === 'everything') {
          this.setView('all');
        } else if (view === 'spaces') {
          this.setView('spaces');
        } else if (view === 'serendipity') {
          this.setView('weekly');
        }
      });
    });

    // Nav add button (+)
    const navAddBtn = document.getElementById('nav-add-btn');
    if (navAddBtn) {
      navAddBtn.addEventListener('click', () => {
        this.showQuickAddModal();
      });
    }
  }

  // ===================================
  // Spaces Page
  // ===================================

  bindSpacesPage() {
    const createBtn = document.getElementById('create-space-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateSpaceModal());
    }

    const createModal = document.getElementById('create-space-modal');
    const createOverlay = createModal?.querySelector('.modal-overlay');
    const createClose = document.getElementById('create-space-close');
    const createInput = document.getElementById('create-space-name');
    const createNext = document.getElementById('create-space-next');

    createOverlay?.addEventListener('click', () => this.hideCreateSpaceModal());
    createClose?.addEventListener('click', () => this.hideCreateSpaceModal());

    createInput?.addEventListener('input', () => {
      this.pendingSpaceName = createInput.value.trim();
      if (this.pendingSpaceName) {
        createNext.disabled = false;
        createNext.classList.add('enabled');
      } else {
        createNext.disabled = true;
        createNext.classList.remove('enabled');
      }
    });

    createNext?.addEventListener('click', () => {
      if (!this.pendingSpaceName) return;
      this.hideCreateSpaceModal();
      this.showChooseColorModal();
    });

    const colorModal = document.getElementById('choose-color-modal');
    const colorOverlay = colorModal?.querySelector('.modal-overlay');
    const colorClose = document.getElementById('choose-color-close');
    const colorConfirm = document.getElementById('choose-color-confirm');

    colorOverlay?.addEventListener('click', () => this.hideChooseColorModal());
    colorClose?.addEventListener('click', () => this.hideChooseColorModal());
    colorConfirm?.addEventListener('click', () => this.createSpace());

    this.renderColorWheel();
  }

  updateMainViewVisibility() {
    const isSpaces = this.currentView === 'spaces';
    const isFolder = this.currentView === 'folder';

    const spacesPage = document.getElementById('spaces-page');
    const contentArea = document.querySelector('.content');
    const searchBar = document.querySelector('.search-bar-redesigned');
    const spaceTitleBar = document.getElementById('space-title-bar');
    const focusBar = document.getElementById('focus-bar');
    const savesContainer = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    spacesPage?.classList.toggle('hidden', !isSpaces);
    contentArea?.classList.toggle('hidden', isSpaces);
    searchBar?.classList.toggle('hidden', isSpaces || isFolder);
    spaceTitleBar?.classList.toggle('hidden', !isFolder);
    focusBar?.classList.toggle('hidden', isSpaces);
    savesContainer?.classList.toggle('hidden', isSpaces);
    loading?.classList.toggle('hidden', isSpaces || loading.classList.contains('hidden'));
    empty?.classList.toggle('hidden', isSpaces || empty.classList.contains('hidden'));

    const spacesTab = document.querySelector('.nav-tab[data-view="spaces"]');
    if (spacesTab) {
      if (isSpaces || isFolder) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        spacesTab.classList.add('active');
      }
    }
  }

  updateSpaceTitleBar(title) {
    const spaceTitleText = document.getElementById('space-title-text');
    if (spaceTitleText) {
      spaceTitleText.textContent = title;
    }
  }

  async loadSpacesPage() {
    await this.loadFolders();

    const spacesGrid = document.getElementById('spaces-grid');
    if (!spacesGrid) return;

    if (!this.folders.length) {
      spacesGrid.innerHTML = '<p>No spaces yet.</p>';
      return;
    }

    const folderIds = this.folders.map(folder => folder.id);
    const { data } = await this.supabase
      .from('saves')
      .select('id, folder_id, image_url, created_at')
      .in('folder_id', folderIds)
      .order('created_at', { ascending: false });

    const grouped = {};
    (data || []).forEach(save => {
      if (!grouped[save.folder_id]) grouped[save.folder_id] = [];
      grouped[save.folder_id].push(save);
    });

    spacesGrid.innerHTML = this.folders.map(folder => {
      const previews = (grouped[folder.id] || [])
        .filter(save => save.image_url)
        .slice(0, 4);

      const previewMarkup = previews.length
        ? previews.map(save => `<img src="${save.image_url}" alt="">`).join('')
        : `<div class="space-card-placeholder"></div>`;

      return `
        <div class="space-card" data-folder-id="${folder.id}">
          <div class="space-card-preview">${previewMarkup}</div>
          <div class="space-card-footer">
            <span class="space-card-color" style="border-color: ${folder.color || '#ff6b9d'}"></span>
            <span>${this.escapeHtml(folder.name)}</span>
          </div>
        </div>
      `;
    }).join('');

    spacesGrid.querySelectorAll('.space-card').forEach(card => {
      card.addEventListener('click', () => {
        this.filterByFolder(card.dataset.folderId);
      });
    });
  }

  showCreateSpaceModal() {
    const modal = document.getElementById('create-space-modal');
    const input = document.getElementById('create-space-name');
    const next = document.getElementById('create-space-next');
    if (!modal) return;

    this.pendingSpaceName = '';
    this.pendingSpaceColor = '';
    modal.classList.remove('hidden');
    if (input) {
      input.value = '';
      input.focus();
    }
    if (next) {
      next.disabled = true;
      next.classList.remove('enabled');
    }
  }

  hideCreateSpaceModal() {
    document.getElementById('create-space-modal')?.classList.add('hidden');
  }

  showChooseColorModal() {
    const modal = document.getElementById('choose-color-modal');
    if (!modal) return;
    this.pendingSpaceColor = '';
    modal.classList.remove('hidden');
    this.updateColorWheelSelection();
  }

  hideChooseColorModal() {
    document.getElementById('choose-color-modal')?.classList.add('hidden');
  }

  renderColorWheel() {
    const wheel = document.getElementById('color-wheel');
    if (!wheel) return;

    const radius = 110;
    const center = 137.5;
    const count = this.spaceColorOptions.length;

    wheel.querySelectorAll('.color-wheel-button').forEach(btn => btn.remove());

    this.spaceColorOptions.forEach((color, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const x = center + radius * Math.cos(angle) - 22.5;
      const y = center + radius * Math.sin(angle) - 22.5;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-wheel-button';
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
      btn.style.borderColor = color;
      btn.style.background = 'white';

      btn.addEventListener('click', () => {
        this.pendingSpaceColor = color;
        this.updateColorWheelSelection();
      });

      wheel.appendChild(btn);
    });
  }

  updateColorWheelSelection() {
    const wheel = document.getElementById('color-wheel');
    const glow = document.getElementById('color-wheel-glow');
    const confirm = document.getElementById('choose-color-confirm');
    if (!wheel || !glow || !confirm) return;

    glow.style.background = this.pendingSpaceColor || 'transparent';
    glow.style.opacity = this.pendingSpaceColor ? '0.8' : '0';
    wheel.querySelectorAll('.color-wheel-button').forEach(btn => {
      btn.classList.toggle('selected', btn.style.borderColor === this.pendingSpaceColor);
    });

    if (this.pendingSpaceColor) {
      confirm.disabled = false;
      confirm.classList.add('enabled');
    } else {
      confirm.disabled = true;
      confirm.classList.remove('enabled');
    }
  }

  async createSpace() {
    if (!this.pendingSpaceName || !this.pendingSpaceColor) return;

    await this.supabase
      .from('folders')
      .insert({
        user_id: this.user.id,
        name: this.pendingSpaceName,
        color: this.pendingSpaceColor,
      });

    this.hideChooseColorModal();
    await this.loadFolders();
    this.loadSpacesPage();
  }

  // ===================================
  // Focus Bar Drop Zone Functionality
  // ===================================

  bindDropZone() {
    const focusBar = document.getElementById('focus-bar');
    if (!focusBar) return;

    // Dragover event - show drop zone state
    focusBar.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      focusBar.classList.add('drag-over');
    });

    // Dragleave event
    focusBar.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only remove if leaving the focus bar entirely
      if (!focusBar.contains(e.relatedTarget)) {
        focusBar.classList.remove('drag-over');
      }
    });

    // Drop event - pin the dropped card
    focusBar.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      focusBar.classList.remove('drag-over', 'focus-bar-drag-reveal');

      // Get the save ID from the dragged card
      const saveId = e.dataTransfer.getData('text/plain');
      if (saveId && !saveId.startsWith('http')) {
        this.pinSaveById(saveId);
      }
    });

    // Click on empty state to open quick add
    const emptyState = document.getElementById('focus-bar-empty');
    if (emptyState) {
      emptyState.addEventListener('click', () => {
        this.showQuickAddModal();
      });
    }

    // Make cards draggable
    this.bindCardDragging();
  }

  bindCardDragging() {
    // Add drag functionality to save cards
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.save-card');
      if (card && card.dataset.id) {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';

        // Reveal focus bar if it's hidden (no pinned items)
        const focusBar = document.getElementById('focus-bar');
        if (focusBar && focusBar.classList.contains('focus-bar-hidden')) {
          focusBar.classList.remove('focus-bar-hidden');
          focusBar.classList.add('focus-bar-drag-reveal');
        }
      }
    });

    // Hide focus bar again when drag ends (if still no pinned items)
    document.addEventListener('dragend', () => {
      const focusBar = document.getElementById('focus-bar');
      if (focusBar && focusBar.classList.contains('focus-bar-drag-reveal')) {
        focusBar.classList.remove('focus-bar-drag-reveal', 'drag-over');
        focusBar.classList.add('focus-bar-hidden');
      }
    });
  }

  async pinSaveById(saveId) {
    // Check pin limit
    if (this.pinnedSaves.length >= 5) {
      this.showToast('Maximum 5 pinned items allowed', 'error');
      return;
    }

    try {
      await this.supabase
        .from('saves')
        .update({
          is_pinned: true,
          pinned_at: new Date().toISOString()
        })
        .eq('id', saveId);

      this.showToast('Card pinned to Focus Bar!', 'success');
      await this.loadPinnedSaves();
      this.loadSaves();
    } catch (err) {
      console.error('Error pinning save:', err);
    }
  }

  async uploadDroppedImage(file) {
    try {
      // Upload to Supabase storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('saves')
        .upload(`${this.user.id}/${fileName}`, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('saves')
        .getPublicUrl(`${this.user.id}/${fileName}`);

      // Create save entry
      const { error: saveError } = await this.supabase
        .from('saves')
        .insert({
          user_id: this.user.id,
          title: file.name,
          image_url: urlData.publicUrl,
          source: 'upload',
          created_at: new Date().toISOString()
        });

      if (saveError) throw saveError;

      this.showToast('Image saved!', 'success');
      this.loadSaves();
    } catch (err) {
      console.error('Error uploading image:', err);
      this.showToast('Failed to upload image', 'error');
    }
  }

  async saveDroppedUrl(url) {
    try {
      // Call the save URL function
      const { data, error } = await this.supabase.functions.invoke('save-url', {
        body: {
          url: url,
          user_id: this.user.id
        }
      });

      if (error) throw error;

      this.showToast('URL saved!', 'success');
      this.loadSaves();
    } catch (err) {
      console.error('Error saving URL:', err);
      this.showToast('Failed to save URL', 'error');
    }
  }

  // ===================================
  // Focus Bar (Pinned Items)
  // ===================================

  async loadPinnedSaves() {
    try {
      const { data } = await this.supabase
        .from('saves')
        .select('*')
        .eq('is_pinned', true)
        .order('pinned_at', { ascending: false })
        .limit(5);

      this.pinnedSaves = data || [];
      this.renderFocusBar();
    } catch (err) {
      console.error('Error loading pinned saves:', err);
    }
  }

  renderFocusBar() {
    const focusBar = document.getElementById('focus-bar');
    const container = document.getElementById('focus-bar-items');
    const emptyState = document.getElementById('focus-bar-empty');

    if (!focusBar || !container) return;

    // When no pinned items, hide the focus bar entirely.
    // It will be revealed via drag-start when a user drags a card.
    if (!this.pinnedSaves.length) {
      container.innerHTML = '';
      focusBar.classList.add('focus-bar-hidden');
      focusBar.classList.remove('focus-bar-drag-reveal');
      if (emptyState) emptyState.style.display = 'none';
      return;
    }

    // Has pinned items — show the focus bar normally
    focusBar.classList.remove('focus-bar-hidden', 'focus-bar-drag-reveal');
    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = this.pinnedSaves.map(save => `
      <div class="focus-bar-item" data-id="${save.id}">
        ${save.image_url ? `<img class="focus-bar-item-image" src="${save.image_url}" alt="">` : `<div class="focus-bar-item-image"></div>`}
        <span class="focus-bar-item-title">${this.escapeHtml(save.title || 'Untitled')}</span>
        <button class="focus-bar-item-unpin" title="Unpin">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');

    // Bind click events
    container.querySelectorAll('.focus-bar-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.focus-bar-item-unpin')) {
          e.stopPropagation();
          this.unpinSave(item.dataset.id);
        } else {
          const save = this.pinnedSaves.find(s => s.id === item.dataset.id);
          if (save) this.openUnifiedModal(save);
        }
      });
    });
  }

  bindPinButton() {
    document.getElementById('pin-btn')?.addEventListener('click', () => this.togglePin());
  }

  async togglePin() {
    if (!this.currentSave) return;

    const newValue = !this.currentSave.is_pinned;

    // Check pin limit
    if (newValue && this.pinnedSaves.length >= 5) {
      alert('Maximum 5 pinned items allowed. Unpin an item first.');
      return;
    }

    try {
      await this.supabase
        .from('saves')
        .update({
          is_pinned: newValue,
          pinned_at: newValue ? new Date().toISOString() : null
        })
        .eq('id', this.currentSave.id);

      this.currentSave.is_pinned = newValue;
      document.getElementById('pin-btn')?.classList.toggle('active', newValue);

      await this.loadPinnedSaves();
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  }

  async unpinSave(saveId) {
    try {
      await this.supabase
        .from('saves')
        .update({ is_pinned: false, pinned_at: null })
        .eq('id', saveId);

      if (this.currentSave?.id === saveId) {
        this.currentSave.is_pinned = false;
        document.getElementById('pin-btn')?.classList.remove('active');
      }

      await this.loadPinnedSaves();
    } catch (err) {
      console.error('Error unpinning save:', err);
    }
  }

  // ===================================
  // Product Save Type
  // ===================================

  bindProductModal() {
    const modal = document.getElementById('product-modal');
    if (!modal) return;

    const overlay = modal.querySelector('.modal-overlay');
    const closeBtn = document.getElementById('product-modal-close');

    overlay?.addEventListener('click', () => this.hideProductModal());
    closeBtn?.addEventListener('click', () => this.hideProductModal());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this.hideProductModal();
      }
    });
  }

  openProductModal(save) {
    const modal = document.getElementById('product-modal');
    if (!modal) return;

    // Populate modal
    document.getElementById('product-modal-title').textContent = save.title || 'Product';
    document.getElementById('product-modal-image').src = save.image_url || '';
    document.getElementById('product-modal-image').style.display = save.image_url ? 'block' : 'none';

    // Format price
    const priceDisplay = this.formatPrice(save.product_price, save.product_currency);
    document.getElementById('product-modal-price').textContent = priceDisplay;

    document.getElementById('product-modal-site').textContent = save.site_name || '';
    document.getElementById('product-modal-description').textContent = save.excerpt || save.content || '';
    document.getElementById('product-modal-link').href = save.url || '#';

    modal.classList.remove('hidden');
  }

  hideProductModal() {
    document.getElementById('product-modal')?.classList.add('hidden');
  }

  // ===================================
  // Modal Context Menu
  // ===================================

  bindModalContextMenu() {
    const menu = document.getElementById('modal-context-menu');
    const deleteDialog = document.getElementById('modal-delete-confirm');
    const sharePanel = document.getElementById('modal-share-panel');
    if (!menu) return;

    this.modalContextMenuSave = null;
    this.modalShareSave = null;

    document.addEventListener('click', (e) => {
      const isTrigger = e.target.closest('#modal-more-btn') || e.target.closest('#modal-share-btn');
      if (isTrigger) return;

      if (!menu.contains(e.target) && !deleteDialog?.contains(e.target) && !sharePanel?.contains(e.target)) {
        this.hideModalContextMenu();
        this.hideModalSharePanel();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideModalContextMenu();
        this.hideModalSharePanel();
      }
    });

    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const action = item.dataset.action;
        if (action === 'add-to-space') return;
        if (item.classList.contains('disabled')) return;
        this.handleModalContextMenuAction(action);
      });
    });

    if (sharePanel) {
      sharePanel.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.dataset.action;
          if (item.classList.contains('disabled')) return;
          this.handleModalShareAction(action);
        });
      });
    }

    if (deleteDialog) {
      deleteDialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        this.hideModalContextMenu();
      });
      deleteDialog.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
        this.confirmModalDelete();
      });
    }
  }

  showModalContextMenu(save) {
    const menu = document.getElementById('modal-context-menu');
    if (!menu) return;

    if (!menu.classList.contains('hidden')) {
      this.hideModalContextMenu();
      return;
    }

    this.modalContextMenuSave = save;
    this.updateModalContextMenuState(save);
    this.populateModalSpacesSubmenu();
    this.hideModalSharePanel();

    const anchor = document.getElementById('modal-more-btn');
    this.positionPopover(menu, anchor);
  }

  hideModalContextMenu() {
    document.getElementById('modal-context-menu')?.classList.add('hidden');
    document.getElementById('modal-delete-confirm')?.classList.add('hidden');
    this.modalContextMenuSave = null;
  }

  updateModalContextMenuState(save) {
    const pinLabel = document.getElementById('modal-menu-pin-label');
    if (pinLabel) {
      pinLabel.textContent = save.is_pinned ? 'Remove pin' : 'Stick a pin in it';
    }

    const favoriteLabel = document.getElementById('modal-menu-favorite-label');
    if (favoriteLabel) {
      favoriteLabel.textContent = save.is_favorite ? 'Unfavorite' : 'Favorite';
    }

    const openItem = document.getElementById('modal-menu-open-original');
    if (openItem) {
      openItem.classList.toggle('disabled', !save.url);
    }

    const sharePanel = document.getElementById('modal-share-panel');
    if (sharePanel) {
      const shareItems = sharePanel.querySelectorAll('[data-action="share-system"], [data-action="share-copy"]');
      shareItems.forEach(item => item.classList.toggle('disabled', !save.url && !save.title));
    }
  }

  populateModalSpacesSubmenu() {
    const submenu = document.getElementById('modal-spaces-submenu');
    if (!submenu) return;

    if (!this.folders || this.folders.length === 0) {
      submenu.innerHTML = '<div class="context-submenu-empty">No spaces yet</div>';
      return;
    }

    submenu.innerHTML = this.folders.map(folder => `
      <button class="context-submenu-item" data-space-id="${folder.id}">
        <span class="space-color-dot" style="background: ${folder.color || '#6366f1'}"></span>
        <span>${this.escapeHtml(folder.name)}</span>
      </button>
    `).join('');

    submenu.querySelectorAll('.context-submenu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const spaceId = item.dataset.spaceId;
        this.addToModalSpace(spaceId);
      });
    });
  }

  handleModalContextMenuAction(action) {
    const save = this.modalContextMenuSave;
    if (!save) return;

    switch (action) {
      case 'copy':
        this.copyModalSaveToClipboard(save);
        break;
      case 'pin':
        this.toggleModalPin(save);
        this.hideModalContextMenu();
        break;
      case 'favorite':
        this.toggleModalFavorite(save);
        this.hideModalContextMenu();
        break;
      case 'open-original':
        if (save.url) {
          window.open(save.url, '_blank', 'noopener');
        }
        this.hideModalContextMenu();
        break;
      case 'delete':
        this.showModalDeleteConfirmation();
        break;
    }
  }

  async copyModalSaveToClipboard(save) {
    try {
      const text = save.url || save.title || save.content || '';
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!', 'success');
      this.hideModalContextMenu();
    } catch (err) {
      console.error('Failed to copy:', err);
      this.showToast('Failed to copy', 'error');
    }
  }

  async addToModalSpace(spaceId) {
    const save = this.modalContextMenuSave;
    if (!save) return;

    const folder = this.folders.find(f => f.id === spaceId);
    try {
      await this.supabase
        .from('saves')
        .update({ folder_id: spaceId })
        .eq('id', save.id);

      this.showToast(`Added to ${folder?.name || 'space'}`, 'success');
      this.hideModalContextMenu();
      this.loadSaves();
    } catch (err) {
      console.error('Error adding to space:', err);
      this.showToast('Failed to add to space', 'error');
    }
  }

  showModalDeleteConfirmation() {
    const deleteDialog = document.getElementById('modal-delete-confirm');
    if (!deleteDialog) return;

    const anchor = document.getElementById('modal-more-btn');
    this.positionPopover(deleteDialog, anchor);
    document.getElementById('modal-context-menu')?.classList.add('hidden');
  }

  async confirmModalDelete() {
    const save = this.modalContextMenuSave;
    if (!save) return;
    await this.deleteModalSave(save);
    this.hideModalContextMenu();
  }

  showModalSharePanel(save) {
    const sharePanel = document.getElementById('modal-share-panel');
    if (!sharePanel) return;

    if (!sharePanel.classList.contains('hidden')) {
      this.hideModalSharePanel();
      return;
    }

    this.modalShareSave = save;
    this.updateModalContextMenuState(save);
    this.hideModalContextMenu();

    const anchor = document.getElementById('modal-share-btn');
    this.positionPopover(sharePanel, anchor);
  }

  hideModalSharePanel() {
    document.getElementById('modal-share-panel')?.classList.add('hidden');
    this.modalShareSave = null;
  }

  async handleModalShareAction(action) {
    const save = this.modalShareSave;
    if (!save) return;

    switch (action) {
      case 'share-system':
        if (navigator.share) {
          try {
            await navigator.share({
              title: save.title,
              url: save.url || window.location.href
            });
          } catch (e) {
            // User cancelled or share failed
          }
        } else {
          this.showToast('Sharing not supported on this device', 'error');
        }
        this.hideModalSharePanel();
        break;
      case 'share-copy':
        await this.copyModalSaveToClipboard(save);
        this.hideModalSharePanel();
        break;
    }
  }

  positionPopover(popover, anchor) {
    if (!popover || !anchor) return;

    popover.classList.remove('hidden');
    popover.style.visibility = 'hidden';
    popover.style.left = '0';
    popover.style.top = '0';

    const popoverRect = popover.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = anchorRect.right - popoverRect.width;
    let y = anchorRect.bottom + 8;

    if (x < 8) x = 8;
    if (x + popoverRect.width > viewportWidth) {
      x = viewportWidth - popoverRect.width - 8;
    }

    if (y + popoverRect.height > viewportHeight) {
      y = anchorRect.top - popoverRect.height - 8;
    }

    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
    popover.style.visibility = 'visible';
  }

  // ===================================
  // Context Menu
  // ===================================

  bindContextMenu() {
    const contextMenu = document.getElementById('card-context-menu');
    const deleteDialog = document.getElementById('delete-confirm-dialog');
    if (!contextMenu) return;

    // Store reference to current context menu save
    this.contextMenuSave = null;
    this.contextMenuPosition = { x: 0, y: 0 };

    // Close context menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target) && !deleteDialog?.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideContextMenu();
      }
    });

    // Bind context menu actions
    contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const action = item.dataset.action;
        if (action === 'add-to-space') return; // Has submenu, don't close
        this.handleContextMenuAction(action);
      });
    });

    // Bind delete confirmation actions
    if (deleteDialog) {
      deleteDialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        this.hideContextMenu();
      });
      deleteDialog.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
        this.confirmDeleteCard();
      });
    }
  }

  showContextMenu(e, save) {
    e.preventDefault();
    e.stopPropagation();

    const contextMenu = document.getElementById('card-context-menu');
    const deleteDialog = document.getElementById('delete-confirm-dialog');
    if (!contextMenu) return;

    this.contextMenuSave = save;

    // Hide delete dialog if open
    deleteDialog?.classList.add('hidden');

    // Update "Top of Mind" text based on pin status
    const pinItem = contextMenu.querySelector('[data-action="pin"] span');
    if (pinItem) {
      pinItem.textContent = save.is_pinned ? 'Remove from Top of Mind' : 'Top of Mind';
    }

    // Populate spaces submenu
    this.populateSpacesSubmenu();

    // Position menu at cursor
    let x = e.clientX;
    let y = e.clientY;

    // Show menu to measure dimensions
    contextMenu.classList.remove('hidden');
    contextMenu.style.visibility = 'hidden';
    contextMenu.style.left = '0';
    contextMenu.style.top = '0';

    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust position to stay within viewport
    if (x + menuRect.width > viewportWidth) {
      x = viewportWidth - menuRect.width - 10;
    }
    if (y + menuRect.height > viewportHeight) {
      y = viewportHeight - menuRect.height - 10;
    }

    this.contextMenuPosition = { x, y };
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.visibility = 'visible';
  }

  hideContextMenu() {
    document.getElementById('card-context-menu')?.classList.add('hidden');
    document.getElementById('delete-confirm-dialog')?.classList.add('hidden');
    this.contextMenuSave = null;
  }

  populateSpacesSubmenu() {
    const submenu = document.getElementById('spaces-submenu');
    if (!submenu) return;

    if (!this.folders || this.folders.length === 0) {
      submenu.innerHTML = '<div class="context-submenu-empty">No spaces yet</div>';
      return;
    }

    submenu.innerHTML = this.folders.map(folder => `
      <button class="context-submenu-item" data-space-id="${folder.id}">
        <span class="space-color-dot" style="background: ${folder.color || '#6366f1'}"></span>
        <span>${this.escapeHtml(folder.name)}</span>
      </button>
    `).join('');

    // Bind click events
    submenu.querySelectorAll('.context-submenu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const spaceId = item.dataset.spaceId;
        this.addToSpace(spaceId);
      });
    });
  }

  handleContextMenuAction(action) {
    const save = this.contextMenuSave;
    if (!save) return;

    switch (action) {
      case 'add-tags':
        this.hideContextMenu();
        this.openUnifiedModal(save);
        // Focus on tags section after modal opens
        setTimeout(() => {
          document.getElementById('modal-add-tag-btn')?.click();
        }, 100);
        break;

      case 'copy':
        this.copyCardToClipboard(save);
        break;

      case 'pin':
        this.togglePinFromContextMenu(save);
        break;

      case 'delete':
        this.showDeleteConfirmation();
        break;
    }
  }

  async copyCardToClipboard(save) {
    try {
      const text = save.url || save.title || save.content || '';
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!', 'success');
      this.hideContextMenu();
    } catch (err) {
      console.error('Failed to copy:', err);
      this.showToast('Failed to copy', 'error');
    }
  }

  async togglePinFromContextMenu(save) {
    const newPinState = !save.is_pinned;

    // Check pin limit
    if (newPinState && this.pinnedSaves.length >= 5) {
      this.showToast('Maximum 5 pinned items allowed', 'error');
      this.hideContextMenu();
      return;
    }

    try {
      await this.supabase
        .from('saves')
        .update({
          is_pinned: newPinState,
          pinned_at: newPinState ? new Date().toISOString() : null
        })
        .eq('id', save.id);

      this.showToast(newPinState ? 'Added to Top of Mind!' : 'Removed from Top of Mind', 'success');
      this.hideContextMenu();
      await this.loadPinnedSaves();
      this.loadSaves();
    } catch (err) {
      console.error('Error toggling pin:', err);
      this.showToast('Failed to update', 'error');
    }
  }

  async addToSpace(spaceId) {
    const save = this.contextMenuSave;
    if (!save) return;

    const folder = this.folders.find(f => f.id === spaceId);
    try {
      await this.supabase
        .from('saves')
        .update({ folder_id: spaceId })
        .eq('id', save.id);

      this.showToast(`Added to ${folder?.name || 'space'}`, 'success');
      this.hideContextMenu();
      this.loadSaves();
    } catch (err) {
      console.error('Error adding to space:', err);
      this.showToast('Failed to add to space', 'error');
    }
  }

  showDeleteConfirmation() {
    const contextMenu = document.getElementById('card-context-menu');
    const deleteDialog = document.getElementById('delete-confirm-dialog');
    if (!deleteDialog) return;

    // Hide context menu, show delete confirmation at same position
    contextMenu?.classList.add('hidden');
    deleteDialog.classList.remove('hidden');
    deleteDialog.style.left = `${this.contextMenuPosition.x}px`;
    deleteDialog.style.top = `${this.contextMenuPosition.y}px`;
  }

  async confirmDeleteCard() {
    const save = this.contextMenuSave;
    if (!save) return;

    try {
      const { error } = await this.supabase
        .from('saves')
        .delete()
        .eq('id', save.id);

      if (error) throw error;

      this.showToast('Card deleted', 'success');
      this.hideContextMenu();
      this.loadSaves();
      this.loadPinnedSaves();
    } catch (err) {
      console.error('Error deleting save:', err);
      this.showToast('Failed to delete', 'error');
    }
  }
}

// Initialize app (expose for debugging in console)
window.StashApp = StashApp;
window.stashApp = new StashApp();
