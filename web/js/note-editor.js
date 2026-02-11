export function applyNoteEditorMixin(proto) {
  proto.bindEditNoteModal = function() {
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
  };

  proto.openEditNoteModal = function(save) {
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
  };

  proto.hideEditNoteModal = function() {
    const modal = document.getElementById('edit-note-modal');
    modal?.classList.add('hidden');
    this.editingNote = null;
    this.hideEditNoteColorPicker();
  };

  proto.saveEditedNote = async function() {
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
  };

  proto.toggleEditNotePreview = function() {
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
  };

  proto.updateEditNoteColorIndicator = function() {
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
  };

  proto.showEditNoteColorPicker = function() {
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
  };

  proto.hideEditNoteColorPicker = function() {
    const colorPicker = document.getElementById('quick-note-color-picker');
    if (colorPicker) {
      colorPicker.classList.add('hidden');
      colorPicker.style.position = '';
      colorPicker.style.top = '';
      colorPicker.style.left = '';
      colorPicker.style.right = '';
    }
    this.editNoteColorPickerActive = false;
  };

  proto.updateEditNoteColorSelection = function() {
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
  };

  proto.bindEditNoteColorPresets = function() {
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
  };
}
