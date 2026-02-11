export function applyViewsMixin(proto) {
  proto.loadTags = async function() {
    const { data } = await this.supabase
      .from('tags')
      .select('*')
      .order('name');

    this.tags = data || [];
    this.renderTags();
  };

  proto.renderTags = function() {
    const container = document.getElementById('tags-list');
    container.innerHTML = this.tags.map(tag => `
      <span class="tag${this.currentTagId === tag.id ? ' active' : ''}" data-id="${tag.id}">${this.escapeHtml(tag.name)}</span>
    `).join('');

    container.querySelectorAll('.tag').forEach(el => {
      el.addEventListener('click', () => {
        this.filterByTag(el.dataset.id);
      });
    });
  };

  proto.filterByTag = function(tagId) {
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
  };

  proto.loadFolders = async function() {
    const { data } = await this.supabase
      .from('folders')
      .select('*')
      .not('is_archived', 'eq', true)
      .order('name');

    this.folders = data || [];
    this.renderFolders();
  };

  proto.renderFolders = function() {
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
  };

  proto.filterByFolder = function(folderId) {
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
  };

  proto.setView = function(view) {
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
  };

  proto.search = async function(query) {
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
  };

  proto.openReadingPane = function(save) {
    this.currentSave = save;
    // Use unified modal for all save types (including notes)
    this.openUnifiedModal(save);
  };

  // Legacy reading pane (kept for backward compatibility)
  proto.openLegacyReadingPane = function(save) {
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
  };

  // Image lightbox
  proto.openImageLightbox = function(save) {
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
  };

  proto.closeReadingPane = function() {
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
  };
}
