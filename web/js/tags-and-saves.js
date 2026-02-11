export function applyTagsAndSavesMixin(proto) {
  proto.addTagToSave = async function() {
    if (!this.currentSave) return;

    const tagName = prompt('Enter tag name:');
    if (!tagName?.trim()) return;

    // Get or create tag
    let { data: existingTag } = await this.supabase
      .from('tags')
      .select('*')
      .eq('name', tagName.trim())
      .single();

    if (!existingTag) {
      const { data: newTag } = await this.supabase
        .from('tags')
        .insert({ user_id: this.user.id, name: tagName.trim() })
        .select()
        .single();
      existingTag = newTag;
    }

    if (existingTag) {
      await this.supabase
        .from('save_tags')
        .insert({ save_id: this.currentSave.id, tag_id: existingTag.id });

      this.loadTags();
      this.loadSaveTags(this.currentSave.id);
      await this.loadSaveTagMapForSaves(this.saves);
      if (this.showAnnotations) this.renderSaves();
    }
  };

  proto.loadSaveTags = async function(saveId) {
    const { data } = await this.supabase
      .from('save_tags')
      .select('tag_id, tags(id, name, color)')
      .eq('save_id', saveId);

    this.currentSaveTags = data || [];
    this.renderSaveTags();
  };

  proto.renderSaveTags = function() {
    const container = document.getElementById('reading-tags-list');
    if (!container) return;

    if (!this.currentSaveTags || this.currentSaveTags.length === 0) {
      container.innerHTML = '<span class="no-tags">No tags</span>';
      return;
    }

    container.innerHTML = this.currentSaveTags.map(st => `
      <span class="save-tag" style="background: ${st.tags.color}20; border-color: ${st.tags.color}">
        ${this.escapeHtml(st.tags.name)}
        <button class="tag-remove" data-tag-id="${st.tags.id}" title="Remove tag">&times;</button>
      </span>
    `).join('');

    // Bind remove handlers
    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTagFromSave(this.currentSave.id, btn.dataset.tagId);
      });
    });
  };

  proto.removeTagFromSave = async function(saveId, tagId) {
    await this.supabase
      .from('save_tags')
      .delete()
      .eq('save_id', saveId)
      .eq('tag_id', tagId);

    this.loadSaveTags(saveId);
    await this.loadSaveTagMapForSaves(this.saves);
    if (this.showAnnotations) this.renderSaves();

    if (this.currentSave?.id === saveId) {
      this.loadModalTags(this.currentSave);
    }
  };

  proto.addTagByName = async function(save, tagName) {
    if (!tagName?.trim()) return;

    // Get or create tag
    let { data: existingTag } = await this.supabase
      .from('tags')
      .select('*')
      .eq('name', tagName.trim())
      .single();

    if (!existingTag) {
      const { data: newTag } = await this.supabase
        .from('tags')
        .insert({ user_id: this.user.id, name: tagName.trim() })
        .select()
        .single();
      existingTag = newTag;
    }

    if (existingTag) {
      // Check if tag already added
      const { data: existing } = await this.supabase
        .from('save_tags')
        .select('*')
        .eq('save_id', save.id)
        .eq('tag_id', existingTag.id)
        .single();

      if (!existing) {
        await this.supabase
          .from('save_tags')
          .insert({ save_id: save.id, tag_id: existingTag.id });
      }

      this.loadTags();
      await this.loadSaveTagMapForSaves(this.saves);
      if (this.showAnnotations) this.renderSaves();
      this.showToast('Tag added', 'success');

      if (this.currentSave?.id === save.id) {
        this.loadModalTags(this.currentSave);
      }
    }
  };

  proto.populateBookModalTags = async function(save) {
    const container = document.getElementById('book-modal-tags');
    if (!container) return;

    // Fetch tags for this save
    const { data } = await this.supabase
      .from('save_tags')
      .select('tag_id, tags(id, name, color)')
      .eq('save_id', save.id);

    const tags = data || [];

    if (tags.length === 0) {
      container.innerHTML = '<span class="no-tags" style="color: var(--text-muted); font-size: 13px;">No tags yet</span>';
      return;
    }

    container.innerHTML = tags.map(st => `
      <span class="book-tag" data-tag-id="${st.tags.id}">${this.escapeHtml(st.tags.name)}</span>
    `).join('');
  };

  proto.updateSaveFolder = async function(folderId) {
    if (!this.currentSave) return;

    await this.supabase
      .from('saves')
      .update({ folder_id: folderId })
      .eq('id', this.currentSave.id);

    this.currentSave.folder_id = folderId;

    // Refresh saves list if filtering by folder
    if (this.currentFolderId) {
      this.loadSaves();
    }
  };

  proto.debouncedSaveNotes = function(notes) {
    document.getElementById('notes-status').textContent = 'Saving...';

    clearTimeout(this.notesTimeout);
    this.notesTimeout = setTimeout(() => {
      this.saveNotes(notes);
    }, 1000); // 1 second debounce
  };

  proto.saveNotes = async function(notes) {
    if (!this.currentSave) return;

    try {
      await this.supabase
        .from('saves')
        .update({ notes })
        .eq('id', this.currentSave.id);

      this.currentSave.notes = notes;
      document.getElementById('notes-status').textContent = 'Saved';
      if (this.showAnnotations) this.renderSaves();
      setTimeout(() => {
        const status = document.getElementById('notes-status');
        if (status.textContent === 'Saved') {
          status.textContent = '';
        }
      }, 2000);
    } catch (err) {
      document.getElementById('notes-status').textContent = 'Failed to save';
    }
  };

  proto.addFolder = async function() {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;

    await this.supabase
      .from('folders')
      .insert({ user_id: this.user.id, name: name.trim() });

    this.loadFolders();
  };

  proto.showStats = async function() {
    const { data: saves } = await this.supabase
      .from('saves')
      .select('created_at, highlight, is_archived');

    const totalSaves = saves?.length || 0;
    const highlights = saves?.filter(s => s.highlight)?.length || 0;
    const articles = totalSaves - highlights;
    const archived = saves?.filter(s => s.is_archived)?.length || 0;

    // Group by month
    const byMonth = {};
    saves?.forEach(s => {
      const month = new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    const content = document.querySelector('.content');
    content.innerHTML = `
      <div class="stats-container">
        <div class="stats-header">
          <h2>Your Stats</h2>
          <button class="btn secondary" onclick="app.setView('all')">← Back</button>
        </div>

        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-card-value">${totalSaves}</div>
            <div class="stat-card-label">Total Saves</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${articles}</div>
            <div class="stat-card-label">Articles</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${highlights}</div>
            <div class="stat-card-label">Highlights</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${archived}</div>
            <div class="stat-card-label">Archived</div>
          </div>
        </div>

        <div class="stats-section">
          <h3>Saves by Month</h3>
          <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px;">
            ${Object.entries(byMonth).slice(-6).map(([month, count]) => `
              <div>
                <div style="font-size: 24px; font-weight: 600; color: var(--primary);">${count}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${month}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  };
}
