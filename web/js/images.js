export function applyImagesMixin(proto) {
  proto.handleImageFile = function(file) {
    if (!file || !file.type.startsWith('image/')) {
      this.setQuickAddStatus('Please select an image file.', 'error');
      return;
    }

    this.pendingImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImg = document.getElementById('image-preview-img');
      const previewContainer = document.getElementById('image-preview');
      const dropzoneContent = document.getElementById('image-dropzone-content');
      const dropzone = document.getElementById('image-dropzone');

      if (previewImg && previewContainer && dropzoneContent && dropzone) {
        previewImg.src = e.target.result;
        previewContainer.classList.remove('hidden');
        dropzoneContent.classList.add('hidden');
        dropzone.classList.add('has-preview');
      }
    };
    reader.readAsDataURL(file);
  };

  proto.clearImagePreview = function() {
    this.pendingImageFile = null;
    const previewImg = document.getElementById('image-preview-img');
    const previewContainer = document.getElementById('image-preview');
    const dropzoneContent = document.getElementById('image-dropzone-content');
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('quick-add-file');

    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.classList.add('hidden');
    if (dropzoneContent) dropzoneContent.classList.remove('hidden');
    if (dropzone) dropzone.classList.remove('has-preview');
    if (fileInput) fileInput.value = '';
  };

  // Save image directly (from global drop or paste)
  proto.saveImageDirectly = async function(file) {
    if (!file || !file.type.startsWith('image/')) return;

    // Show a quick toast/notification
    this.showToast('Saving image...');

    try {
      const path = `${this.user.id}/${Date.now()}-${file.name || 'pasted-image.png'}`;
      const { error: uploadError } = await this.supabase
        .storage
        .from('uploads')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = this.supabase.storage.from('uploads').getPublicUrl(path);
      const imageUrl = data?.publicUrl || null;

      const payload = {
        user_id: this.user.id,
        title: file.name || 'Image',
        url: imageUrl,
        image_url: imageUrl,
        site_name: 'Image',
        source: 'upload',
        content: null,
      };

      const { data: insertedSave, error } = await this.supabase
        .from('saves')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      this.showToast('Image saved!', 'success');
      this.loadSaves();

      // Trigger auto-tagging in background
      if (insertedSave?.id) {
        this.triggerAutoTag(insertedSave.id);
        // Generate image embedding for similarity search
        this.generateImageEmbedding({
          id: insertedSave.id,
          image_url: imageUrl,
        }).catch(err => console.warn('Embedding generation failed:', err));
      }
    } catch (err) {
      console.error('Error saving image:', err);
      this.showToast('Failed to save image', 'error');
    }
  };

  // Trigger auto-tagging via edge function (fire-and-forget)
  proto.triggerAutoTag = async function(saveId) {
    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/auto-tag`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            save_id: saveId,
            user_id: this.user.id,
          }),
        }
      );
      if (!response.ok) {
        console.warn('Auto-tag failed:', await response.text());
      }
    } catch (err) {
      console.warn('Auto-tag error:', err);
    }
  };

  // Find similar images by aesthetic vibe
  proto.findSimilarImages = async function(save) {
    this.showToast('Finding similar images...');

    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/find-similar-images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            save_id: save.id,
            user_id: this.user.id,
            limit: 12,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // If embedding doesn't exist, generate it first
        if (data.needsEmbedding) {
          this.showToast('Analyzing image aesthetics...');
          await this.generateImageEmbedding(save);
          // Retry the search
          return this.findSimilarImages(save);
        }
        throw new Error(data.error || 'Failed to find similar images');
      }

      if (!data.similar || data.similar.length === 0) {
        this.showToast('No similar images found');
        return;
      }

      this.showSimilarImagesModal(save, data.similar, data.source_description);

    } catch (err) {
      console.error('Find similar error:', err);
      this.showToast('Failed to find similar images', 'error');
    }
  };

  // Generate aesthetic embedding for an image
  proto.generateImageEmbedding = async function(save) {
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/functions/v1/generate-image-embedding`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          save_id: save.id,
          user_id: this.user.id,
          image_url: save.image_url,
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to generate embedding');
    }

    return response.json();
  };

  // Show modal with similar images
  proto.showSimilarImagesModal = function(sourceSave, similarImages, description) {
    // Remove existing modal
    document.querySelector('.similar-images-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'modal similar-images-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content similar-images-content">
        <div class="modal-header">
          <h2>Similar Vibes</h2>
          <button class="btn icon modal-close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          ${description ? `<p class="similar-vibe-description">${this.escapeHtml(description)}</p>` : ''}
          <div class="similar-images-grid">
            ${similarImages.map(img => `
              <div class="similar-image-card" data-id="${img.id}">
                <img src="${img.image_url}" alt="${this.escapeHtml(img.title || 'Image')}" loading="lazy">
                <div class="similar-image-info">
                  <span class="similar-score">${Math.round(img.similarity * 100)}%</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => modal.classList.add('visible'));

    // Event handlers
    const closeModal = () => {
      modal.classList.remove('visible');
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    modal.querySelector('.modal-close-btn').addEventListener('click', closeModal);

    // Click on similar image to view it
    modal.querySelectorAll('.similar-image-card').forEach(card => {
      card.addEventListener('click', async () => {
        const imageId = card.dataset.id;
        const { data: save } = await this.supabase
          .from('saves')
          .select('*')
          .eq('id', imageId)
          .single();

        if (save) {
          closeModal();
          document.querySelector('.image-lightbox')?.remove();
          this.openImageLightbox(save);
        }
      });
    });

    // Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  };

  // Simple toast notification
  proto.showToast = function(message, type = '') {
    // Remove existing toast
    document.querySelector('.toast')?.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  };
}
