export function applyCardTemplatesMixin(proto) {
  proto.getSaveType = function(save) {
    if (save.is_book) return 'book';
    if (save.is_product) return 'product';
    if (save.highlight) return 'highlight';
    if (save.source === 'upload' && save.image_url) return 'image';
    if (save.site_name === 'Voice Memo' && save.audio_url) return 'voice';
    if (save.site_name === 'Note' || (!save.url && (save.notes || save.content))) return 'note';

    // Detect music from URL patterns
    if (save.url) {
      const url = save.url.toLowerCase();
      if (url.includes('spotify.com') || url.includes('music.apple.com') ||
          url.includes('soundcloud.com') || url.includes('bandcamp.com')) {
        return 'music';
      }
      // Detect video from URL patterns
      if (url.includes('youtube.com') || url.includes('youtu.be') ||
          url.includes('vimeo.com') || url.includes('tiktok.com')) {
        return 'video';
      }
    }

    if (save.url && !save.content && !save.excerpt) return 'link';
    return 'article';
  };

  proto.viewForSaveType = function(saveType) {
    const map = {
      article: 'articles',
      link: 'links',
      highlight: 'highlights',
      image: 'images',
      product: 'products',
      book: 'books',
      note: 'notes',
      music: 'music',
      video: 'video',
      voice: 'voice-memos',
    };
    return map[saveType] || 'all';
  };

  proto.filterBySaveType = function(saveType) {
    const view = this.viewForSaveType(saveType);
    this.setView(view);
  };

  proto.renderModalSaveTypePill = function(saveType) {
    const assets = {
      article: {
        label: 'Article',
        icon: 'https://www.figma.com/api/mcp/asset/be26309e-b0a4-4698-a545-3343032f5d37',
        size: 12,
      },
      book: {
        label: 'Book',
        icon: 'https://www.figma.com/api/mcp/asset/8a450998-358c-4752-9c7b-b408cad6464d',
        size: 16,
      },
      video: {
        label: 'Video',
        icon: 'https://www.figma.com/api/mcp/asset/6106c1c5-02cf-471d-b41b-0a62117b1699',
        size: 16,
      },
      image: {
        label: 'Image',
        icon: 'https://www.figma.com/api/mcp/asset/57066f98-cd61-4e37-ae93-386aeeca16ac',
        size: 16,
      },
      product: {
        label: 'Product',
        icon: 'https://www.figma.com/api/mcp/asset/33b49b13-c191-4856-8cb8-e3e86366bf98',
        size: 16,
      },
      music: {
        label: 'Music',
        icon: 'https://www.figma.com/api/mcp/asset/b5022f9f-b3a8-45e0-930b-df595c515086',
        size: 16,
      },
      highlight: {
        label: 'Quote',
        icon: 'https://www.figma.com/api/mcp/asset/14bee86b-fdc7-4d1b-9f50-df3dc1dc67be',
        size: 12,
      },
      note: {
        label: 'Note',
        icon: 'https://www.figma.com/api/mcp/asset/ad2a0beb-3130-4741-bd8e-7fc48f1cacc2',
        size: 9,
      },
      link: {
        label: 'Link',
        icon: 'https://www.figma.com/api/mcp/asset/be26309e-b0a4-4698-a545-3343032f5d37',
        size: 12,
      },
      voice: {
        label: 'Voice Memo',
        icon: null,
        size: 14,
      },
    };

    const data = assets[saveType] || assets.article;
    const iconHtml = data.icon
      ? `<img src="${data.icon}" alt="" style="width: ${data.size}px; height: ${data.size}px;">`
      : `<svg width="${data.size}" height="${data.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
    return `
      <span class="modal-save-type-pill" data-save-type="${saveType}">
        ${iconHtml}
        <span>${data.label}</span>
      </span>
    `;
  };

  proto.renderModalSpacePill = function(folderId) {
    if (!folderId) return '';
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return '';
    const color = folder.color || '#8aa7ff';
    return `
      <span class="modal-space-tag-pill">
        <span class="modal-space-dot" style="border-color: ${color};"></span>
        <span>${this.escapeHtml(folder.name)}</span>
      </span>
    `;
  };

  proto.hexToRgba = function(hex, alpha) {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  proto.renderSaveCard = function(save, options = {}) {
    const { moodBoard = false } = options;
    const saveType = this.getSaveType(save);
    const date = new Date(save.created_at).toLocaleDateString();
    const annotations = this.renderCardAnnotations(save, { compact: moodBoard || saveType === 'image' });
    const colorEntry = this.saveColorMap[save.id];
    const dominantStyle = colorEntry?.color ? `style="--dominant: ${colorEntry.color}"` : '';

    // Mood board mode - visual-focused layout
    if (moodBoard) {
      const meta = `${this.escapeHtml(save.site_name || '')}${save.site_name ? ' · ' : ''}${date}`;
      if (saveType === 'highlight') {
        return `
          <div class="save-card mood-card highlight" data-id="${save.id}" ${dominantStyle}>
            <div class="mood-media">
              <div class="mood-placeholder"></div>
              <div class="mood-overlay">
                <div class="mood-title">${this.escapeHtml(save.title || 'Untitled')}</div>
                <div class="save-card-highlight">"${this.escapeHtml(save.highlight)}"</div>
                <div class="mood-meta">${meta}</div>
                ${annotations}
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="save-card mood-card${saveType === 'image' ? ' image-save' : ''}" data-id="${save.id}" ${dominantStyle}>
          <div class="mood-media">
            ${save.image_url ? `<img src="${save.image_url}" alt="" onerror="this.style.display='none'">` : '<div class="mood-placeholder"></div>'}
            <div class="mood-overlay">
              <div class="mood-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="mood-meta">${meta}</div>
              ${annotations}
            </div>
          </div>
        </div>
      `;
    }

    // Type-specific card templates
    switch (saveType) {
      case 'book':
        // Book card - cover image with 3D effect
        return `
          <div class="save-card book-save" data-id="${save.id}">
            <div class="book-cover-container">
              <img src="${save.image_url}" alt="${this.escapeHtml(save.title)}" class="book-cover">
            </div>
          </div>
        `;

      case 'product':
        // Product card - like image save with price badge
        const priceDisplay = this.formatPrice(save.product_price, save.product_currency);
        return `
          <div class="save-card product-save" data-id="${save.id}">
            ${save.image_url ? `<img class="save-card-image" src="${save.image_url}" alt="">` : ''}
            ${priceDisplay ? `<span class="product-price-badge">${priceDisplay}</span>` : ''}
            <div class="save-card-content">
              ${annotations}
            </div>
          </div>
        `;

      case 'highlight':
        return `
          <div class="save-card highlight" data-id="${save.id}">
            <div class="save-card-content">
              <div class="save-card-site">${this.escapeHtml(save.site_name || '')}</div>
              <div class="save-card-highlight">"${this.escapeHtml(save.highlight)}"</div>
              <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              ${annotations}
            </div>
          </div>
        `;

      case 'image':
        // Image card - just the image, annotations on hover
        return `
          <div class="save-card image-save" data-id="${save.id}">
            <img class="save-card-image" src="${save.image_url}" alt="">
            <div class="save-card-content">
              ${annotations}
            </div>
          </div>
        `;

      case 'voice':
        // Voice memo card - mic icon + title + transcription preview
        const voiceTitle = save.title || 'Voice Memo';
        const transcriptPreview = save.content
          ? this.truncateText(save.content, 120)
          : 'Transcribing...';
        const isTranscribing = !save.content;
        return `
          <div class="save-card voice-memo-card" data-id="${save.id}">
            <div class="save-card-content">
              <div class="voice-memo-header">
                <svg class="voice-memo-icon${isTranscribing ? ' transcribing' : ''}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span class="voice-memo-label">Voice Memo</span>
              </div>
              <div class="save-card-title">${this.escapeHtml(voiceTitle)}</div>
              <div class="voice-memo-transcript-preview${isTranscribing ? ' pending' : ''}">${this.escapeHtml(transcriptPreview)}</div>
              ${annotations}
            </div>
          </div>
        `;

      case 'note':
        // Note card - text-focused, no image
        const noteContent = save.notes || save.content || '';
        // Apply saved color/gradient as background
        let noteStyle = '';
        if (save.note_gradient) {
          noteStyle = `background: ${save.note_gradient};`;
        } else if (save.note_color) {
          noteStyle = `background: linear-gradient(135deg, ${save.note_color} 0%, ${this.lightenColor(save.note_color, 15)} 100%);`;
        }
        return `
          <div class="save-card note-save" data-id="${save.id}" style="${noteStyle}">
            <div class="save-card-content">
              <div class="save-card-title">${this.escapeHtml(save.title || 'Quick Note')}</div>
              <div class="save-card-note-content">${this.renderMarkdownPreview(noteContent)}</div>
              ${annotations}
            </div>
          </div>
        `;

      case 'link':
        // Link card - minimal with favicon
        const domain = save.url ? new URL(save.url).hostname.replace('www.', '') : '';
        const faviconUrl = save.url ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';
        return `
          <div class="save-card link-save" data-id="${save.id}">
            <div class="save-card-content">
              <div class="link-header">
                ${faviconUrl ? `<img class="link-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">` : ''}
                <span class="link-domain">${this.escapeHtml(domain)}</span>
              </div>
              <div class="save-card-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="save-card-url">${this.escapeHtml(save.url || '')}</div>
              ${annotations}
            </div>
          </div>
        `;

      case 'music':
        // Music card - album art with track info
        const musicDomain = save.url ? new URL(save.url).hostname.replace('www.', '') : '';
        return `
          <div class="save-card music-card" data-id="${save.id}">
            ${save.image_url ? `<img class="album-art" src="${save.image_url}" alt="">` : ''}
            <div class="music-info">
              <div>
                <div class="music-title">${this.escapeHtml(save.title || 'Untitled')}</div>
                <div class="music-artist">${this.escapeHtml(save.site_name || musicDomain)}</div>
              </div>
              <span class="track-count">${this.escapeHtml(musicDomain)}</span>
            </div>
            ${annotations}
          </div>
        `;

      case 'video':
        // Video card - thumbnail with play button
        return `
          <div class="save-card video-card" data-id="${save.id}">
            <div class="video-thumbnail">
              ${save.image_url ? `<img src="${save.image_url}" alt="">` : ''}
              <div class="play-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </div>
            </div>
            <div class="video-info">
              <div class="video-title">${this.escapeHtml(save.title || 'Untitled')}</div>
              <div class="video-channel">${this.escapeHtml(save.site_name || '')}</div>
            </div>
            ${annotations}
          </div>
        `;

      case 'article':
      default:
        // Article card - new design with optional image
        const publisherLabel = this.getArticlePublisherLabel(save);
        const publisherDomain = this.getArticlePublisherDomain(save);
        const brandfetchLogoUrl = publisherDomain
          ? `https://cdn.brandfetch.io/${encodeURIComponent(publisherDomain)}/logo?c=1idTAprk8CUU5DSoOo1`
          : '';
        return `
          <div class="save-card article-card${save.image_url ? ' article-card--image' : ' article-card--noimage'}" data-id="${save.id}">
            <div class="article-card-content${save.image_url ? '' : ' article-card-content--bookmark'}">
              <div class="article-card-publisher-logo">
                ${brandfetchLogoUrl
                  ? `<img src="${brandfetchLogoUrl}" alt="${this.escapeHtml(publisherLabel)}" loading="lazy" onload="if(this.naturalWidth<=50||(this.naturalWidth===820&&this.naturalHeight===220)){this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='block'}" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='block'"><span class="article-card-publisher-text" style="display:none">${this.escapeHtml(publisherLabel)}</span>`
                  : `<span class="article-card-publisher-text">${this.escapeHtml(publisherLabel)}</span>`
                }
              </div>
              ${save.image_url ? `<div class="article-card-headline">${this.escapeHtml(save.title || '')}</div>` : ''}
            </div>
            ${save.image_url ? `
              <div class="article-card-media">
                <img src="${save.image_url}" alt="" onerror="this.style.display='none'">
              </div>
            ` : `
              <div class="article-card-noimage-body">
                <div class="article-card-headline">${this.escapeHtml(save.title || '')}</div>
              </div>
            `}
          </div>
        `;
    }
  };

  proto.renderArticlePublisher = function(save) {
    const publisher = (save.site_name || '').trim();
    if (publisher) {
      return `<div class="article-card-publisher">${this.escapeHtml(publisher)}</div>`;
    }

    if (save.url) {
      const sourceLabel = this.getSourceLabel(save.url);
      if (sourceLabel) {
        return `<div class="article-card-publisher is-url">${this.escapeHtml(sourceLabel)}</div>`;
      }
    }

    return `<div class="article-card-publisher"></div>`;
  };

  proto.getArticlePublisherLabel = function(save) {
    const siteName = (save.site_name || '').trim();
    if (siteName) return siteName;
    if (save.url) {
      const label = this.getSourceLabel(save.url);
      if (label) return label;
    }
    return '';
  };

  proto.getArticlePublisherDomain = function(save) {
    if (!save.url) return '';
    try {
      return new URL(save.url).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  };

  proto.renderCardAnnotations = function(save, options = {}) {
    const { compact = false } = options;
    const tags = this.saveTagMap[save.id] || [];
    const notes = (save.notes || '').trim();
    const noteLimit = compact ? 80 : 160;
    const noteText = notes ? this.escapeHtml(this.truncateText(notes, noteLimit)) : '';

    const tagsMarkup = tags.length
      ? tags.map(tag => {
          const color = tag.color || '#94a3b8';
          return `
            <span class="save-card-tag" style="background: ${color}20; border-color: ${color}">
              ${this.escapeHtml(tag.name)}
            </span>
          `;
        }).join('')
      : `<span class="save-card-tag empty">No tags</span>`;

    const notesMarkup = notes
      ? `<div class="save-card-notes"><strong>Notes</strong>${noteText}</div>`
      : '';

    return `
      <div class="save-card-annotations">
        <div class="save-card-tags-inline">${tagsMarkup}</div>
        ${notesMarkup}
      </div>
    `;
  };

  proto.filterSavesForDisplay = function(saves, useMoodBoard) {
    if (!useMoodBoard || this.colorFilter === 'all') {
      return saves;
    }

    return saves.filter(save => this.getSaveColorBucket(save) === this.colorFilter);
  };

  proto.truncateText = function(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}…`;
  };

  proto.getWeekDateRange = function() {
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const options = { month: 'short', day: 'numeric' };
    return `${weekAgo.toLocaleDateString('en-US', options)} - ${now.toLocaleDateString('en-US', options)}`;
  };

  proto.loadSaveTagMapForSaves = async function(saves) {
    const saveIds = saves.map(save => save.id);
    if (saveIds.length === 0) {
      this.saveTagMap = {};
      return;
    }

    const { data } = await this.supabase
      .from('save_tags')
      .select('save_id, tags(id, name, color)')
      .in('save_id', saveIds);

    const map = {};
    (data || []).forEach(row => {
      if (!row.tags) return;
      if (!map[row.save_id]) map[row.save_id] = [];
      map[row.save_id].push(row.tags);
    });

    this.saveTagMap = map;
  };

  proto.prepareColorData = async function() {
    if (this.colorDataInFlight || !this.isMoodBoard) return;
    this.colorDataInFlight = true;

    const updated = await this.populateColorMapForSaves(this.saves);
    this.colorDataInFlight = false;

    if (updated) {
      this.renderColorFilters();
      if (this.colorFilter !== 'all') {
        this.renderSaves();
      } else {
        this.updateSaveCardsWithColors();
      }
    }
  };

  proto.populateColorMapForSaves = async function(saves) {
    let updated = false;

    for (const save of saves) {
      if (this.saveColorMap[save.id]) continue;
      if (!save.image_url) {
        this.saveColorMap[save.id] = { color: '#9ca3af', bucket: 'neutral' };
        updated = true;
        continue;
      }

      const color = await this.getDominantColor(save.image_url);
      const bucket = this.getColorBucketFromHex(color || '#9ca3af');
      this.saveColorMap[save.id] = { color: color || '#9ca3af', bucket };
      updated = true;
    }

    if (updated) {
      this.saveImageColorCache();
    }

    return updated;
  };

  proto.getDominantColor = async function(imageUrl) {
    if (!imageUrl) return null;
    if (this.imageColorCache[imageUrl]) {
      return this.imageColorCache[imageUrl];
    }

    try {
      const color = await this.computeDominantColorFromImage(imageUrl);
      if (color) {
        this.imageColorCache[imageUrl] = color;
      }
      return color;
    } catch (e) {
      return null;
    }
  };

  proto.computeDominantColorFromImage = function(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(null);
            return;
          }
          const size = 24;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          let r = 0;
          let g = 0;
          let b = 0;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha < 200) continue;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count += 1;
          }

          if (count === 0) {
            resolve(null);
            return;
          }

          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          resolve(this.rgbToHex(r, g, b));
        } catch (e) {
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  };

  proto.rgbToHex = function(r, g, b) {
    const toHex = (value) => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  proto.getColorBucketFromHex = function(hex) {
    if (!hex) return 'neutral';
    const rgb = hex.replace('#', '');
    const r = parseInt(rgb.slice(0, 2), 16);
    const g = parseInt(rgb.slice(2, 4), 16);
    const b = parseInt(rgb.slice(4, 6), 16);
    const hsl = this.rgbToHsl(r, g, b);
    return this.getColorBucketFromHsl(hsl);
  };

  proto.rgbToHsl = function(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r:
          h = ((g - b) / delta) % 6;
          break;
        case g:
          h = (b - r) / delta + 2;
          break;
        default:
          h = (r - g) / delta + 4;
          break;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    return { h, s, l };
  };

  proto.getColorBucketFromHsl = function(hsl) {
    if (!hsl || hsl.s < 0.18 || hsl.l < 0.12 || hsl.l > 0.92) {
      return 'neutral';
    }
    const hue = hsl.h;
    if (hue < 15 || hue >= 345) return 'red';
    if (hue < 40) return 'orange';
    if (hue < 70) return 'yellow';
    if (hue < 155) return 'green';
    if (hue < 200) return 'teal';
    if (hue < 250) return 'blue';
    if (hue < 290) return 'purple';
    if (hue < 345) return 'pink';
    return 'neutral';
  };

  proto.updateSaveCardsWithColors = function() {
    const cards = document.querySelectorAll('.save-card');
    cards.forEach(card => {
      const id = card.dataset.id;
      const entry = this.saveColorMap[id];
      if (!entry) return;
      card.style.setProperty('--dominant', entry.color);
    });
  };
}
