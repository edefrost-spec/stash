# Stash

A simple, self-hosted read-it-later app. Save articles, highlights, and Kindle notes to your own database.

**Your data. Your server. No subscription.**

## Features

- **Chrome Extension** - Save pages and highlights with one click
- **Safari Web Extension** - Save from Safari on Mac and iPhone/iPad
- **Web App** - Access your saves from any device
- **Kindle Sync** - Import highlights from your Kindle library
- **Full-Text Search** - Find anything you've saved
- **Text-to-Speech** - Listen to articles with neural voices (free)
- **iOS Shortcut** - Save from Safari on iPhone/iPad
- **Bookmarklet** - Works in any browser

## Why Stash?

- **Free forever** - Runs on Supabase free tier (500MB, unlimited API calls)
- **You own your data** - Everything stored in your own database
- **No account needed** - Single-user mode, no sign-up friction
- **Works offline** - PWA support for mobile
- **Open source** - Fork it, modify it, make it yours

## Quick Start

1. **Create a Supabase project** (free) at [supabase.com](https://supabase.com)
2. **Run the schema** from `supabase/schema.sql`
3. **Add your credentials** to `extension/config.js` and `web/config.js`
4. **Load the extension** in Chrome (`chrome://extensions` > Load unpacked)
5. **Deploy the web app** to Vercel/Netlify (free)

See [SETUP.md](SETUP.md) for detailed instructions.

## Project Structure

```
stash/
├── web/              # Web app (PWA)
│   ├── js/           #   ES modules (split from app.js)
│   ├── css/          #   CSS partials (split from styles.css)
│   ├── config.js     #   Environment-aware config loader
│   └── sw.js         #   Service worker
├── extension/        # Chrome extension
├── safari/           # Safari Web Extension (Xcode wrapper)
├── ios/              # Native iOS app (Xcode project in ios/Eden/)
├── supabase/         # Database schema & Edge Functions
├── tts/              # Text-to-speech generator (Python)
├── bookmarklet/      # Universal save bookmarklet
├── ios-shortcut/     # iOS Shortcut for Safari
└── docs/design/      # Design reference images
```

## Tech Stack

- **Frontend**: Vanilla JS, HTML, CSS (no framework bloat)
- **Backend**: Supabase (PostgreSQL + REST API)
- **Hosting**: Any static host (Vercel, Netlify, GitHub Pages)

## Screenshots

*Coming soon*

## License

MIT
