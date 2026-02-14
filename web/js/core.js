// Stash Web App (Single-user mode - no auth required)
export class StashApp {
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

    // Canvas state
    this.canvasNodes = [];
    this.canvasEdges = [];
    this.canvasPan = { x: 0, y: 0 };
    this.canvasZoom = 1.0;
    this.canvasDragState = null;
    this.canvasPanState = null;
    this.canvasConnecting = null;
    this.canvasSelectedEdgeId = null;
    this._canvasInitialized = false;
    this._nodeWasDragged = false;

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
  }
}

export function applyCorePrototype(proto) {
  // Theme Management
  proto.loadTheme = function() {
    const savedTheme = localStorage.getItem('stash-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeToggle(savedTheme);
  };

  proto.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('stash-theme', newTheme);
    this.updateThemeToggle(newTheme);
  };

  proto.updateThemeToggle = function(theme) {
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
  };

  proto.applyFeatureFlags = function() {
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
  };

  proto.loadCardPreferences = function() {
    this.showAnnotations = localStorage.getItem('stash-show-annotations') === 'true';
    this.isMoodBoard = localStorage.getItem('stash-mood-board') === 'true';
    this.colorFilter = localStorage.getItem('stash-color-filter') || 'all';
    document.body.classList.toggle('show-annotations', this.showAnnotations);
    this.updateAnnotationsToggleUI();
    this.updateMoodBoardToggleUI();
    this.updateColorFilterVisibility();
  };

  proto.updateAnnotationsToggleUI = function() {
    const btn = document.getElementById('toggle-annotations-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', this.showAnnotations ? 'true' : 'false');
    btn.textContent = this.showAnnotations ? 'Hide notes + tags' : 'Show notes + tags';
  };

  proto.updateMoodBoardToggleUI = function() {
    const btn = document.getElementById('toggle-moodboard-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', this.isMoodBoard ? 'true' : 'false');
    btn.textContent = this.isMoodBoard ? 'Standard view' : 'Mood board';
  };

  proto.updateColorFilterVisibility = function() {
    const filter = document.getElementById('color-filter');
    if (!filter) return;
    const viewAllows = !['weekly', 'stats', 'kindle'].includes(this.currentView);
    if (this.isMoodBoard && viewAllows) {
      filter.classList.remove('hidden');
    } else {
      filter.classList.add('hidden');
    }
  };

  proto.toggleAnnotations = function() {
    this.showAnnotations = !this.showAnnotations;
    localStorage.setItem('stash-show-annotations', this.showAnnotations);
    document.body.classList.toggle('show-annotations', this.showAnnotations);
    this.updateAnnotationsToggleUI();
  };

  proto.toggleMoodBoard = function() {
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
  };

  proto.setColorFilter = function(key) {
    if (!key || key === this.colorFilter) return;
    this.colorFilter = key;
    localStorage.setItem('stash-color-filter', this.colorFilter);
    this.renderColorFilters();
    const viewAllows = !['weekly', 'stats', 'kindle'].includes(this.currentView);
    if (viewAllows) {
      this.renderSaves();
    }
  };

  proto.renderColorFilters = function() {
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
  };

  proto.getColorCounts = function() {
    const counts = {};
    this.saves.forEach(save => {
      const bucket = this.getSaveColorBucket(save);
      if (!bucket) return;
      counts[bucket] = (counts[bucket] || 0) + 1;
    });
    return counts;
  };

  proto.getSaveColorBucket = function(save) {
    if (!save) return null;
    const entry = this.saveColorMap[save.id];
    if (entry?.bucket) return entry.bucket;
    if (!save.image_url) return 'neutral';
    return null;
  };

  proto.loadImageColorCache = function() {
    try {
      return JSON.parse(localStorage.getItem('stash-image-colors') || '{}');
    } catch (e) {
      return {};
    }
  };

  proto.saveImageColorCache = function() {
    localStorage.setItem('stash-image-colors', JSON.stringify(this.imageColorCache));
  };
}
