# Stash iOS App Architecture

## Overview

The Stash iOS app is built with SwiftUI and follows modern iOS development practices, using SwiftData for local persistence and Supabase for backend sync.

## Tech Stack

- **UI Framework**: SwiftUI (iOS 17+)
- **Data Persistence**: SwiftData
- **Networking**: Supabase Swift SDK
- **Backend**: Supabase (shared with web app)
- **HTML Parsing**: SwiftSoup

## Architecture Pattern

The app follows an **MVVM-like** architecture with SwiftUI's data flow:

```
┌─────────────────┐
│     Views       │ ← User Interface (SwiftUI)
└────────┬────────┘
         │
         ├─ @Query (SwiftData)
         │
┌────────▼────────┐
│     Models      │ ← SwiftData models (@Model)
└────────┬────────┘
         │
┌────────▼────────┐
│    Services     │ ← Business logic
│  - Supabase     │
│  - Sync         │
└─────────────────┘
```

## Key Components

### 1. Models (`Models/`)

SwiftData models with Supabase sync support:

- **Save**: Main content model (articles, highlights, notes, etc.)
- **Folder**: Organization container
- **Tag**: Categorization labels

Each model includes:
- All fields from Supabase schema
- `needsSync` flag for offline changes
- Bidirectional conversion to/from DTOs

### 2. Services (`Services/`)

#### SupabaseService
- Singleton service wrapping Supabase Swift SDK
- CRUD operations for all models
- Full-text search via RPC
- Edge Function invocations (save-page, auto-tag)
- DTOs for network serialization

#### SyncService
- Bidirectional sync between SwiftData and Supabase
- Push local changes (where `needsSync = true`)
- Pull remote changes (newer than last sync)
- Conflict resolution (last-write-wins)
- Background sync support

### 3. Views (`Views/`)

#### SavesListView
- Main feed of saves
- Pull-to-refresh sync
- Swipe actions (favorite, archive)
- Filter by folder/tags
- Search integration

#### SaveDetailView
- Full article reader
- Inline note editing
- Tag management
- Audio player (if available)
- Quick actions menu

#### SearchView
- Local search (on-device)
- Server search (via RPC)
- Mode toggle
- Real-time results

#### FoldersView
- Folder CRUD
- Color picker
- Folder detail with saves list

#### SettingsView
- Sync status
- Cache management
- App info

### 4. Share Extension (`ShareExtension/`)

Safari and app share integration:

- Receives URL from Share Sheet
- Extracts article using WKWebView + JavaScript
- Gets metadata (title, excerpt, image)
- Saves to Supabase directly
- Triggers auto-tagging

## Data Flow

### Saving an Article

```
Safari Share
    │
    ├─> ShareViewController
    │       │
    │       ├─ Load URL in WKWebView
    │       ├─ Extract content (JS)
    │       ├─ Create SaveDTO
    │       │
    │       └─> SupabaseService.createSave()
    │               │
    │               └─> Supabase REST API
    │
Main App (after sync)
    │
    └─> SyncService.pullRemoteChanges()
            │
            ├─ Fetch new saves
            ├─ Convert DTOs to Models
            │
            └─> Insert into SwiftData
```

### Offline Editing

```
User edits save
    │
    ├─> SaveDetailView updates model
    │
    ├─> Set needsSync = true
    │
    └─> SwiftData saves locally

Next sync
    │
    └─> SyncService.pushLocalChanges()
            │
            ├─ Find models where needsSync = true
            ├─ Convert to DTOs
            │
            └─> SupabaseService.updateSave()
                    │
                    └─> Supabase REST API
```

## Offline Support

### Strategy

- **SwiftData as source of truth** for local data
- All reads from SwiftData (instant, offline-capable)
- Writes go to SwiftData + set `needsSync = true`
- Background sync reconciles with Supabase

### Sync Triggers

1. **Pull to refresh** - User-initiated
2. **App launch** - Auto-sync on startup
3. **Share Extension** - Direct save (no local storage)
4. **Background fetch** - Periodic sync (if configured)

