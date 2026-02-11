export function applyModalMixin(proto) {
  proto.openUnifiedModal = function(save) {
    const modal = document.getElementById('unified-modal');
    const saveType = this.getSaveType(save);
    const modalLayout = modal.querySelector('.modal-layout');
    const modalMain = modal.querySelector('.modal-main');
    const modalSidebar = modal.querySelector('.modal-sidebar');
    const modalHeader = modal.querySelector('.modal-header');

    // Stop any existing audio
    this.stopAudio();

    // Reset modal layout classes
    modalLayout.classList.remove('book-modal-active');
    modalMain.style.display = '';
    modalSidebar.style.display = '';
    if (modalHeader) modalHeader.style.display = '';

    // Render body based on save type
    const modalBody = document.getElementById('modal-body');
    modalBody.className = `modal-body modal-body-${saveType}`;

    // Special handling for books - use full-width custom layout
    if (saveType === 'book') {
      modalLayout.classList.add('book-modal-active');
      if (modalHeader) modalHeader.style.display = 'none';
      modalSidebar.style.display = 'none';
      modalBody.innerHTML = this.renderBookModalBody(save);
      // Fixed background color #3E3D52 - no dominant color extraction needed
      this.attachBookModalEventListeners(save);

      // Show modal
      modal.classList.remove('hidden');
      return;
    }

    // Regular modal flow for other save types
    // Populate header
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) {
      modalTitle.textContent = save.title || 'Untitled';
    }
    const modalMeta = document.getElementById('modal-meta');
    if (modalMeta) {
      modalMeta.innerHTML = `
        ${save.site_name || ''} ${save.author ? `· ${save.author}` : ''} · ${new Date(save.created_at).toLocaleDateString()}
      `;
    }

    switch(saveType) {
      case 'book':
        modalBody.innerHTML = this.renderBookModalBody(save);
        // Fixed background color #3E3D52 - no dominant color extraction needed
        break;
      case 'image':
        modalBody.innerHTML = this.renderImageModalBody(save);
        break;
      case 'product':
        modalBody.innerHTML = this.renderProductModalBody(save);
        break;
      case 'voice':
        modalBody.innerHTML = this.renderVoiceModalBody(save);
        break;
      case 'note':
        modalBody.innerHTML = this.renderNoteModalBody(save);
        break;
      case 'highlight':
        modalBody.innerHTML = this.renderHighlightModalBody(save);
        break;
      default: // article, link
        modalBody.innerHTML = this.renderArticleModalBody(save);
    }

    // Populate sidebar
    this.populateModalSidebar(save);

    // Show modal
    modal.classList.remove('hidden');

    // Attach event listeners
    this.attachModalEventListeners(save);
  };

  proto.renderArticleModalBody = function(save) {
    const content = save.content || save.excerpt || 'No content available.';
    return `
      ${save.image_url ? `<img src="${save.image_url}" class="modal-hero-image" alt="">` : ''}
      <div class="modal-article-content">
        ${this.renderMarkdown(content)}
      </div>
    `;
  };

  proto.renderImageModalBody = function(save) {
    return `
      <div class="modal-image-container">
        <img src="${save.image_url}" alt="${this.escapeHtml(save.title || 'Image')}" class="modal-full-image">
        <div class="modal-image-actions">
          <button id="modal-image-similar" class="image-action-btn">
            <img src="https://www.figma.com/api/mcp/asset/09ace2b5-c661-462c-ae60-3e2ce5952d28" alt="">
            <span>Same Vibe</span>
          </button>
          <button id="modal-image-autotag" class="image-action-btn">
            <span>Auto-tag</span>
          </button>
          <a href="${save.image_url}" download class="image-action-btn">
            <span>Download</span>
          </a>
        </div>
      </div>
    `;
  };

  proto.renderHighlightModalBody = function(save) {
    return `
      <blockquote class="modal-highlight">
        "${this.escapeHtml(save.highlight)}"
      </blockquote>
      ${save.url ? `<p><a href="${save.url}" target="_blank" class="modal-source-link">View original →</a></p>` : ''}
    `;
  };

  proto.renderVoiceModalBody = function(save) {
    if (!save.content) {
      return `
        <div class="modal-voice-pending">
          <div class="voice-pending-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <p>Transcription in progress...</p>
          <button class="btn secondary" id="voice-retry-transcribe">Retry transcription</button>
        </div>
      `;
    }

    return `
      <div class="modal-voice-container">
        <div class="modal-voice-transcription">${this.renderMarkdown(save.content)}</div>
      </div>
    `;
  };

  proto.renderNoteModalBody = function(save) {
    return `
      <div class="modal-note-editor">
        <div class="modal-note-toolbar">
          <button type="button" class="note-format-btn" data-format="bold" title="Bold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="italic" title="Italic">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="heading" title="Heading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4v16"></path><path d="M18 4v16"></path><path d="M6 12h12"></path></svg>
          </button>
          <span class="note-toolbar-divider"></span>
          <button type="button" class="note-format-btn" data-format="bullet" title="Bullet List">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><circle cx="4" cy="6" r="1" fill="currentColor"></circle><circle cx="4" cy="12" r="1" fill="currentColor"></circle><circle cx="4" cy="18" r="1" fill="currentColor"></circle></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="todo" title="To-do List">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="6" height="6" rx="1"></rect><path d="M11 7h10"></path><rect x="3" y="13" width="6" height="6" rx="1"></rect><path d="M11 15h10"></path></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="blockquote" title="Quote">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"></path></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="code" title="Code Block">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          </button>
          <button type="button" class="note-format-btn" data-format="divider" title="Divider">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <span class="note-toolbar-divider"></span>
          <button type="button" class="note-format-btn" id="modal-note-preview-toggle" title="Toggle Preview">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button type="button" class="note-format-btn" id="modal-note-color-btn" title="Background Color">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
          </button>
        </div>
        <textarea id="modal-note-content" class="modal-note-textarea" placeholder="Write your note...">${this.escapeHtml(save.content || save.notes || '')}</textarea>
        <div id="modal-note-preview" class="modal-note-preview hidden"></div>
      </div>
    `;
  };

  proto.renderProductModalBody = function(save) {
    const siteLabel = save.site_name ? `Purchase at ${this.escapeHtml(save.site_name)}` : 'Purchase';
    const description = this.escapeHtml(save.excerpt || '');
    return `
      <div class="modal-product-view">
        <div class="modal-product-image">
          <img src="${save.image_url}" alt="${this.escapeHtml(save.title || 'Product')}">
        </div>
        <a href="${save.url || '#'}" target="_blank" class="modal-product-purchase">
          <img src="https://www.figma.com/api/mcp/asset/3908d328-f6ca-45a7-b406-24fa5ac56bb1" alt="">
          <span>${siteLabel}</span>
        </a>
        ${description ? `<div class="modal-product-description">${description}</div>` : ''}
      </div>
    `;
  };

  proto.renderBookModalBody = function(save) {
    const description = save.excerpt || save.content || '';
    return `
      <div class="book-modal-layout">
        <!-- Left panel: Metadata on left side, Book cover on right side -->
        <div class="book-modal-left" id="book-modal-left">
          <div class="book-meta-section">
            ${save.author ? `
              <div class="book-meta-item">
                <svg class="book-meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <div class="book-meta-content">
                  <div class="book-meta-label">AUTHOR</div>
                  <div class="book-meta-value">${this.escapeHtml(save.author)}</div>
                </div>
              </div>
            ` : ''}
            ${save.book_page_count ? `
              <div class="book-meta-item">
                <svg class="book-meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <div class="book-meta-content">
                  <div class="book-meta-label">PAGE COUNT</div>
                  <div class="book-meta-value">${save.book_page_count} Pages</div>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="book-cover-section">
            <div class="book-cover-3d">
              <img src="${save.image_url}" alt="${this.escapeHtml(save.title)}" id="book-modal-cover">
            </div>
          </div>

          <button class="book-read-btn${save.read_status === 'finished' ? ' finished' : ''}" id="book-read-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${save.read_status === 'finished' ?
                '<polyline points="20 6 9 17 4 12"></polyline>' :
                '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>'
              }
            </svg>
            <span>${save.read_status === 'finished' ? 'Finished' : "I've read this book"}</span>
          </button>
        </div>

        <!-- Right panel: Title, TLDR, Tags, Notes (scrollable) -->
        <div class="book-modal-right">
          <button class="book-modal-close" id="book-modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div class="book-modal-scroll">
            <div class="book-modal-header">
              <h1 class="book-modal-title">${this.escapeHtml(save.title || 'Untitled')}</h1>
              ${save.site_name ? `
                <a href="${save.url || '#'}" target="_blank" class="book-modal-source">
                  ${this.escapeHtml(save.site_name)}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 17L17 7"></path>
                    <path d="M7 7h10v10"></path>
                  </svg>
                </a>
              ` : ''}
            </div>

            ${description ? `
              <div class="book-tldr-section">
                <label class="book-section-label">TLDR</label>
                <div class="book-tldr-content" id="book-tldr-content">
                  <div class="book-tldr-text">${this.escapeHtml(description)}</div>
                </div>
              </div>
            ` : ''}

            <div class="book-tags-section">
              <label class="book-section-label">MIND TAGS <span class="book-section-icon">🧠</span></label>
              <div id="book-modal-tags" class="book-modal-tags"></div>
              <button class="book-add-tag-btn" id="book-add-tag-btn">+ Add tag</button>
              <div class="book-tag-input-wrapper hidden" id="book-tag-input-wrapper">
                <input type="text" class="book-tag-input" id="book-tag-input" placeholder="Enter tag name...">
                <button class="book-tag-add-btn" id="book-tag-submit-btn">Add</button>
              </div>
            </div>

            <div class="book-notes-section">
              <label class="book-section-label">MIND NOTES <span class="book-section-icon">📝</span></label>
              <textarea id="book-modal-notes" class="book-modal-notes" placeholder="Type here to add a note...">${this.escapeHtml(save.notes || '')}</textarea>
            </div>

            <div class="book-modal-actions">
              <button class="book-action-btn" id="book-delete-btn" title="Delete">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button class="book-action-btn" id="book-share-btn" title="Share">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
              </button>
              <button class="book-action-btn" id="book-more-btn" title="More">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="19" cy="12" r="1"></circle>
                  <circle cx="5" cy="12" r="1"></circle>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  proto.initBookCoverColor = async function(save) {
    if (!save.image_url) return;

    try {
      let dominantColor = save.dominant_color;

      // Extract and store dominant color if not already cached
      if (!dominantColor) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = save.image_url;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        dominantColor = this.extractDominantColor(imageData);

        // Store in database for future use
        await this.supabase
          .from('saves')
          .update({ dominant_color: dominantColor })
          .eq('id', save.id);

        save.dominant_color = dominantColor;
      }

      // Apply dominant color (toned down 30%) to the left panel
      const leftPanel = document.getElementById('book-modal-left');
      if (leftPanel && dominantColor) {
        // Tone down the color by mixing with dark gray
        const tonedColor = this.toneDownColor(dominantColor, 0.3);
        leftPanel.style.background = tonedColor;
      }
    } catch (e) {
      console.error('Failed to extract book cover color:', e);
    }
  };

  // Tone down a color by mixing it with a dark base
  proto.toneDownColor = function(hexColor, amount) {
    // Parse hex color
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Mix with dark base (#3E3D52) - tone down by amount
    const darkR = 62, darkG = 61, darkB = 82;
    const newR = Math.round(r * (1 - amount) + darkR * amount);
    const newG = Math.round(g * (1 - amount) + darkG * amount);
    const newB = Math.round(b * (1 - amount) + darkB * amount);

    // Ensure the result is not too bright - cap at 60% brightness
    const brightness = (newR + newG + newB) / 3;
    if (brightness > 100) {
      const factor = 100 / brightness;
      return `rgb(${Math.round(newR * factor)}, ${Math.round(newG * factor)}, ${Math.round(newB * factor)})`;
    }

    return `rgb(${newR}, ${newG}, ${newB})`;
  };

  proto.extractDominantColor = function(imageData) {
    const data = imageData.data;
    const colorCounts = {};

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip very light or very dark colors
      if (r > 240 && g > 240 && b > 240) continue;
      if (r < 20 && g < 20 && b < 20) continue;

      const key = `${Math.floor(r/10)*10},${Math.floor(g/10)*10},${Math.floor(b/10)*10}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    }

    // Find most common color
    let maxCount = 0;
    let dominantColor = '0,0,0';
    for (const [color, count] of Object.entries(colorCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    }

    return `rgb(${dominantColor})`;
  };

  proto.attachBookModalEventListeners = function(save) {
    this.currentSave = save;

    // Populate tags
    this.populateBookModalTags(save);

    // Close button
    document.getElementById('book-modal-close')?.addEventListener('click', () => {
      this.closeUnifiedModal();
    });

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeUnifiedModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Delete button
    document.getElementById('book-delete-btn')?.addEventListener('click', async () => {
      if (confirm('Delete this book?')) {
        await this.supabase.from('saves').delete().eq('id', save.id);
        this.closeUnifiedModal();
        this.loadSaves();
        this.showToast('Book deleted', 'success');
      }
    });

    // Read status button
    document.getElementById('book-read-btn')?.addEventListener('click', async () => {
      const newStatus = save.read_status === 'finished' ? 'unread' : 'finished';
      await this.supabase
        .from('saves')
        .update({ read_status: newStatus })
        .eq('id', save.id);
      save.read_status = newStatus;

      const btn = document.getElementById('book-read-btn');
      if (btn) {
        btn.classList.toggle('finished', newStatus === 'finished');
        const iconSvg = btn.querySelector('svg');
        const textSpan = btn.querySelector('span');
        if (newStatus === 'finished') {
          iconSvg.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
          textSpan.textContent = 'Finished';
        } else {
          iconSvg.innerHTML = '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>';
          textSpan.textContent = "I've read this book";
        }
      }
      this.showToast(newStatus === 'finished' ? 'Marked as read!' : 'Marked as unread', 'success');
    });

    // Add tag button - toggle input form
    const addTagBtn = document.getElementById('book-add-tag-btn');
    const tagInputWrapper = document.getElementById('book-tag-input-wrapper');
    const tagInput = document.getElementById('book-tag-input');
    const tagSubmitBtn = document.getElementById('book-tag-submit-btn');

    addTagBtn?.addEventListener('click', () => {
      tagInputWrapper?.classList.toggle('hidden');
      if (!tagInputWrapper?.classList.contains('hidden')) {
        tagInput?.focus();
      }
    });

    // Submit tag
    const submitTag = async () => {
      const tagName = tagInput?.value?.trim();
      if (tagName) {
        await this.addTagByName(save, tagName);
        tagInput.value = '';
        tagInputWrapper?.classList.add('hidden');
        this.populateBookModalTags(save);
      }
    };

    tagSubmitBtn?.addEventListener('click', submitTag);
    tagInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitTag();
      }
    });

    // TLDR click to expand/collapse
    const tldrContent = document.getElementById('book-tldr-content');
    if (tldrContent) {
      tldrContent.addEventListener('click', () => {
        tldrContent.classList.toggle('expanded');
      });
    }

    // Notes auto-save
    const notesTextarea = document.getElementById('book-modal-notes');
    if (notesTextarea) {
      let saveTimeout;
      notesTextarea.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await this.supabase
            .from('saves')
            .update({ notes: notesTextarea.value })
            .eq('id', save.id);
          save.notes = notesTextarea.value;
        }, 500);
      });
    }

    // Share button
    document.getElementById('book-share-btn')?.addEventListener('click', async () => {
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
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(save.url || save.title);
        this.showToast('Link copied!', 'success');
      }
    });
  };

  proto.renderBookModalTags = async function(save) {
    const container = document.getElementById('book-modal-tags');
    if (!container) return;

    const tags = this.saveTagMap[save.id] || [];
    if (tags.length === 0) {
      container.innerHTML = '<span class="no-tags" style="color: var(--text-muted); font-size: 13px;">No tags yet</span>';
      return;
    }
    container.innerHTML = tags.map(tag => `
      <span class="book-tag" data-tag-id="${tag.id}">${this.escapeHtml(tag.name)}</span>
    `).join('');
  };

  proto.populateModalSidebar = function(save) {
    const saveType = this.getSaveType(save);

    this.updateModalSaveSummary(save);

    // Update button states
    document.getElementById('modal-archive-btn').classList.toggle('active', save.is_archived);
    this.updateModalContextMenuState(save);

    // Show/hide voice memo audio player
    const audioSection = document.getElementById('modal-audio-section');
    if (audioSection) {
      if (saveType === 'voice' && save.audio_url) {
        audioSection.classList.remove('hidden');
        this.initModalAudioPlayer(save.audio_url);
      } else {
        audioSection.classList.add('hidden');
      }
    }

    // Show/hide book-specific sections
    const tldrSection = document.getElementById('modal-tldr-section');
    const readStatusSection = document.getElementById('modal-read-status-section');

    if (saveType === 'book') {
      // Show TLDR section if excerpt exists
      if (save.excerpt || save.content) {
        tldrSection.classList.remove('hidden');
        const tldrContent = save.excerpt || (save.content ? save.content.substring(0, 300) + '...' : '');
        document.getElementById('modal-tldr-content').textContent = tldrContent;
      } else {
        tldrSection.classList.add('hidden');
      }

      // Show reading status dropdown
      readStatusSection.classList.remove('hidden');
      document.getElementById('modal-read-status-select').value = save.read_status || 'unread';
    } else {
      tldrSection.classList.add('hidden');
      readStatusSection.classList.add('hidden');
    }

    // Load and display tags
    this.loadModalTags(save);

    // Populate notes
    document.getElementById('modal-notes-textarea').value = save.notes || '';
    document.getElementById('modal-notes-status').textContent = '';
  };

  proto.loadModalTags = async function(save) {
    const tagsList = document.getElementById('modal-tags-list');
    if (!tagsList) return;

    const saveTags = this.saveTagMap[save.id] || [];
    const saveType = this.getSaveType(save);
    const saveTypePill = this.renderModalSaveTypePill(saveType);
    const spacePill = this.renderModalSpacePill(save.folder_id);

    const tagPills = saveTags.map(tag => {
      const color = '#FF794E';
      const bg = '#FF794E';
      return `
        <span class="modal-tag-pill" style="--tag-color: ${color}; --tag-bg: ${bg}">
          <span class="modal-tag-text">${this.escapeHtml(tag.name)}</span>
          <button class="modal-tag-remove" data-tag-id="${tag.id}" title="Remove tag">×</button>
        </span>
      `;
    }).join('');

    tagsList.innerHTML = saveTypePill + spacePill + tagPills;

    tagsList.querySelector('.modal-save-type-pill')?.addEventListener('click', () => {
      this.filterBySaveType(saveType);
      this.closeUnifiedModal();
    });

    tagsList.querySelectorAll('.modal-tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTagFromSave(save.id, btn.dataset.tagId);
      });
    });
  };

  proto.updateModalSaveSummary = function(save) {
    const titleEl = document.getElementById('modal-save-title');
    const dateEl = document.getElementById('modal-save-date');
    const sourceEl = document.getElementById('modal-save-source');
    const sourceTextEl = document.getElementById('modal-save-source-text');
    const separatorEl = document.getElementById('modal-save-separator');
    if (!titleEl || !dateEl || !sourceEl || !sourceTextEl || !separatorEl) return;

    const displayTitle = this.getSaveDisplayTitle(save);
    titleEl.textContent = displayTitle;
    titleEl.dataset.originalTitle = displayTitle;

    const saveDate = new Date(save.created_at);
    dateEl.textContent = saveDate.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });

    if (save.url) {
      const sourceLabel = this.getSourceLabel(save.url);
      sourceTextEl.textContent = sourceLabel;
      sourceEl.href = save.url;
      sourceEl.classList.remove('hidden');
      separatorEl.classList.remove('hidden');
    } else {
      sourceEl.classList.add('hidden');
      separatorEl.classList.add('hidden');
    }

    titleEl.onfocus = () => {
      titleEl.dataset.originalTitle = titleEl.textContent.trim();
    };

    titleEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl.blur();
      }
    };

    titleEl.onblur = async () => {
      const nextTitle = titleEl.textContent.trim() || 'Untitled';
      const original = titleEl.dataset.originalTitle || '';
      if (nextTitle !== original) {
        await this.updateSaveTitle(save, nextTitle);
        titleEl.dataset.originalTitle = nextTitle;
      } else {
        titleEl.textContent = nextTitle;
      }
    };
  };

  proto.getSaveDisplayTitle = function(save) {
    if (save?.title?.trim()) return save.title.trim();

    const saveType = this.getSaveType(save);
    if (saveType === 'product' && save.product_name) {
      return save.product_name;
    }
    if (saveType === 'book' && save.book_title) {
      return save.book_title;
    }
    if (saveType === 'image') {
      const filename = this.getFilenameFromUrl(save.image_url || save.url);
      if (filename) return filename;
    }

    return 'Untitled';
  };

  proto.getFilenameFromUrl = function(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const filename = parts[parts.length - 1];
      return filename ? decodeURIComponent(filename) : '';
    } catch (e) {
      return '';
    }
  };

  proto.getSourceLabel = function(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return this.getPrimaryDomain(host);
    } catch (e) {
      return '';
    }
  };

  proto.getPrimaryDomain = function(host) {
    if (!host) return '';
    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) {
      return parts[0] || host;
    }

    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    const third = parts[parts.length - 3];

    const commonSecondLevel = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'io']);
    if (commonSecondLevel.has(sld) && third) {
      return third;
    }

    return sld || host;
  };

  proto.updateSaveTitle = async function(save, title) {
    const { error } = await this.supabase
      .from('saves')
      .update({ title })
      .eq('id', save.id);

    if (!error) {
      save.title = title;
      const modalTitle = document.getElementById('modal-title');
      if (modalTitle) modalTitle.textContent = title;
      this.loadSaves();
    }
  };

  proto.attachModalEventListeners = function(save) {
    const modal = document.getElementById('unified-modal');
    const overlay = modal?.querySelector('.modal-overlay');
    const modalContainer = modal?.querySelector('.modal-container');

    const closeModal = () => this.closeUnifiedModal();

    if (overlay) {
      overlay.onclick = closeModal;
      overlay.addEventListener('click', closeModal, { capture: true, once: true });
    }

    // Escape key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    if (this.modalOutsideClickHandler) {
      document.removeEventListener('click', this.modalOutsideClickHandler);
      this.modalOutsideClickHandler = null;
    }

    let ignoreOutsideClick = true;
    setTimeout(() => {
      ignoreOutsideClick = false;
    }, 0);

    this.modalOutsideClickHandler = (e) => {
      if (ignoreOutsideClick) return;
      if (!modal || modal.classList.contains('hidden')) return;
      if (e.target.closest('.context-menu')) return;
      if (modalContainer && !modalContainer.contains(e.target)) {
        closeModal();
      }
    };
    document.addEventListener('click', this.modalOutsideClickHandler);

    this.bindModalSwipeToClose(modalContainer, closeModal);

    // Voice memo retry transcription
    const retryBtn = document.getElementById('voice-retry-transcribe');
    if (retryBtn && save.audio_url) {
      retryBtn.onclick = () => {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Retrying...';
        this.triggerTranscription(save.id, save.audio_url);
      };
    }

    // Action buttons
    document.getElementById('modal-archive-btn').onclick = () => this.toggleModalArchive(save);
    document.getElementById('modal-share-btn').onclick = () => this.showModalSharePanel(save);
    document.getElementById('modal-more-btn').onclick = (e) => {
      e.stopPropagation();
      this.showModalContextMenu(save);
    };

    // Notes textarea with auto-save
    const notesTextarea = document.getElementById('modal-notes-textarea');
    let notesTimeout;
    notesTextarea.oninput = () => {
      clearTimeout(notesTimeout);
      notesTimeout = setTimeout(() => this.saveModalNotes(save), 1000);
    };

    // Add tag button
    this.bindModalTagInput(save);

    // Image-specific actions
    if (this.getSaveType(save) === 'image') {
      const similarBtn = document.getElementById('modal-image-similar');
      const autotagBtn = document.getElementById('modal-image-autotag');

      if (similarBtn) {
        similarBtn.onclick = () => this.findSimilarImages(save);
      }

      if (autotagBtn) {
        autotagBtn.onclick = async () => {
          try {
            autotagBtn.textContent = 'TAGGING...';
            autotagBtn.disabled = true;

            const { data, error } = await this.supabase.functions.invoke('auto-tag-image', {
              body: {
                save_id: save.id,
                user_id: this.user.id,
                image_url: save.image_url
              }
            });

            if (error) {
              console.error('Auto-tag error:', error);
              this.showToast(`Auto-tag failed: ${error.message || 'Unknown error'}`, 'error');
              autotagBtn.textContent = 'Auto-tag';
              autotagBtn.disabled = false;
              return;
            }

            // Reload tags to show newly added ones
            await this.loadModalTags(save);

            const tagCount = data?.tags?.length || 0;
            if (tagCount > 0) {
              this.showToast(`Added ${tagCount} tag${tagCount > 1 ? 's' : ''}!`, 'success');
            } else {
              this.showToast('No tags generated', 'info');
            }

            autotagBtn.textContent = 'Auto-tag';
            autotagBtn.disabled = false;
          } catch (err) {
            console.error('Auto-tag exception:', err);
            this.showToast('Auto-tag failed', 'error');
            autotagBtn.textContent = 'Auto-tag';
            autotagBtn.disabled = false;
          }
        };
      }
    }

    // Note-specific actions
    if (this.getSaveType(save) === 'note') {
      const noteContent = document.getElementById('modal-note-content');
      const notePreview = document.getElementById('modal-note-preview');
      const previewToggle = document.getElementById('modal-note-preview-toggle');
      const colorBtn = document.getElementById('modal-note-color-btn');

      // Store note state for color updates
      this.editingNote = save;
      this.editNoteColor = save.note_color || null;
      this.editNoteGradient = save.note_gradient || null;

      if (noteContent) {
        noteContent.oninput = () => {
          clearTimeout(notesTimeout);
          notesTimeout = setTimeout(() => this.saveModalNoteContent(save), 1000);
        };
      }

      // Formatting buttons
      document.querySelectorAll('.note-format-btn[data-format]').forEach(btn => {
        btn.onclick = () => {
          const format = btn.dataset.format;
          if (noteContent && format) {
            this.insertNoteFormatting(noteContent, format);
          }
        };
      });

      // Preview toggle
      if (previewToggle) {
        previewToggle.onclick = () => {
          const isShowingPreview = !notePreview.classList.contains('hidden');
          if (isShowingPreview) {
            notePreview.classList.add('hidden');
            noteContent.classList.remove('hidden');
            noteContent.focus();
          } else {
            notePreview.innerHTML = this.renderMarkdown(noteContent.value || '');
            notePreview.classList.remove('hidden');
            noteContent.classList.add('hidden');
          }
        };
      }

      // Color button
      if (colorBtn) {
        colorBtn.onclick = () => this.showEditNoteColorPicker();
      }
    }

    // Book-specific actions
    if (this.getSaveType(save) === 'book') {
      const readStatusSelect = document.getElementById('modal-read-status-select');
      if (readStatusSelect) {
        readStatusSelect.onchange = async (e) => {
          await this.updateBookReadStatus(save, e.target.value);
        };
      }
    }
  };

  proto.closeUnifiedModal = function() {
    const modal = document.getElementById('unified-modal');
    modal.classList.add('hidden');

    // Reset modal container background
    const modalContainer = document.querySelector('.modal-container');
    modalContainer.style.background = '';

    // Stop audio
    this.stopAudio();

    this.hideModalContextMenu();
    this.hideModalSharePanel();
    this.closeModalTagInput();

    if (this.modalSwipeCleanup) {
      this.modalSwipeCleanup();
      this.modalSwipeCleanup = null;
    }

    if (this.modalOutsideClickHandler) {
      document.removeEventListener('click', this.modalOutsideClickHandler);
      this.modalOutsideClickHandler = null;
    }

    this.currentSave = null;
  };

  proto.bindModalSwipeToClose = function(container, closeModal) {
    if (!container) return;
    if (this.modalSwipeCleanup) {
      this.modalSwipeCleanup();
      this.modalSwipeCleanup = null;
    }

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse') return;
      isDragging = true;
      startY = e.clientY;
      currentY = 0;
      container.style.transition = 'none';
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      currentY = e.clientY - startY;
      if (currentY > 0) {
        container.style.transform = `translateY(${currentY}px)`;
      }
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.transition = 'transform 0.2s ease';
      if (currentY > 120) {
        container.style.transform = '';
        closeModal();
      } else {
        container.style.transform = '';
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    this.modalSwipeCleanup = () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.style.transition = '';
      container.style.transform = '';
    };
  };

  proto.toggleModalPin = async function(save) {
    const newPinState = !save.is_pinned;

    const { error } = await this.supabase
      .from('saves')
      .update({
        is_pinned: newPinState,
        pinned_at: newPinState ? new Date().toISOString() : null
      })
      .eq('id', save.id);

    if (!error) {
      save.is_pinned = newPinState;
      this.updateModalContextMenuState(save);
      this.loadPinnedSaves();
      this.loadSaves();
    }
  };

  proto.toggleModalFavorite = async function(save) {
    const newFavState = !save.is_favorite;

    const { error } = await this.supabase
      .from('saves')
      .update({ is_favorite: newFavState })
      .eq('id', save.id);

    if (!error) {
      save.is_favorite = newFavState;
      this.updateModalContextMenuState(save);
      this.loadSaves();
    }
  };

  proto.bindModalTagInput = function(save) {
    const actionBtn = document.getElementById('modal-tag-action-btn');
    const inputWrapper = document.getElementById('modal-tag-input-wrapper');
    const input = document.getElementById('modal-tag-input');
    if (!actionBtn || !inputWrapper || !input) return;

    this.modalTagSave = save;

    actionBtn.onclick = (e) => {
      e.stopPropagation();
      if (inputWrapper.classList.contains('hidden')) {
        this.openModalTagInput();
        return;
      }

      if (input.value.trim()) {
        this.saveModalTag();
      } else {
        input.focus();
      }
    };

    input.oninput = () => {
      this.updateModalTagActionLabel();
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (input.value.trim()) {
          this.saveModalTag();
        }
      }
    };
  };

  proto.openModalTagInput = function() {
    const inputWrapper = document.getElementById('modal-tag-input-wrapper');
    const input = document.getElementById('modal-tag-input');
    if (!inputWrapper || !input) return;

    inputWrapper.classList.remove('hidden');
    input.value = '';
    input.focus();
    this.updateModalTagActionLabel();

    if (!this.modalTagOutsideHandler) {
      this.modalTagOutsideHandler = (e) => {
        const container = document.getElementById('modal-tags-section');
        if (!container || container.contains(e.target)) return;
        this.closeModalTagInput();
      };
      document.addEventListener('click', this.modalTagOutsideHandler);
    }
  };

  proto.closeModalTagInput = function() {
    const inputWrapper = document.getElementById('modal-tag-input-wrapper');
    const input = document.getElementById('modal-tag-input');
    if (inputWrapper) inputWrapper.classList.add('hidden');
    if (input) input.value = '';
    this.updateModalTagActionLabel();

    if (this.modalTagOutsideHandler) {
      document.removeEventListener('click', this.modalTagOutsideHandler);
      this.modalTagOutsideHandler = null;
    }
  };

  proto.updateModalTagActionLabel = function() {
    const actionBtn = document.getElementById('modal-tag-action-btn');
    const inputWrapper = document.getElementById('modal-tag-input-wrapper');
    const input = document.getElementById('modal-tag-input');
    if (!actionBtn || !inputWrapper || !input) return;

    if (inputWrapper.classList.contains('hidden')) {
      actionBtn.textContent = '+ Add tag';
      return;
    }

    actionBtn.textContent = input.value.trim() ? '+ Save tag' : '+ Add tag';
  };

  proto.saveModalTag = async function() {
    const input = document.getElementById('modal-tag-input');
    const save = this.modalTagSave;
    if (!input || !save) return;

    const tagName = input.value.trim();
    if (!tagName) return;

    await this.addTagByName(save, tagName);
    await this.loadModalTags(save);
    this.closeModalTagInput();
  };

  proto.toggleModalArchive = async function(save) {
    const newArchiveState = !save.is_archived;

    const { error } = await this.supabase
      .from('saves')
      .update({ is_archived: newArchiveState })
      .eq('id', save.id);

    if (!error) {
      save.is_archived = newArchiveState;
      document.getElementById('modal-archive-btn').classList.toggle('active', newArchiveState);
      this.closeUnifiedModal();
      this.loadSaves();
    }
  };

  proto.deleteModalSave = async function(save) {
    const { error } = await this.supabase
      .from('saves')
      .delete()
      .eq('id', save.id);

    if (!error) {
      this.closeUnifiedModal();
      this.loadSaves();
      this.loadPinnedSaves();
    }
  };

  proto.updateBookReadStatus = async function(save, status) {
    const { error } = await this.supabase
      .from('saves')
      .update({
        read_status: status
      })
      .eq('id', save.id);

    if (!error) {
      save.read_status = status;
    }
  };

  proto.updateModalFolder = async function(save, folderId) {
    const { error } = await this.supabase
      .from('saves')
      .update({ folder_id: folderId || null })
      .eq('id', save.id);

    if (!error) {
      save.folder_id = folderId || null;
      this.loadSaves();
    }
  };

  proto.saveModalNotes = async function(save) {
    const notes = document.getElementById('modal-notes-textarea').value;
    const status = document.getElementById('modal-notes-status');

    status.textContent = 'Saving...';

    const { error } = await this.supabase
      .from('saves')
      .update({ notes })
      .eq('id', save.id);

    if (!error) {
      save.notes = notes;
      status.textContent = 'Saved';
      setTimeout(() => status.textContent = '', 2000);
    } else {
      status.textContent = 'Error saving';
    }
  };

  proto.saveModalNoteContent = async function(save) {
    const content = document.getElementById('modal-note-content').value;

    const { error } = await this.supabase
      .from('saves')
      .update({
        content,
        notes: content,
        excerpt: content.slice(0, 180),
        note_color: this.editNoteColor,
        note_gradient: this.editNoteGradient,
      })
      .eq('id', save.id);

    if (!error) {
      save.content = content;
      save.notes = content;
      save.excerpt = content.slice(0, 180);
      save.note_color = this.editNoteColor;
      save.note_gradient = this.editNoteGradient;
      this.loadSaves();
    }
  };

  proto.insertNoteFormatting = function(textarea, format) {
    // Map format names to markdown actions
    const formatMap = {
      'bold': 'bold',
      'italic': 'italic',
      'heading': 'heading',
      'bullet': 'list',
      'todo': 'task',
      'blockquote': 'blockquote',
      'code': 'code',
      'divider': 'divider'
    };

    const action = formatMap[format];
    if (action) {
      this.insertMarkdownFormatting(textarea, action);
      // Trigger auto-save after formatting
      textarea.dispatchEvent(new Event('input'));
    }
  };

  proto.updateNoteColor = async function(save, color) {
    const { error } = await this.supabase
      .from('saves')
      .update({ note_color: color })
      .eq('id', save.id);

    if (!error) {
      save.note_color = color;
      this.loadSaves();
    }
  };

  // Reading Progress Bar
  proto.updateReadingProgress = function() {
    const readingContent = document.getElementById('reading-content');
    const progressFill = document.getElementById('reading-progress-fill');

    if (!readingContent || !progressFill) return;

    const scrollTop = readingContent.scrollTop;
    const scrollHeight = readingContent.scrollHeight - readingContent.clientHeight;

    if (scrollHeight > 0) {
      const progress = (scrollTop / scrollHeight) * 100;
      progressFill.style.width = `${Math.min(progress, 100)}%`;
    }
  };
}
