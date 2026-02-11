// ===================================
// Context Menu Mixin
// Product Modal, Modal Context Menu,
// Card Context Menu, Space Context Menu
// ===================================

export function applyContextMenuMixin(proto) {

  // ===================================
  // Product Save Type
  // ===================================

  proto.bindProductModal = function() {
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
  };

  proto.openProductModal = function(save) {
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
  };

  proto.hideProductModal = function() {
    document.getElementById('product-modal')?.classList.add('hidden');
  };

  // ===================================
  // Modal Context Menu
  // ===================================

  proto.bindModalContextMenu = function() {
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
  };

  proto.showModalContextMenu = function(save) {
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
  };

  proto.hideModalContextMenu = function() {
    document.getElementById('modal-context-menu')?.classList.add('hidden');
    document.getElementById('modal-delete-confirm')?.classList.add('hidden');
    this.modalContextMenuSave = null;
  };

  proto.updateModalContextMenuState = function(save) {
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
  };

  proto.populateModalSpacesSubmenu = function() {
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
  };

  proto.handleModalContextMenuAction = function(action) {
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
  };

  proto.copyModalSaveToClipboard = async function(save) {
    try {
      const text = save.url || save.title || save.content || '';
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!', 'success');
      this.hideModalContextMenu();
    } catch (err) {
      console.error('Failed to copy:', err);
      this.showToast('Failed to copy', 'error');
    }
  };

  proto.addToModalSpace = async function(spaceId) {
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
  };

  proto.showModalDeleteConfirmation = function() {
    const deleteDialog = document.getElementById('modal-delete-confirm');
    if (!deleteDialog) return;

    const anchor = document.getElementById('modal-more-btn');
    this.positionPopover(deleteDialog, anchor);
    document.getElementById('modal-context-menu')?.classList.add('hidden');
  };

  proto.confirmModalDelete = async function() {
    const save = this.modalContextMenuSave;
    if (!save) return;
    await this.deleteModalSave(save);
    this.hideModalContextMenu();
  };

  proto.showModalSharePanel = function(save) {
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
  };

  proto.hideModalSharePanel = function() {
    document.getElementById('modal-share-panel')?.classList.add('hidden');
    this.modalShareSave = null;
  };

  proto.handleModalShareAction = async function(action) {
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
  };

  proto.positionPopover = function(popover, anchor) {
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
  };

  // ===================================
  // Context Menu
  // ===================================

  proto.bindContextMenu = function() {
    const contextMenu = document.getElementById('card-context-menu');
    const deleteDialog = document.getElementById('delete-confirm-dialog');
    if (!contextMenu) return;

    // Store reference to current context menu save
    this.contextMenuSave = null;
    this.contextMenuPosition = { x: 0, y: 0 };

    // Close context menu when clicking outside
    const spaceContextMenu = document.getElementById('space-context-menu');
    const spaceDeleteDialog = document.getElementById('space-delete-dialog');
    const editSpaceModal = document.getElementById('edit-space-modal');
    document.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target) && !deleteDialog?.contains(e.target)) {
        this.hideContextMenu();
      }
      if (spaceContextMenu && !spaceContextMenu.contains(e.target) && !spaceDeleteDialog?.contains(e.target) && !editSpaceModal?.contains(e.target)) {
        this.hideSpaceContextMenu();
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideContextMenu();
        this.hideSpaceContextMenu();
        this.hideEditSpaceModal();
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
  };

  proto.showContextMenu = function(e, save) {
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
  };

  proto.hideContextMenu = function() {
    document.getElementById('card-context-menu')?.classList.add('hidden');
    document.getElementById('delete-confirm-dialog')?.classList.add('hidden');
    this.contextMenuSave = null;
  };

  proto.populateSpacesSubmenu = function() {
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
  };

  proto.handleContextMenuAction = function(action) {
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
  };

  proto.copyCardToClipboard = async function(save) {
    try {
      const text = save.url || save.title || save.content || '';
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!', 'success');
      this.hideContextMenu();
    } catch (err) {
      console.error('Failed to copy:', err);
      this.showToast('Failed to copy', 'error');
    }
  };

  proto.togglePinFromContextMenu = async function(save) {
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
  };

  proto.addToSpace = async function(spaceId) {
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
  };

  proto.showDeleteConfirmation = function() {
    const contextMenu = document.getElementById('card-context-menu');
    const deleteDialog = document.getElementById('delete-confirm-dialog');
    if (!deleteDialog) return;

    // Hide context menu, show delete confirmation at same position
    contextMenu?.classList.add('hidden');
    deleteDialog.classList.remove('hidden');
    deleteDialog.style.left = `${this.contextMenuPosition.x}px`;
    deleteDialog.style.top = `${this.contextMenuPosition.y}px`;
  };

  proto.confirmDeleteCard = async function() {
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
  };

  // ===================================
  // Space Context Menu
  // ===================================

  proto.bindSpaceContextMenu = function() {
    this.spaceContextMenuFolder = null;
    this.spaceContextMenuPosition = { x: 0, y: 0 };

    const menu = document.getElementById('space-context-menu');
    const deleteDialog = document.getElementById('space-delete-dialog');
    if (!menu) return;

    // Bind menu item actions
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.handleSpaceContextMenuAction(action);
      });
    });

    // Bind space delete confirmation
    if (deleteDialog) {
      deleteDialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        this.hideSpaceContextMenu();
      });
      deleteDialog.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
        this.confirmDeleteSpace();
      });
    }

    // Bind edit space modal
    document.getElementById('edit-space-close')?.addEventListener('click', () => {
      this.hideEditSpaceModal();
    });
    document.getElementById('edit-space-cancel')?.addEventListener('click', () => {
      this.hideEditSpaceModal();
    });
    document.getElementById('edit-space-save')?.addEventListener('click', () => {
      this.saveEditSpace();
    });

    // Save on Enter key in name input
    document.getElementById('edit-space-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveEditSpace();
      }
    });

    // Bind color picker buttons
    document.querySelectorAll('.edit-space-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.edit-space-color-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.editSpaceSelectedColor = btn.dataset.color;
      });
    });

    // Close edit modal on overlay click
    document.getElementById('edit-space-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'edit-space-modal') {
        this.hideEditSpaceModal();
      }
    });
  };

  proto.showSpaceContextMenu = function(e, folder) {
    e.preventDefault();
    e.stopPropagation();

    const menu = document.getElementById('space-context-menu');
    const deleteDialog = document.getElementById('space-delete-dialog');
    if (!menu) return;

    // Hide any other open menus
    this.hideContextMenu();
    deleteDialog?.classList.add('hidden');

    this.spaceContextMenuFolder = folder;

    // Position menu at cursor
    let x = e.clientX;
    let y = e.clientY;

    menu.classList.remove('hidden');
    menu.style.visibility = 'hidden';
    menu.style.left = '0';
    menu.style.top = '0';

    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuRect.width > viewportWidth) {
      x = viewportWidth - menuRect.width - 10;
    }
    if (y + menuRect.height > viewportHeight) {
      y = viewportHeight - menuRect.height - 10;
    }

    this.spaceContextMenuPosition = { x, y };
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.visibility = 'visible';
  };

  proto.hideSpaceContextMenu = function() {
    document.getElementById('space-context-menu')?.classList.add('hidden');
    document.getElementById('space-delete-dialog')?.classList.add('hidden');
    this.spaceContextMenuFolder = null;
  };

  proto.handleSpaceContextMenuAction = function(action) {
    const folder = this.spaceContextMenuFolder;
    if (!folder) return;

    switch (action) {
      case 'edit-space':
        this.hideSpaceContextMenu();
        this.openEditSpaceModal(folder);
        break;
      case 'archive-space':
        this.archiveSpace(folder);
        break;
      case 'delete-space':
        this.showSpaceDeleteConfirmation();
        break;
    }
  };

  // --- Edit Space ---

  proto.openEditSpaceModal = function(folder) {
    const modal = document.getElementById('edit-space-modal');
    const nameInput = document.getElementById('edit-space-name');
    if (!modal || !nameInput) return;

    this.editSpaceFolder = folder;
    this.editSpaceSelectedColor = folder.color || '#6366f1';

    nameInput.value = folder.name;

    // Select the current color
    document.querySelectorAll('.edit-space-color-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.color === this.editSpaceSelectedColor);
    });

    modal.classList.remove('hidden');
    nameInput.focus();
    nameInput.select();
  };

  proto.hideEditSpaceModal = function() {
    document.getElementById('edit-space-modal')?.classList.add('hidden');
    this.editSpaceFolder = null;
  };

  proto.saveEditSpace = async function() {
    const folder = this.editSpaceFolder;
    if (!folder) return;

    const nameInput = document.getElementById('edit-space-name');
    const newName = (nameInput?.value || '').trim();

    if (!newName) {
      this.showToast('Space name cannot be empty', 'error');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('folders')
        .update({ name: newName, color: this.editSpaceSelectedColor })
        .eq('id', folder.id);

      if (error) throw error;

      this.showToast('Space updated', 'success');
      this.hideEditSpaceModal();
      this.loadSpacesPage();
      this.loadFolders();
    } catch (err) {
      console.error('Error updating space:', err);
      this.showToast('Failed to update space', 'error');
    }
  };

  // --- Archive Space ---

  proto.archiveSpace = async function(folder) {
    try {
      const { error } = await this.supabase
        .from('folders')
        .update({ is_archived: true })
        .eq('id', folder.id);

      if (error) throw error;

      this.showToast(`"${folder.name}" archived`, 'success');
      this.hideSpaceContextMenu();
      this.loadSpacesPage();
      this.loadFolders();
    } catch (err) {
      console.error('Error archiving space:', err);
      this.showToast('Failed to archive space', 'error');
    }
  };

  // --- Delete Space ---

  proto.showSpaceDeleteConfirmation = function() {
    const menu = document.getElementById('space-context-menu');
    const deleteDialog = document.getElementById('space-delete-dialog');
    if (!deleteDialog) return;

    menu?.classList.add('hidden');
    deleteDialog.classList.remove('hidden');
    deleteDialog.style.left = `${this.spaceContextMenuPosition.x}px`;
    deleteDialog.style.top = `${this.spaceContextMenuPosition.y}px`;
  };

  proto.confirmDeleteSpace = async function() {
    const folder = this.spaceContextMenuFolder;
    if (!folder) return;

    try {
      // Unassign saves from this folder (don't delete them)
      await this.supabase
        .from('saves')
        .update({ folder_id: null })
        .eq('folder_id', folder.id);

      // Delete the folder
      const { error } = await this.supabase
        .from('folders')
        .delete()
        .eq('id', folder.id);

      if (error) throw error;

      this.showToast(`"${folder.name}" deleted`, 'success');
      this.hideSpaceContextMenu();
      this.loadSpacesPage();
      this.loadFolders();
    } catch (err) {
      console.error('Error deleting space:', err);
      this.showToast('Failed to delete space', 'error');
    }
  };
}