### Conflict Resolution

- **Last-write-wins** based on `updated_at` timestamp
- No operational transform (simple use case)
- Deletes handled via `is_archived` soft delete

## Share Extension Architecture

The Share Extension is a separate target that:

1. Shares `Config.swift` via app group
2. Shares `SupabaseService.swift` for network calls
3. Does NOT use SwiftData (no persistent state)
4. Saves directly to Supabase
5. Main app pulls changes on next sync

### Why Not SwiftData in Extension?

- Extensions are ephemeral
- Simpler to save directly to server
- Avoids container sharing complexity
- Main app remains source of truth

## Security

### Credentials

- Config stored in `Config.swift` (gitignored)
- Uses Supabase anon key (RLS-protected)
- Single-user mode (hardcoded USER_ID)

### Future: Multi-User

To support multiple users:
1. Integrate Supabase Auth
2. Remove hardcoded `Config.userId`
3. Store session in Keychain
4. Update RLS queries to use auth.uid()

## Performance

### Optimizations

- SwiftData indices on `created_at`, `is_archived`
- Lazy loading in lists
- Image caching via AsyncImage
- Pagination for large datasets (TODO)

### Memory

- Articles capped at 100KB server-side
- Images loaded on-demand
- Audio streamed (not downloaded)

## Testing Strategy

### Unit Tests

- Model conversions (DTO ↔ Model)
- Sync logic (push/pull)
- Service layer (mocked network)

### UI Tests

- Save flow (Share Extension)
- Search functionality
- Sync scenarios

### Manual Testing

- Offline mode
- Large datasets
- Network failures

## Future Enhancements

### Planned Features

1. **Widgets** - Home screen quick access
2. **Push Notifications** - Digest reminders
3. **iCloud Sync** - Cross-device (alternative to Supabase)
4. **Siri Shortcuts** - Voice commands
5. **iPad Optimization** - Split view, drag-drop
6. **macOS Catalyst** - Desktop app

### Technical Debt

- Add pagination for saves list
- Implement proper audio player
- Background fetch capability
- Network reachability monitoring
- Improved error handling

## File Structure

```
ios/
├── README.md                   # Setup instructions
├── ARCHITECTURE.md             # This file
├── Config.example.swift        # Template for credentials
│
├── Stash/
│   ├── App/
│   │   ├── StashApp.swift     # App entry point
│   │   └── Config.swift        # Credentials (gitignored)
│   │
│   ├── Models/
│   │   ├── Save.swift
│   │   ├── Folder.swift
│   │   └── Tag.swift
│   │
│   ├── Services/
│   │   ├── SupabaseService.swift
│   │   └── SyncService.swift
│   │
│   └── Views/
│       ├── SavesListView.swift
│       ├── SaveDetailView.swift
│       ├── SearchView.swift
│       ├── FoldersView.swift
│       └── SettingsView.swift
│
└── ShareExtension/
    ├── ShareViewController.swift
    └── Info.plist
```

## Dependencies

### Swift Packages

1. **supabase-swift** (2.x)
   - `Supabase` - Client
   - `PostgREST` - Database queries
   - `Auth` - Authentication (future)
   - `Storage` - File uploads
   - `Realtime` - Live updates (future)

2. **SwiftSoup** (2.x)
   - HTML parsing
   - Article extraction fallback

## Build Configurations

### Debug

- Verbose logging
- Network inspector enabled
- Uses Config.swift values

### Release

- Optimized
- Minimal logging
- App Store ready

## Deployment

### TestFlight

1. Archive in Xcode
2. Upload to App Store Connect
3. Create TestFlight build
4. Add testers

### App Store

1. Screenshots (required sizes)
2. Privacy policy
3. App review notes (Supabase credentials for review)
4. Release notes

## Resources

- [Supabase Swift Docs](https://supabase.com/docs/reference/swift)
- [SwiftData Guide](https://developer.apple.com/documentation/swiftdata)
- [Share Extension Guide](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)
