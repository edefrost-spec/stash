// Voice memo upload and dictation support
export function applyVoiceMixin(proto) {

  // Upload a voice memo audio file
  proto.saveVoiceMemo = async function(file) {
    if (!file) return;

    // Accept common audio formats
    const isAudio = file.type.startsWith('audio/') ||
      /\.(m4a|mp3|wav|webm|ogg|mp4|aac|flac)$/i.test(file.name);
    if (!isAudio) {
      this.showToast('Unsupported audio format', 'error');
      return;
    }

    this.showToast('Saving voice memo...');

    try {
      const filename = file.name || 'voice-memo.m4a';
      const path = `${this.user.id}/${Date.now()}-${filename}`;

      // Upload to 'audio' bucket (same bucket used by TTS)
      const { error: uploadError } = await this.supabase.storage
        .from('audio')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Insert save record
      const payload = {
        user_id: this.user.id,
        title: 'Voice Memo',
        site_name: 'Voice Memo',
        source: 'upload',
        audio_url: path,
        content: null,
      };

      const { data: insertedSave, error } = await this.supabase
        .from('saves')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      this.showToast('Voice memo saved! Transcribing...', 'success');
      this.loadSaves();

      // Trigger transcription edge function (fire-and-forget)
      if (insertedSave?.id) {
        this.triggerTranscription(insertedSave.id, path);
      }
    } catch (err) {
      console.error('Error saving voice memo:', err);
      this.showToast('Failed to save voice memo', 'error');
    }
  };

  // Call transcribe-audio edge function
  proto.triggerTranscription = async function(saveId, audioPath) {
    try {
      const response = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/transcribe-audio`,
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
            audio_path: audioPath,
          }),
        }
      );
      if (!response.ok) {
        console.warn('Transcription failed:', await response.text());
      } else {
        // Reload saves to show transcription result
        setTimeout(() => this.loadSaves(), 3000);
      }
    } catch (err) {
      console.warn('Transcription error:', err);
    }
  };

  // --- Voice Dictation (Web Speech API) ---

  proto.bindDictationButtons = function() {
    // Hide mic buttons if browser doesn't support Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      document.querySelectorAll('.voice-dictation-btn').forEach(btn => {
        btn.style.display = 'none';
      });
      return;
    }

    const stickyMicBtn = document.getElementById('quick-note-mic-btn');
    const modalMicBtn = document.getElementById('quick-note-modal-mic-btn');

    stickyMicBtn?.addEventListener('click', () => {
      const textarea = document.getElementById('quick-note-textarea');
      this.toggleDictation(textarea, stickyMicBtn);
    });

    modalMicBtn?.addEventListener('click', () => {
      const textarea = document.getElementById('quick-note-modal-textarea');
      this.toggleDictation(textarea, modalMicBtn);
    });
  };

  proto.toggleDictation = function(textarea, button) {
    if (!textarea) return;

    // If already recording, stop
    if (this._isRecording) {
      this.stopDictation();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showToast('Speech recognition not supported in this browser', 'error');
      return;
    }

    this._recognition = new SpeechRecognition();
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    this._recognition.lang = 'en-US';

    this._isRecording = true;
    this._dictationTarget = textarea;
    this._dictationButton = button;
    button.classList.add('recording');

    this._recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      // Append final text to textarea
      if (finalTranscript) {
        const prefix = textarea.value.length > 0 && !textarea.value.endsWith(' ') ? ' ' : '';
        textarea.value += prefix + finalTranscript;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        // Auto-resize textarea
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }
    };

    this._recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this.stopDictation();
      if (event.error === 'not-allowed') {
        this.showToast('Microphone access denied', 'error');
      }
    };

    this._recognition.onend = () => {
      // Auto-restart if still recording (continuous mode can end unexpectedly)
      if (this._isRecording) {
        try { this._recognition.start(); } catch (e) { this.stopDictation(); }
      }
    };

    try {
      this._recognition.start();
      this.showToast('Listening... Click mic to stop', 'success');
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      this.stopDictation();
    }
  };

  proto.stopDictation = function() {
    if (this._recognition) {
      this._isRecording = false;
      try { this._recognition.stop(); } catch (e) { /* ignore */ }
      this._recognition = null;
    }
    if (this._dictationButton) {
      this._dictationButton.classList.remove('recording');
      this._dictationButton = null;
    }
    this._dictationTarget = null;
  };
}
