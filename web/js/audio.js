export function applyAudioMixin(proto) {
  proto.initAudio = async function(url) {
    this.stopAudio();

    // Extract filename from URL and get a signed URL
    const filename = url.split('/').pop();
    const signedUrl = await this.getSignedAudioUrl(filename);

    if (!signedUrl) {
      console.error('Failed to get signed URL for audio');
      return;
    }

    this.audio = new Audio(signedUrl);
    this.isPlaying = false;

    // Reset UI
    document.getElementById('audio-progress').style.width = '0%';
    document.getElementById('audio-current').textContent = '0:00';
    document.getElementById('audio-duration').textContent = '0:00';
    document.getElementById('audio-speed').value = '1';
    this.updatePlayButton();

    // Set up event listeners
    this.audio.addEventListener('loadedmetadata', () => {
      document.getElementById('audio-duration').textContent = this.formatTime(this.audio.duration);
    });

    this.audio.addEventListener('timeupdate', () => {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      document.getElementById('audio-progress').style.width = `${progress}%`;
      document.getElementById('audio-current').textContent = this.formatTime(this.audio.currentTime);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updatePlayButton();
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });
  };

  proto.toggleAudioPlayback = function() {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      this.audio.play();
      this.isPlaying = true;
    }
    this.updatePlayButton();
    if (this._modalAudioActive) this.updateModalPlayButton();
  };

  proto.stopAudio = function() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
      this.isPlaying = false;
      this.updatePlayButton();
      if (this._modalAudioActive) this.updateModalPlayButton();
      this._modalAudioActive = false;
    }
  };

  proto.updatePlayButton = function() {
    const playIcon = document.querySelector('#audio-play-btn .play-icon');
    const pauseIcon = document.querySelector('#audio-play-btn .pause-icon');

    if (this.isPlaying) {
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
    } else {
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
    }
  };

  proto.formatTime = function(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  proto.getSignedAudioUrl = async function(path) {
    // Get a signed URL for the audio file (valid for 1 hour)
    const { data, error } = await this.supabase.storage
      .from('audio')
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  // Modal audio player (for voice memos in sidebar)
  proto.initModalAudioPlayer = async function(audioPath) {
    // Stop any existing audio first
    this.stopAudio();

    const signedUrl = await this.getSignedAudioUrl(audioPath);
    if (!signedUrl) {
      console.error('Failed to get signed URL for modal audio');
      return;
    }

    this.audio = new Audio(signedUrl);
    this.isPlaying = false;
    this._modalAudioActive = true;

    // Reset modal audio UI
    const progress = document.getElementById('modal-audio-progress');
    const current = document.getElementById('modal-audio-current');
    const duration = document.getElementById('modal-audio-duration');
    const speedSelect = document.getElementById('modal-audio-speed');
    if (progress) progress.style.width = '0%';
    if (current) current.textContent = '0:00';
    if (duration) duration.textContent = '0:00';
    if (speedSelect) speedSelect.value = '1';

    this.updateModalPlayButton();

    this.audio.addEventListener('loadedmetadata', () => {
      if (duration) duration.textContent = this.formatTime(this.audio.duration);
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.audio) return;
      const pct = (this.audio.currentTime / this.audio.duration) * 100;
      if (progress) progress.style.width = `${pct}%`;
      if (current) current.textContent = this.formatTime(this.audio.currentTime);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updateModalPlayButton();
    });

    // Bind play button
    const playBtn = document.getElementById('modal-audio-play-btn');
    if (playBtn) {
      playBtn.onclick = () => this.toggleAudioPlayback();
    }

    // Bind progress bar seek
    const progressBar = document.getElementById('modal-audio-progress-bar');
    if (progressBar) {
      progressBar.onclick = (e) => {
        if (!this.audio) return;
        const rect = progressBar.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        this.audio.currentTime = pct * this.audio.duration;
      };
    }

    // Bind speed selector
    if (speedSelect) {
      speedSelect.onchange = () => {
        if (this.audio) this.audio.playbackRate = parseFloat(speedSelect.value);
      };
    }
  };

  proto.updateModalPlayButton = function() {
    const playBtn = document.getElementById('modal-audio-play-btn');
    if (!playBtn) return;

    const playIcon = playBtn.querySelector('.play-icon');
    const pauseIcon = playBtn.querySelector('.pause-icon');

    if (this.isPlaying) {
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
    } else {
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
    }
  };

  proto.toggleArchive = async function() {
    if (!this.currentSave) return;

    const newValue = !this.currentSave.is_archived;
    await this.supabase
      .from('saves')
      .update({ is_archived: newValue })
      .eq('id', this.currentSave.id);

    this.currentSave.is_archived = newValue;
    this.loadSaves();
    if (newValue) this.closeReadingPane();
  };

  proto.toggleFavorite = async function() {
    if (!this.currentSave) return;

    const newValue = !this.currentSave.is_favorite;
    await this.supabase
      .from('saves')
      .update({ is_favorite: newValue })
      .eq('id', this.currentSave.id);

    this.currentSave.is_favorite = newValue;
    document.getElementById('favorite-btn').classList.toggle('active', newValue);
  };

  proto.deleteSave = async function() {
    if (!this.currentSave) return;

    if (!confirm('Delete this save? This cannot be undone.')) return;

    await this.supabase
      .from('saves')
      .delete()
      .eq('id', this.currentSave.id);

    this.closeReadingPane();
    this.loadSaves();
  };
}
