export function applySpacesMixin(proto) {

  // ===================================
  // Navigation Tabs
  // ===================================

  proto.bindNavTabs = function() {
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
        } else if (view === 'canvas') {
          this.setView('canvas');
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
  };

  // ===================================
  // Spaces Page
  // ===================================

  proto.bindSpacesPage = function() {
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
  };

  proto.updateMainViewVisibility = function() {
    const isSpaces = this.currentView === 'spaces';
    const isFolder = this.currentView === 'folder';
    const isCanvas = this.currentView === 'canvas';

    const spacesPage = document.getElementById('spaces-page');
    const canvasPage = document.getElementById('canvas-page');
    const contentArea = document.querySelector('.content');
    const searchBar = document.querySelector('.search-bar-redesigned');
    const spaceTitleBar = document.getElementById('space-title-bar');
    const focusBar = document.getElementById('focus-bar');
    const savesContainer = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    spacesPage?.classList.toggle('hidden', !isSpaces);
    canvasPage?.classList.toggle('hidden', !isCanvas);
    contentArea?.classList.toggle('hidden', isSpaces || isCanvas);
    searchBar?.classList.toggle('hidden', isSpaces || isFolder || isCanvas);
    spaceTitleBar?.classList.toggle('hidden', !isFolder);
    focusBar?.classList.toggle('hidden', isSpaces || isCanvas);
    savesContainer?.classList.toggle('hidden', isSpaces || isCanvas);
    loading?.classList.toggle('hidden', isSpaces || isCanvas || loading.classList.contains('hidden'));
    empty?.classList.toggle('hidden', isSpaces || isCanvas || empty.classList.contains('hidden'));

    const spacesTab = document.querySelector('.nav-tab[data-view="spaces"]');
    if (spacesTab) {
      if (isSpaces || isFolder) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        spacesTab.classList.add('active');
      }
    }
  };

  proto.updateSpaceTitleBar = function(title) {
    const spaceTitleText = document.getElementById('space-title-text');
    if (spaceTitleText) {
      spaceTitleText.textContent = title;
    }
  };

  proto.loadSpacesPage = async function() {
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
      card.addEventListener('contextmenu', (e) => {
        const folderId = card.dataset.folderId;
        const folder = this.folders.find(f => f.id === folderId);
        if (folder) this.showSpaceContextMenu(e, folder);
      });
    });
  };

  proto.showCreateSpaceModal = function() {
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
  };

  proto.hideCreateSpaceModal = function() {
    document.getElementById('create-space-modal')?.classList.add('hidden');
  };

  proto.showChooseColorModal = function() {
    const modal = document.getElementById('choose-color-modal');
    if (!modal) return;
    this.pendingSpaceColor = '';
    modal.classList.remove('hidden');
    this.updateColorWheelSelection();
  };

  proto.hideChooseColorModal = function() {
    document.getElementById('choose-color-modal')?.classList.add('hidden');
  };

  proto.renderColorWheel = function() {
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
  };

  proto.updateColorWheelSelection = function() {
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
  };

  proto.createSpace = async function() {
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
  };

}
