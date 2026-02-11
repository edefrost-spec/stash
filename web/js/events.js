export function applyEventsMixin(proto) {
  proto.bindEvents = function() {
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
  };

  // Image dropzone in Quick Add modal
  proto.bindImageDropzone = function() {
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
  };

  // Global drag & drop overlay
  proto.bindGlobalDragDrop = function() {
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
      } else if (file && (file.type.startsWith('audio/') || /\.(m4a|mp3|wav|webm|ogg|aac)$/i.test(file.name))) {
        this.saveVoiceMemo(file);
      }
    });
  };

  // Global clipboard paste for screenshots
  proto.bindClipboardPaste = function() {
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
  };
}
