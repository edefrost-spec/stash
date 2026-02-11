// Quick Note Feature — extracted from app.js
// Provides quick note creation, color picking, modal expand, and preview toggle.

export function applyQuickNoteMixin(proto) {
  proto.bindQuickNoteEvents = function() {
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
  };

  proto.bindQuickNoteKeyboardShortcut = function() {
    document.addEventListener('keydown', (e) => {
      // Cmd+J (Mac) or Ctrl+J (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        this.focusQuickNote();
      }
    });
  };

  proto.focusQuickNote = function() {
    const textarea = document.getElementById('quick-note-textarea');
    if (textarea) {
      textarea.focus();
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  proto.setPendingNoteColor = function(color, gradient) {
    this.pendingNoteColor = color;
    this.pendingNoteGradient = gradient;
    this.updateColorIndicator();
  };

  proto.updateColorIndicator = function() {
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
  };

  proto.updateColorSelection = function() {
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
  };

  proto.saveQuickNoteToGrid = async function() {
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
  };

  proto.bindQuickNoteModalEvents = function() {
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
  };

  proto.showQuickNoteModal = function() {
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
  };

  proto.hideQuickNoteModal = function() {
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
  };

  proto.toggleQuickNotePreview = function() {
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
  };
}
