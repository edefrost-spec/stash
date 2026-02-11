# Stash Chrome Extension

Save pages and highlights to your Stash with one click.

## Files

```
extension/
├── manifest.json    # Extension manifest (MV3)
├── config.js        # Supabase credentials
├── supabase.js      # Supabase client helper
├── background.js    # Service worker (context menus, commands)
├── content.js       # Content script (text selection, page extraction)
├── Readability.js   # Mozilla Readability for article parsing
├── popup.html       # Extension popup UI
├── popup.css        # Popup styles
├── popup.js         # Popup logic (save page, highlights)
└── icons/           # Extension icons
```

## Load Unpacked (Development)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this `extension/` folder
4. Add your Supabase credentials to `config.js`

## Safari

The `safari/` directory at the repo root contains an Xcode project wrapper
that packages this same extension for Safari. It may have diverged slightly
from the Chrome version to work within Xcode's build system.
