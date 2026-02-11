export function applyDataMixin(proto) {
  proto.showAuthScreen = function() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
  };

  proto.showMainScreen = function() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
  };

  proto.signIn = async function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    const btn = document.getElementById('signin-btn');

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.textContent = '';

    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      errorEl.textContent = error.message;
    }

    btn.disabled = false;
    btn.textContent = 'Sign In';
  };

  proto.signUp = async function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');
    const messageEl = document.getElementById('auth-message');
    const btn = document.getElementById('signup-btn');

    if (!email || !password) {
      errorEl.textContent = 'Please enter email and password';
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account...';
    errorEl.textContent = '';
    messageEl.textContent = '';

    const { error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      errorEl.textContent = error.message;
    } else {
      messageEl.textContent = 'Check your email to confirm your account!';
    }

    btn.disabled = false;
    btn.textContent = 'Create Account';
  };

  proto.signOut = async function() {
    await this.supabase.auth.signOut();
  };

  proto.loadData = async function() {
    await Promise.all([
      this.loadSaves(),
      this.loadTags(),
      this.loadFolders(),
    ]);
  };

  proto.loadSaves = async function() {
    const container = document.getElementById('saves-container');
    const loading = document.getElementById('loading');
    const empty = document.getElementById('empty-state');

    // Preserve Quick Note input before clearing container
    const quickNoteInput = document.getElementById('quick-note-input');
    const tempHolder = document.createDocumentFragment();
    if (quickNoteInput) {
      tempHolder.appendChild(quickNoteInput);
    }

    loading.classList.remove('hidden');
    container.innerHTML = '';

    // Re-insert Quick Note input immediately
    if (quickNoteInput) {
      container.appendChild(quickNoteInput);
    }

    const sortValue = document.getElementById('sort-select').value;
    const [column, direction] = sortValue.split('.');

    let query = this.supabase
      .from('saves')
      .select('*')
      .order(column, { ascending: direction === 'asc' });

    // Apply view filters
    if (this.currentView === 'highlights') {
      query = query.not('highlight', 'is', null);
    } else if (this.currentView === 'articles') {
      query = query.is('highlight', null).neq('source', 'upload');
    } else if (this.currentView === 'images') {
      query = query.eq('source', 'upload');
    } else if (this.currentView === 'products') {
      query = query.eq('is_product', true).eq('is_archived', false);
    } else if (this.currentView === 'books') {
      query = query.eq('is_book', true).eq('is_archived', false);
    } else if (this.currentView === 'notes') {
      query = query.eq('is_archived', false).or('site_name.eq.Note,and(url.is.null,or(notes.not.is.null,content.not.is.null))');
    } else if (this.currentView === 'music') {
      query = query.eq('is_archived', false).or('url.ilike.%spotify.com%,url.ilike.%music.apple.com%,url.ilike.%soundcloud.com%,url.ilike.%bandcamp.com%');
    } else if (this.currentView === 'video') {
      query = query.eq('is_archived', false).or('url.ilike.%youtube.com%,url.ilike.%youtu.be%,url.ilike.%vimeo.com%,url.ilike.%tiktok.com%');
    } else if (this.currentView === 'links') {
      query = query
        .eq('is_archived', false)
        .not('url', 'is', null)
        .is('content', null)
        .is('excerpt', null)
        .eq('is_product', false)
        .eq('is_book', false);
    } else if (this.currentView === 'archived') {
      query = query.eq('is_archived', true);
    } else if (this.currentView === 'weekly') {
      // Weekly review - get this week's saves
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (this.currentView !== 'folder' && this.currentView !== 'tag') {
      query = query.eq('is_archived', false);
    }

    // Apply folder filter
    if (this.currentFolderId) {
      query = query.eq('folder_id', this.currentFolderId);
    }

    // Apply tag filter - need to get save IDs first
    if (this.currentTagId) {
      const { data: taggedSaves } = await this.supabase
        .from('save_tags')
        .select('save_id')
        .eq('tag_id', this.currentTagId);

      const saveIds = taggedSaves?.map(ts => ts.save_id) || [];
      if (saveIds.length === 0) {
        // No saves with this tag
        loading.classList.add('hidden');
        this.saves = [];
        empty.classList.remove('hidden');
        return;
      }
      query = query.in('id', saveIds);
    }

    const { data, error } = await query;

    loading.classList.add('hidden');

    if (error) {
      console.error('Error loading saves:', error);
      return;
    }

    this.saves = data || [];

    await this.loadSaveTagMapForSaves(this.saves);

    if (this.saves.length === 0) {
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      // Use special rendering for weekly view
      if (this.currentView === 'weekly') {
        this.renderWeeklyReview();
      } else {
        this.renderSaves();
      }
    }
  };
}
