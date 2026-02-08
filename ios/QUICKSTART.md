# Stash iOS - Quick Start Guide

Get the iOS app running in 15 minutes!

## Prerequisites

- macOS 14.0+
- Xcode 15.0+
- Active Supabase project (from main Stash setup)
- iOS device or simulator (iOS 17+)

## Step-by-Step Setup

### 1. Open Xcode and Create Project (5 min)

1. Launch Xcode
2. File → New → Project
3. Select **iOS** → **App** template
4. Fill in:
   - Product Name: `Stash`
   - Team: Select your Apple Developer team
   - Organization Identifier: `com.yourname` (use your bundle ID)
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: **SwiftData**
   - Include Tests: ✓
5. Save to: `/Users/edenfrost/Stash/stash/ios/`
6. Click Create

### 2. Add Dependencies (3 min)

1. In Xcode, select the project in the navigator
2. Select the **Stash** target
3. Go to **Package Dependencies** tab
4. Click **+** button

#### Add Supabase:
- URL: `https://github.com/supabase/supabase-swift`
- Dependency Rule: Up to Next Major Version `2.0.0`
- Click **Add Package**
- Select products: `Supabase`, `Auth`, `PostgREST`, `Realtime`, `Storage`
- Click **Add Package**

#### Add SwiftSoup:
- Click **+** again
- URL: `https://github.com/scinfu/SwiftSoup`
- Dependency Rule: Up to Next Major Version `2.0.0`
- Click **Add Package**

### 3. Add Source Files (2 min)

1. In Finder, navigate to `/Users/edenfrost/Stash/stash/ios/`
2. Drag the **entire `Stash/` folder** into your Xcode project
3. Check **Copy items if needed**
4. Ensure **Create groups** is selected
5. Click Finish

### 4. Configure Credentials (2 min)

1. In Xcode, duplicate `Config.example.swift`
2. Rename to `Config.swift`
3. Fill in your Supabase credentials:

```swift
enum Config {
    static let supabaseURL = "https://YOUR_PROJECT.supabase.co"
    static let supabaseAnonKey = "eyJ..." // Your anon key
    static let userId = "YOUR_USER_ID" // From web config
    static let appGroupIdentifier = "group.com.yourname.stash"
}
```

**Where to find these:**
- Supabase URL & Key: [app.supabase.com](https://app.supabase.com) → Your Project → Settings → API
- User ID: Check `extension/config.js` or `web/config.js` from your Stash setup

### 5. Add Share Extension Target (3 min)

1. File → New → Target
2. Select **iOS** → **Share Extension**
3. Product Name: `Stash Share Extension`
4. Team: Same as main app
5. Language: **Swift**
6. Click **Finish**
7. Click **Activate** when prompted

#### Configure Share Extension:

1. Delete the default `ShareViewController.swift` that Xcode created
2. In Finder, drag `ios/ShareExtension/ShareViewController.swift` into the **Stash Share Extension** folder in Xcode
3. Ensure it's added to the **Stash Share Extension** target
4. Replace `Info.plist` with the one from `ios/ShareExtension/Info.plist`

### 6. Configure App Groups (2 min)

Enable data sharing between app and extension:

#### Main App:
1. Select **Stash** target
2. Go to **Signing & Capabilities**
3. Click **+ Capability**
4. Add **App Groups**
5. Click **+** and create: `group.com.yourname.stash`
   (Replace `com.yourname` with your bundle ID)

#### Share Extension:
1. Select **Stash Share Extension** target
2. Repeat steps above
3. Use the **same App Group ID**

### 7. Build and Run!

1. Select your target device (iPhone/simulator)
2. Press **⌘R** or click the Play button
3. Wait for build to complete
4. App should launch on your device!

## Testing the App

### Test Main App

1. The app will be empty initially
2. Tap the refresh button to sync from Supabase
3. Any saves from your web app should appear!

### Test Share Extension

1. Open Safari on your device
2. Navigate to any article (e.g., [news.ycombinator.com](https://news.ycombinator.com))
3. Tap the **Share** button
4. Scroll and tap **More** (three dots)
5. Enable **Stash**
6. Go back and select **Stash**
7. Article should be saved!
8. Return to the Stash app and pull to refresh

## Troubleshooting

### Build Errors

**"No such module 'Supabase'"**
- Clean build folder: Product → Clean Build Folder (⇧⌘K)
- Rebuild: Product → Build (⌘B)

**"Cannot find Config.swift"**
- Make sure you created `Config.swift` from `Config.example.swift`
- Check it's added to the Stash target

**SwiftData errors**
- Make sure you selected **SwiftData** storage when creating the project
- Check that models have `@Model` macro

### Runtime Errors

**"Failed to initialize model container"**
- App Group ID mismatch - check both targets use the same ID
- ID in `Config.swift` matches the capability

**Network errors**
- Check Supabase URL and key are correct
- Verify Supabase project is running
- Check device has internet connection

**Empty list after refresh**
- Check `Config.userId` matches your web app
- Verify RLS policies in Supabase allow your user_id
- Check Supabase logs for errors

### Share Extension Issues

**"Stash" not appearing in Share Sheet**
- Rebuild the project
- Restart the device/simulator
- Check extension Info.plist activation rules

**Extension crashes when saving**
- Check Share Extension has `Config.swift`
- Verify App Group is configured
- Check logs in Xcode console

## Next Steps

### Customize

- [ ] Change app icon (in Assets.xcassets)
- [ ] Update bundle ID to your own
- [ ] Customize colors in views
- [ ] Add your branding

### Deploy

- [ ] Archive for TestFlight
- [ ] Create App Store listing
- [ ] Submit for review

### Enhance

- [ ] Add offline support improvements
- [ ] Implement audio player
- [ ] Add widgets
- [ ] Create iPad layouts

## Getting Help

- Check [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- Review [README.md](README.md) for features
- File issues on GitHub

## Success Checklist

- [x] Xcode project created
- [x] Dependencies added (Supabase, SwiftSoup)
- [x] Source files imported
- [x] Config.swift configured
- [x] Share Extension added
- [x] App Groups enabled
- [x] App builds and runs
- [x] Saves sync from server
- [x] Share Extension works from Safari

Congratulations! Your Stash iOS app is ready! 🎉
