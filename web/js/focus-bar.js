export function applyFocusBarMixin(proto) {
  // ===================================
  // Focus Bar Drop Zone Functionality
  // ===================================

  proto.bindDropZone = function() {
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
  };

  proto.bindCardDragging = function() {
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
  };

  proto.pinSaveById = async function(saveId) {
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
  };

  proto.uploadDroppedImage = async function(file) {
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
  };

  proto.saveDroppedUrl = async function(url) {
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
  };

  // ===================================
  // Focus Bar (Pinned Items)
  // ===================================

  proto.loadPinnedSaves = async function() {
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
  };

  proto.renderFocusBar = function() {
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
  };

  proto.bindPinButton = function() {
    document.getElementById('pin-btn')?.addEventListener('click', () => this.togglePin());
  };

  proto.togglePin = async function() {
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
  };

  proto.unpinSave = async function(saveId) {
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
  };
}
