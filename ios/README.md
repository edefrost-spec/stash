# Stash iOS App

Native iOS app for Stash - your self-hosted read-it-later service.

## Features

- Browse and search your saved articles, highlights, and notes
- Organize with folders and tags
- Save articles from Safari via Share Extension
- Automatic article text extraction
- Offline reading support with SwiftData
- Clean SwiftUI interface

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.9+

## Setup

### 1. Create Xcode Project

Since Xcode projects can't be created via CLI, follow these steps:

1. Open Xcode
2. File → New → Project
3. Choose "iOS" → "App"
4. Configure:
   - Product Name: `Stash`
   - Team: Your team
   - Organization Identifier: `com.yourname` (or your bundle ID)
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: **SwiftData**
   - Include Tests: Yes
5. Save to: `/Users/edenfrost/Stash/stash/ios/`

### 2. Add Dependencies

Add these Swift Package dependencies in Xcode:

1. **Supabase Swift SDK**
   - URL: `https://github.com/supabase/supabase-swift`
   - Version: Up to Next Major (2.0.0)
   - Products: `Supabase`, `Auth`, `PostgREST`, `Realtime`, `Storage`

2. **SwiftSoup** (for HTML parsing)
   - URL: `https://github.com/scinfu/SwiftSoup`
   - Version: Up to Next Major (2.0.0)

### 3. Configure Supabase Credentials

1. Copy the `Config.example.swift` to `Config.swift`
2. Add your Supabase credentials from your project settings
3. Add `Config.swift` to `.gitignore`

### 4. Add Share Extension

1. File → New → Target
2. Choose "Share Extension"
3. Name: `Stash Share Extension`
4. Language: Swift, Embed in Application: Stash
5. Replace the default `ShareViewController` with the one in `ShareExtension/`

### 5. Configure Capabilities

Enable these in your app target:

- **App Groups**: `group.com.yourname.stash` (for sharing data between app and extension)
- **Background Modes**: Background fetch (for syncing)

### 6. Build and Run

- Select your device/simulator
- Press Cmd+R to build and run

## Project Structure

```
Stash/
├── App/
│   ├── StashApp.swift           # App entry point
│   └── Config.swift              # Supabase credentials (gitignored)
├── Models/
│   ├── Save.swift                # Save model (articles, highlights, etc)
│   ├── Folder.swift              # Folder model
│   └── Tag.swift                 # Tag model
├── Services/
│   ├── SupabaseService.swift    # Supabase client wrapper
│   └── SyncService.swift         # Offline sync logic
├── Views/
│   ├── SavesListView.swift      # Main list of saves
│   ├── SaveDetailView.swift     # Article detail view
│   ├── SearchView.swift          # Search interface
│   ├── FoldersView.swift         # Folder management
│   └── SettingsView.swift        # App settings
└── ShareExtension/
    └── ShareViewController.swift # Safari share extension
```

## Usage

### Saving from Safari

1. In Safari, tap the Share button
2. Select "Stash"
3. Article will be extracted and saved

### Browsing Saves

- Pull to refresh to sync latest from server
- Tap a save to read full article
- Swipe left for quick actions (archive, favorite)
- Use search bar to find saves

### Organizing

- Create folders in the Folders tab
- Add tags to saves
- Filter by folder or tag

## Development Notes

- Uses SwiftData for local persistence
- Syncs with Supabase when online
- Share Extension uses same models and service layer
- Configured for single-user mode (matches web app default)

## License

MIT
