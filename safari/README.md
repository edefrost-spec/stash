# Safari Web Extension (macOS + iOS)

This project uses a **Safari Web Extension wrapper** so you can reuse the existing Chrome extension code for **Safari on Mac and iPhone/iPad**.

Apple provides a converter that generates an Xcode project which wraps the Web Extension.

## Prereqs
- macOS with Xcode installed
- Safari 15+ (macOS) / iOS 15+ (iPhone/iPad)

## Generate the Safari Extension Project

From the repo root:

```bash
xcrun safari-web-extension-packager extension --project-location safari --app-name Stash --bundle-identifier com.stash.app --no-open --no-prompt --copy-resources --force
```

The converter will prompt you for:
- Project name and output location (use `safari/` as the output folder)
- Bundle identifier (e.g. `com.yourname.stash`)
- Platforms to include (select **macOS** and **iOS**)

This creates an Xcode project in the folder you choose.

## Build & Run (macOS)

1. Open the generated `.xcodeproj` in Xcode.
2. Select the **macOS** target and click Run.
3. In Safari → Settings → Extensions, enable “Stash”.

## Build & Run (iOS)

1. In Xcode, select the **iOS** target.
2. Choose your iPhone as the run destination and click Run.
3. On your iPhone: Settings → Safari → Extensions → enable “Stash”.
4. In Safari, tap the `aA` menu → Extensions to use it.

## Notes / Limitations
- **Right‑click image save** works on macOS Safari.
- **iOS Safari does not have right‑click**, so image saving depends on what iOS Safari exposes to extensions. Use the toolbar/popup to save pages.
- For quick saves on iPhone/iPad, the **Share Sheet iOS Shortcut** (`ios-shortcut/README.md`) is still the fastest path.
