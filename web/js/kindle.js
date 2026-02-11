export function applyKindleMixin(proto) {
  proto.loadKindleHighlights = async function() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    loading.classList.remove('hidden');
    container.innerHTML = '';

    const { data, error } = await this.supabase
      .from('saves')
      .select('*')
      .eq('source', 'kindle')
      .order('title', { ascending: true });

    loading.classList.add('hidden');

    if (error) {
      console.error('Error loading Kindle highlights:', error);
      return;
    }

    if (!data || data.length === 0) {
      empty.classList.remove('hidden');
      document.querySelector('.empty-icon').textContent = '📚';
      document.querySelector('.empty-state h3').textContent = 'No Kindle highlights yet';
      document.querySelector('.empty-state p').textContent = 'Import your Kindle highlights using the "Import Kindle" button in the sidebar, or sync from the Chrome extension.';
      return;
    }

    empty.classList.add('hidden');

    // Group by book title
    const books = {};
    data.forEach(save => {
      const key = save.title || 'Unknown Book';
      if (!books[key]) {
        books[key] = {
          title: save.title,
          author: save.author,
          highlights: [],
        };
      }
      books[key].highlights.push(save);
    });

    // Sort books by highlight count (most first)
    const sortedBooks = Object.values(books).sort((a, b) => b.highlights.length - a.highlights.length);

    this.renderKindleBooks(sortedBooks);
  };

  proto.renderKindleBooks = function(books) {
    const container = document.getElementById('saves-container');

    container.innerHTML = `
      <div class="kindle-stats">
        <div class="kindle-stat">
          <span class="kindle-stat-value">${books.reduce((sum, b) => sum + b.highlights.length, 0)}</span>
          <span class="kindle-stat-label">highlights</span>
        </div>
        <div class="kindle-stat">
          <span class="kindle-stat-value">${books.length}</span>
          <span class="kindle-stat-label">books</span>
        </div>
        <button class="btn secondary kindle-clear-btn" id="clear-kindle-btn">Clear All Kindle Data</button>
      </div>
      <div class="kindle-books-grid">
        ${books.map(book => `
          <div class="kindle-book-card" data-title="${this.escapeHtml(book.title || '')}">
            <div class="kindle-book-header">
              <div class="kindle-book-icon">📖</div>
              <div class="kindle-book-info">
                <h3 class="kindle-book-title">${this.escapeHtml(book.title || 'Unknown Book')}</h3>
                ${book.author ? `<p class="kindle-book-author">${this.escapeHtml(book.author)}</p>` : ''}
              </div>
              <span class="kindle-book-count">${book.highlights.length}</span>
            </div>
            <div class="kindle-highlights-preview">
              ${book.highlights.slice(0, 3).map(h => `
                <div class="kindle-highlight-snippet" data-id="${h.id}">
                  "${this.escapeHtml(h.highlight?.substring(0, 150) || '')}${h.highlight?.length > 150 ? '...' : ''}"
                </div>
              `).join('')}
              ${book.highlights.length > 3 ? `
                <div class="kindle-more-highlights">+${book.highlights.length - 3} more highlights</div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Bind click events to open highlights
    container.querySelectorAll('.kindle-highlight-snippet').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const allHighlights = books.flatMap(b => b.highlights);
        const save = allHighlights.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });

    // Bind book card clicks to expand
    container.querySelectorAll('.kindle-book-card').forEach(card => {
      card.addEventListener('click', () => {
        const title = card.dataset.title;
        const book = books.find(b => (b.title || '') === title);
        if (book) this.showBookHighlights(book);
      });
    });

    // Clear Kindle data button
    const clearBtn = document.getElementById('clear-kindle-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearKindleData());
    }
  };

  proto.clearKindleData = async function() {
    const count = this.saves?.length || 0;
    if (!confirm(`Delete all ${count} Kindle highlights? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('saves')
        .delete()
        .eq('source', 'kindle');

      if (error) throw error;

      alert('All Kindle data cleared. You can now re-sync from the Chrome extension.');
      this.loadKindleHighlights();
    } catch (err) {
      console.error('Error clearing Kindle data:', err);
      alert('Failed to clear data: ' + err.message);
    }
  };

  proto.showBookHighlights = function(book) {
    const container = document.getElementById('saves-container');

    container.innerHTML = `
      <div class="kindle-book-detail">
        <button class="btn secondary kindle-back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to all books
        </button>
        <div class="kindle-book-detail-header">
          <div class="kindle-book-icon-large">📖</div>
          <div>
            <h2>${this.escapeHtml(book.title || 'Unknown Book')}</h2>
            ${book.author ? `<p class="kindle-book-author">${this.escapeHtml(book.author)}</p>` : ''}
            <p class="kindle-book-meta">${book.highlights.length} highlights</p>
          </div>
        </div>
        <div class="kindle-highlights-list">
          ${book.highlights.map(h => `
            <div class="kindle-highlight-card" data-id="${h.id}">
              <div class="kindle-highlight-text">"${this.escapeHtml(h.highlight || '')}"</div>
              <div class="kindle-highlight-meta">
                ${new Date(h.created_at).toLocaleDateString()}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Back button
    container.querySelector('.kindle-back-btn').addEventListener('click', () => {
      this.loadKindleHighlights();
    });

    // Highlight clicks
    container.querySelectorAll('.kindle-highlight-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const save = book.highlights.find(s => s.id === id);
        if (save) this.openReadingPane(save);
      });
    });
  };

  // Kindle Import Methods
  proto.showKindleImportModal = function() {
    const modal = document.getElementById('kindle-import-modal');
    modal.classList.remove('hidden');
    this.resetKindleImportModal();
  };

  proto.hideKindleImportModal = function() {
    const modal = document.getElementById('kindle-import-modal');
    modal.classList.add('hidden');
    this.resetKindleImportModal();
  };

  proto.resetKindleImportModal = function() {
    this.pendingKindleImport = null;
    document.getElementById('kindle-file-input').value = '';
    document.getElementById('kindle-import-preview').classList.add('hidden');
    document.getElementById('kindle-import-footer').classList.add('hidden');
    const dropzone = document.getElementById('kindle-dropzone');
    dropzone.classList.remove('success', 'processing');
  };

  proto.handleKindleFile = async function(file) {
    if (!file.name.endsWith('.txt')) {
      alert('Please upload a .txt file (My Clippings.txt from your Kindle)');
      return;
    }

    const dropzone = document.getElementById('kindle-dropzone');
    dropzone.classList.add('processing');

    try {
      const content = await file.text();
      const highlights = this.parseMyClippings(content);

      if (highlights.length === 0) {
        alert('No highlights found in this file. Make sure it\'s a valid My Clippings.txt file.');
        dropzone.classList.remove('processing');
        return;
      }

      // Check for duplicates against existing saves
      const { data: existingSaves } = await this.supabase
        .from('saves')
        .select('highlight, title')
        .not('highlight', 'is', null);

      const existingSet = new Set(
        (existingSaves || []).map(s => `${s.highlight}|||${s.title}`)
      );

      let duplicateCount = 0;
      const newHighlights = highlights.filter(h => {
        const key = `${h.highlight}|||${h.title}`;
        if (existingSet.has(key)) {
          duplicateCount++;
          return false;
        }
        return true;
      });

      this.pendingKindleImport = newHighlights;

      // Group by book for display
      const bookCounts = {};
      newHighlights.forEach(h => {
        const key = h.title;
        if (!bookCounts[key]) {
          bookCounts[key] = { title: h.title, author: h.author, count: 0 };
        }
        bookCounts[key].count++;
      });

      // Update UI
      dropzone.classList.remove('processing');
      dropzone.classList.add('success');

      document.getElementById('import-total').textContent = newHighlights.length;
      document.getElementById('import-books').textContent = Object.keys(bookCounts).length;
      document.getElementById('import-duplicates').textContent = duplicateCount;

      const booksList = document.getElementById('import-books-list');
      booksList.innerHTML = Object.values(bookCounts)
        .sort((a, b) => b.count - a.count)
        .map(book => `
          <div class="import-book-item">
            <div>
              <div class="import-book-title">${this.escapeHtml(book.title)}</div>
              ${book.author ? `<div class="import-book-author">${this.escapeHtml(book.author)}</div>` : ''}
            </div>
            <span class="import-book-count">${book.count}</span>
          </div>
        `).join('');

      document.getElementById('kindle-import-preview').classList.remove('hidden');
      document.getElementById('kindle-import-footer').classList.remove('hidden');

    } catch (error) {
      console.error('Error parsing Kindle file:', error);
      alert('Error reading the file. Please try again.');
      dropzone.classList.remove('processing');
    }
  };

  proto.parseMyClippings = function(content) {
    // Split by the Kindle clipping delimiter
    const clippings = content.split('==========').filter(c => c.trim());
    const highlights = [];

    for (const clipping of clippings) {
      const lines = clipping.trim().split('\n').filter(l => l.trim());
      if (lines.length < 3) continue;

      // First line: Book Title (Author)
      const titleLine = lines[0].trim();
      let title = titleLine;
      let author = null;

      // Extract author from parentheses at the end
      const authorMatch = titleLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (authorMatch) {
        title = authorMatch[1].trim();
        author = authorMatch[2].trim();
      }

      // Second line: metadata (type, location, date)
      const metaLine = lines[1].trim();

      // Check if this is a highlight (not a bookmark or note)
      if (!metaLine.toLowerCase().includes('highlight')) {
        continue; // Skip bookmarks and notes
      }

      // Extract date from metadata line
      let addedAt = null;
      const dateMatch = metaLine.match(/Added on (.+)$/i);
      if (dateMatch) {
        try {
          addedAt = new Date(dateMatch[1]).toISOString();
        } catch (e) {
          // Ignore date parsing errors
        }
      }

      // Remaining lines are the highlight text
      const highlightText = lines.slice(2).join('\n').trim();

      if (!highlightText) continue;

      highlights.push({
        title,
        author,
        highlight: highlightText,
        addedAt,
      });
    }

    return highlights;
  };

  proto.confirmKindleImport = async function() {
    if (!this.pendingKindleImport || this.pendingKindleImport.length === 0) {
      this.hideKindleImportModal();
      return;
    }

    const confirmBtn = document.getElementById('kindle-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing...';

    try {
      // Prepare saves for batch insert
      const saves = this.pendingKindleImport.map(h => ({
        user_id: this.user.id,
        title: h.title,
        author: h.author,
        highlight: h.highlight,
        site_name: 'Kindle',
        source: 'kindle',
        created_at: h.addedAt || new Date().toISOString(),
      }));

      // Insert in batches of 50 to avoid request size limits
      const batchSize = 50;
      for (let i = 0; i < saves.length; i += batchSize) {
        const batch = saves.slice(i, i + batchSize);
        const { error } = await this.supabase.from('saves').insert(batch);
        if (error) throw error;
      }

      // Success - close modal and refresh
      this.hideKindleImportModal();
      this.loadSaves();

      alert(`Successfully imported ${saves.length} highlights!`);

    } catch (error) {
      console.error('Error importing highlights:', error);
      alert('Error importing highlights. Please try again.');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Import Highlights';
    }
  };

  proto.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  proto.formatPrice = function(price, currency) {
    if (!price) return '';
    const currencySymbols = {
      'USD': '$',
      'GBP': '£',
      'EUR': '€',
      'JPY': '¥',
      'CNY': '¥',
      'KRW': '₩',
      'INR': '₹',
      'AUD': 'A$',
      'CAD': 'C$',
    };
    const symbol = currencySymbols[currency] || (currency ? `${currency} ` : '');
    return `${symbol}${price}`;
  };

  proto.renderMarkdown = function(text) {
    if (!text) return '';

    // Configure marked for safe rendering
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,  // Convert \n to <br>
        gfm: true,     // GitHub Flavored Markdown
      });

      try {
        return marked.parse(text);
      } catch (e) {
        console.error('Markdown parse error:', e);
        // Fallback to escaped plain text
        return `<div style="white-space: pre-wrap;">${this.escapeHtml(text)}</div>`;
      }
    }

    // Fallback if marked isn't loaded
    return `<div style="white-space: pre-wrap;">${this.escapeHtml(text)}</div>`;
  };

  proto.renderMarkdownPreview = function(text, maxLines = 8) {
    if (!text) return '';

    // Truncate to approximate number of lines (rough estimate)
    const lines = text.split('\n');
    const truncated = lines.slice(0, maxLines).join('\n');
    const wasTruncated = lines.length > maxLines;

    // Render markdown
    let html = this.renderMarkdown(truncated);

    // Add ellipsis if truncated
    if (wasTruncated) {
      html += '<span class="note-truncated">...</span>';
    }

    return html;
  };

  proto.bindTaskCheckboxes = function(container) {
    container.querySelectorAll('.task-list-item input[type="checkbox"]').forEach(checkbox => {
      // Add our custom class for styling
      checkbox.classList.add('task-checkbox');

      checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();

        const card = checkbox.closest('.save-card');
        if (!card) return;

        const saveId = card.dataset.id;
        const save = this.saves.find(s => s.id === saveId);
        if (!save) return;

        await this.toggleTaskInNote(save, checkbox);
      });
    });
  };

  proto.toggleTaskInNote = async function(save, checkbox) {
    let content = save.content || save.notes || '';
    const lines = content.split('\n');

    // Find which checkbox index was clicked
    const card = checkbox.closest('.save-card');
    const allCheckboxes = card.querySelectorAll('.task-checkbox');
    const checkboxIndex = Array.from(allCheckboxes).indexOf(checkbox);

    // Find and toggle the matching task in the content
    let taskIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^(\s*)?[-*]\s*\[([ xX])\]/)) {
        if (taskIndex === checkboxIndex) {
          const isChecked = checkbox.checked;
          lines[i] = lines[i].replace(
            /^(\s*)?([-*])\s*\[([ xX])\]/,
            isChecked ? '$1$2 [x]' : '$1$2 [ ]'
          );
          break;
        }
        taskIndex++;
      }
    }

    const newContent = lines.join('\n');

    try {
      await this.supabase
        .from('saves')
        .update({
          content: newContent,
          notes: newContent,
        })
        .eq('id', save.id);

      // Update local state
      save.content = newContent;
      save.notes = newContent;
    } catch (err) {
      console.error('Error updating task:', err);
      // Revert checkbox state on error
      checkbox.checked = !checkbox.checked;
    }
  };

  // Digest Settings Methods
  proto.showDigestModal = function() {
    const modal = document.getElementById('digest-modal');
    modal.classList.remove('hidden');
    this.loadDigestPreferences();
  };

  proto.hideDigestModal = function() {
    const modal = document.getElementById('digest-modal');
    modal.classList.add('hidden');
    document.getElementById('digest-status').classList.add('hidden');
  };

  // Quick Add (Vision V2)
  proto.showQuickAddModal = function() {
    const modal = document.getElementById('quick-add-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.resetQuickAddForm();
  };

  proto.hideQuickAddModal = function() {
    const modal = document.getElementById('quick-add-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    this.resetQuickAddForm();
  };

  proto.resetQuickAddForm = function() {
    document.getElementById('quick-add-title').value = '';
    document.getElementById('quick-add-url').value = '';
    document.getElementById('quick-add-note').value = '';
    document.getElementById('quick-add-file').value = '';
    this.clearImagePreview();
    this.switchQuickAddType('url');
    this.setQuickAddStatus('', '');
  };

  proto.switchQuickAddType = function(type) {
    const tabs = document.querySelectorAll('.quick-add-tab');
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.type === type));

    document.querySelectorAll('.quick-add-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.panel !== type);
    });
  };

  proto.setQuickAddStatus = function(message, type) {
    const status = document.getElementById('quick-add-status');
    if (!status) return;
    if (!message) {
      status.classList.add('hidden');
      status.textContent = '';
      status.className = 'quick-add-status hidden';
      return;
    }
    status.textContent = message;
    status.className = `quick-add-status ${type || ''}`;
    status.classList.remove('hidden');
  };

  proto.saveQuickAdd = async function() {
    const activeTab = document.querySelector('.quick-add-tab.active');
    const type = activeTab?.dataset.type || 'url';
    const title = document.getElementById('quick-add-title').value.trim();
    const url = document.getElementById('quick-add-url').value.trim();
    const note = document.getElementById('quick-add-note').value.trim();
    const file = this.pendingImageFile;

    if (type === 'url' && !url) {
      this.setQuickAddStatus('Please enter a URL.', 'error');
      return;
    }

    if (type === 'note' && !note) {
      this.setQuickAddStatus('Please enter a note.', 'error');
      return;
    }

    if (type === 'file' && !file) {
      this.setQuickAddStatus('Please select an image to upload.', 'error');
      return;
    }

    this.setQuickAddStatus('Saving...', '');

    try {
      let imageUrl = null;
      let storedUrl = null;

      if (type === 'file' && file) {
        const path = `${this.user.id}/${Date.now()}-${file.name || 'image.png'}`;
        const { error: uploadError } = await this.supabase
          .storage
          .from('uploads')
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data } = this.supabase.storage.from('uploads').getPublicUrl(path);
        storedUrl = data?.publicUrl || null;
        imageUrl = storedUrl;
      }

      const payload = {
        user_id: this.user.id,
        title: title || (type === 'file' ? (file?.name || 'Image') : (type === 'note' ? 'Quick Note' : url)),
        url: type === 'url' ? url : storedUrl,
        content: type === 'note' ? note : null,
        excerpt: type === 'note' ? note.slice(0, 180) : null,
        notes: type === 'note' ? note : null,
        site_name: type === 'note' ? 'Note' : (type === 'file' ? 'Image' : null),
        source: type === 'file' ? 'upload' : 'manual',
        image_url: imageUrl,
      };

      const { data: insertedSave, error } = await this.supabase
        .from('saves')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      this.setQuickAddStatus('Saved!', 'success');
      this.loadSaves();
      setTimeout(() => this.hideQuickAddModal(), 600);

      // Trigger auto-tagging in background
      if (insertedSave?.id) {
        this.triggerAutoTag(insertedSave.id);
        // Generate image embedding for file uploads (similarity search)
        if (type === 'file' && imageUrl) {
          this.generateImageEmbedding({
            id: insertedSave.id,
            image_url: imageUrl,
          }).catch(err => console.warn('Embedding generation failed:', err));
        }
      }
    } catch (err) {
      console.error('Quick add error:', err);
      this.setQuickAddStatus('Failed to save. Please try again.', 'error');
    }
  };

  proto.loadDigestPreferences = async function() {
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', this.user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      // Populate form with existing preferences or defaults
      const prefs = data || {};
      document.getElementById('digest-enabled').checked = prefs.digest_enabled || false;
      document.getElementById('digest-email').value = prefs.digest_email || '';
      document.getElementById('digest-day').value = prefs.digest_day ?? 0;
      document.getElementById('digest-hour').value = prefs.digest_hour ?? 9;

      // Update UI state
      this.updateDigestOptionsState();

    } catch (error) {
      console.error('Error loading digest preferences:', error);
    }
  };

  proto.updateDigestOptionsState = function() {
    const enabled = document.getElementById('digest-enabled').checked;
    const options = document.getElementById('digest-options');
    const schedule = document.getElementById('digest-schedule-group');

    if (enabled) {
      options.classList.remove('disabled');
      schedule.classList.remove('disabled');
    } else {
      options.classList.add('disabled');
      schedule.classList.add('disabled');
    }
  };

  proto.saveDigestPreferences = async function() {
    const status = document.getElementById('digest-status');
    const saveBtn = document.getElementById('digest-save-btn');

    const enabled = document.getElementById('digest-enabled').checked;
    const email = document.getElementById('digest-email').value.trim();
    const day = parseInt(document.getElementById('digest-day').value);
    const hour = parseInt(document.getElementById('digest-hour').value);

    // Validate email if enabled
    if (enabled && !email) {
      status.textContent = 'Please enter an email address';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
      return;
    }

    if (enabled && !email.includes('@')) {
      status.textContent = 'Please enter a valid email address';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      // Upsert preferences (insert or update)
      const { error } = await this.supabase
        .from('user_preferences')
        .upsert({
          user_id: this.user.id,
          digest_enabled: enabled,
          digest_email: email || null,
          digest_day: day,
          digest_hour: hour,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      status.textContent = enabled
        ? 'Digest enabled! You\'ll receive emails weekly.'
        : 'Digest disabled. You won\'t receive emails.';
      status.className = 'digest-status success';
      status.classList.remove('hidden');

      // Close modal after delay
      setTimeout(() => this.hideDigestModal(), 1500);

    } catch (error) {
      console.error('Error saving digest preferences:', error);
      status.textContent = 'Error saving preferences. Please try again.';
      status.className = 'digest-status error';
      status.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  };
}
