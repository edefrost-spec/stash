// Stash – ES module entry point
// Imports all mixins and wires them onto StashApp.prototype, then boots the app.

import { StashApp, applyCorePrototype } from './core.js';
import { applyEventsMixin } from './events.js';
import { applyImagesMixin } from './images.js';
import { applyDataMixin } from './data.js';
import { applyCardsMixin } from './cards.js';
import { applyCardTemplatesMixin } from './card-templates.js';
import { applyViewsMixin } from './views.js';
import { applyModalMixin } from './modal.js';
import { applyAudioMixin } from './audio.js';
import { applyTagsAndSavesMixin } from './tags-and-saves.js';
import { applyKindleMixin } from './kindle.js';
import { applyQuickNoteMixin } from './quick-note.js';
import { applyNoteEditorMixin } from './note-editor.js';
import { applyFormatBarMixin } from './format-bar.js';
import { applySpacesMixin } from './spaces.js';
import { applyFocusBarMixin } from './focus-bar.js';
import { applyContextMenuMixin } from './context-menu.js';
import { applyVoiceMixin } from './voice.js';
import { applyCanvasMixin } from './canvas.js';

// Apply all mixins to StashApp.prototype
const proto = StashApp.prototype;
applyCorePrototype(proto);
applyEventsMixin(proto);
applyImagesMixin(proto);
applyDataMixin(proto);
applyCardsMixin(proto);
applyCardTemplatesMixin(proto);
applyViewsMixin(proto);
applyModalMixin(proto);
applyAudioMixin(proto);
applyTagsAndSavesMixin(proto);
applyKindleMixin(proto);
applyQuickNoteMixin(proto);
applyNoteEditorMixin(proto);
applyFormatBarMixin(proto);
applySpacesMixin(proto);
applyFocusBarMixin(proto);
applyContextMenuMixin(proto);
applyVoiceMixin(proto);
applyCanvasMixin(proto);

// Boot
proto.init = async function() {
  this.supabase = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );

  this.loadTheme();
  this.loadCardPreferences();
  this.applyFeatureFlags();
  this.hideQuickAddModal();

  this.showMainScreen();
  this.loadData();

  this.bindEvents();
  this.bindQuickNoteEvents();
  this.bindQuickNoteKeyboardShortcut();
  this.bindFormatBar();
  this.bindPinButton();
  this.bindProductModal();
  this.bindEditNoteModal();
  this.bindContextMenu();
  this.bindModalContextMenu();
  this.bindSpaceContextMenu();
  this.bindSpacesPage();
  this.bindNavTabs();
  this.bindCanvasTab();
  this.bindDropZone();
  this.loadPinnedSaves();
  this.bindDictationButtons();
};

// Wait for config to load, then boot
window.configReady.then(() => {
  window.StashApp = StashApp;
  window.stashApp = new StashApp();
  window.stashApp.init();
});
