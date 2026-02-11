# Stash Web App

PWA frontend for Stash. Vanilla JS — no framework, no build step.

## Structure

```
web/
├── index.html          # Single-page shell
├── styles.css          # CSS entry point (@import partials)
├── config.js           # Env-aware config loader (dev vs prod)
├── config.dev.js       # Local Supabase credentials
├── config.prod.js      # Production Supabase credentials
├── sw.js               # Service worker (network-first cache)
├── manifest.json       # PWA manifest
├── js/                 # ES modules
│   ├── app.js          #   Entry point — imports all, boots StashApp
│   ├── core.js         #   StashApp class, constructor, theme
│   ├── events.js       #   Event binding
│   ├── data.js         #   Auth, data loading, Supabase queries
│   ├── cards.js        #   Card rendering, masonry layout
│   ├── card-templates.js   Card type renderers (article, image, note…)
│   ├── views.js        #   View switching, search, reading pane
│   ├── modal.js        #   Unified modal system
│   ├── audio.js        #   TTS audio player
│   ├── images.js       #   Image upload, auto-tag, similar images
│   ├── tags-and-saves.js   Tag/folder management
│   ├── kindle.js       #   Kindle highlights, digest, quick-add
│   ├── quick-note.js   #   Quick note feature
│   ├── note-editor.js  #   Edit note modal
│   ├── format-bar.js   #   Floating format bar
│   ├── spaces.js       #   Spaces / navigation tabs
│   ├── focus-bar.js    #   Focus bar (pinned items, drag-drop)
│   └── context-menu.js #   Context menus, delete confirmations
└── css/                # CSS partials
    ├── variables.css   #   Custom properties, dark mode vars
    ├── base.css        #   Reset, auth screen
    ├── layout.css      #   Sidebar, nav, search, main content
    ├── grid.css        #   Saves grid, masonry, mood board
    ├── states.css      #   Loading, empty states
    ├── reading-pane.css    Reading pane, audio player
    ├── responsive.css  #   Mobile breakpoints
    ├── modal.css       #   Base modal styles
    ├── quick-add.css   #   Quick Add modal, image dropzone
    ├── digest.css      #   Digest settings, import preview
    ├── kindle.css      #   Kindle view, book detail
    ├── card-types.css  #   Image/note/link card styles, lightbox
    ├── quick-note.css  #   Quick note, format bar, colored cards
    ├── focus-bar.css   #   Focus bar, product cards
    ├── unified-modal.css   Unified modal, sidebar, book modal
    ├── card-styles.css #   Book/quote/music/video/article cards
    └── context-menu.css    Context menu, delete dialog, edit space
```

## Local Development

```bash
# Serve from the web/ directory
python3 -m http.server 3000

# Or use any static server
npx serve .
```

Make sure `config.dev.js` has your local Supabase credentials.

## Architecture

All JS uses a **mixin pattern** — each module exports a function that attaches
methods to `StashApp.prototype`. The entry point (`js/app.js`) imports all
mixins, applies them, then creates the singleton `window.stashApp` instance.

CSS uses native `@import` — no preprocessor needed. `styles.css` is just a
list of imports that pull in the partials from `css/`.
