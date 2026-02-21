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
    const modalEditor = document.getElementById('quick-note-modal-editor');
    const titleInput = document.getElementById('quick-note-title');
    const modalTitleInput = document.getElementById('quick-note-modal-title');

    // Read content from WYSIWYG editor if modal is open, else from sticky textarea
    const modal = document.getElementById('quick-note-modal');
    const modalOpen = modal && !modal.classList.contains('hidden');
    const content = (modalOpen && modalEditor
      ? this.getNoteEditorContent(modalEditor)
      : textarea?.value || '').trim();

    if (!content) return;

    // Get title from the active input (modal or sticky)
    const customTitle = (modalOpen && modalTitleInput
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
        title: customTitle || null,
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

      // Clear sticky textarea
      if (textarea) {
        textarea.value = '';
        textarea.style.height = 'auto';
      }
      // Clear WYSIWYG editor
      if (modalEditor) this.clearNoteEditor(modalEditor);
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

    overlay?.addEventListener('click', () => this.hideQuickNoteModal());
    closeBtn?.addEventListener('click', () => this.hideQuickNoteModal());
    cancelBtn?.addEventListener('click', () => this.hideQuickNoteModal());

    saveBtn?.addEventListener('click', () => this.saveQuickNoteToGrid());

    // Format toolbar buttons — delegate to WYSIWYG editor
    const editor = document.getElementById('quick-note-modal-editor');
    modal.querySelectorAll('.note-modal-format-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (editor) this.applyNoteFormat(editor, btn.dataset.action);
      });
    });

    // Init WYSIWYG editor (empty for new notes)
    if (editor) {
      this.initNoteEditor(editor, '', null);
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this.hideQuickNoteModal();
      }
    });
  };

  proto.showQuickNoteModal = function() {
    const modal = document.getElementById('quick-note-modal');
    const editor = document.getElementById('quick-note-modal-editor');
    const stickyTextarea = document.getElementById('quick-note-textarea');
    const titleInput = document.getElementById('quick-note-modal-title');
    const stickyTitleInput = document.getElementById('quick-note-title');

    if (!modal) return;

    // Sync title from sticky note input
    if (titleInput && stickyTitleInput) {
      titleInput.value = stickyTitleInput.value;
    }

    // Load sticky textarea content into WYSIWYG editor
    if (editor) {
      const stickyContent = stickyTextarea?.value?.trim() || '';
      this.setNoteEditorContent(editor, stickyContent);
      // Focus editor after a short delay to ensure modal is visible
      setTimeout(() => editor.focus(), 50);
    }

    modal.classList.remove('hidden');
  };

  proto.hideQuickNoteModal = function() {
    const modal = document.getElementById('quick-note-modal');
    const editor = document.getElementById('quick-note-modal-editor');
    const stickyTextarea = document.getElementById('quick-note-textarea');
    const modalTitleInput = document.getElementById('quick-note-modal-title');
    const stickyTitleInput = document.getElementById('quick-note-title');

    if (!modal?.classList.contains('hidden')) {
      // Sync markdown content back to sticky textarea so it's preserved if user re-opens
      if (editor && stickyTextarea) {
        stickyTextarea.value = this.getNoteEditorContent(editor);
        // Update sticky char count
        const charCount = document.getElementById('quick-note-char-count');
        if (charCount) {
          const len = stickyTextarea.value.length;
          charCount.textContent = len > 0 ? `${len}` : '';
        }
      }

      // Sync title back to sticky note input
      if (modalTitleInput && stickyTitleInput) {
        stickyTitleInput.value = modalTitleInput.value;
      }
    }

    modal?.classList.add('hidden');
  };

}
