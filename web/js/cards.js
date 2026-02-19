export function applyCardsMixin(proto) {
  proto.renderSaves = function() {
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
        // Don't open reading pane if clicking a task checkbox
        if (e.target.classList.contains('task-checkbox') ||
            (e.target.tagName === 'INPUT' && e.target.type === 'checkbox' && e.target.closest('.task-list-item'))) return;
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
  };

  proto.initMasonry = function(container) {
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
  };

  // Weekly Review special rendering
  proto.renderWeeklyReview = function() {
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
  };

  proto.loadRediscovery = async function() {
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
  };

  proto.shuffleRediscovery = function() {
    if (!this.rediscoverySaves || this.rediscoverySaves.length === 0) return;
    const save = this.rediscoverySaves[Math.floor(Math.random() * this.rediscoverySaves.length)];
    this.updateRediscovery(save);
  };

  proto.updateRediscovery = function(save) {
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
  };
}
