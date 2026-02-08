import Foundation

/// Supabase configuration
/// Copy this file to Config.swift and add your credentials
enum Config {
    /// Your Supabase project URL
    /// Find at: https://app.supabase.com/project/_/settings/api
    static let supabaseURL = "https://YOUR_PROJECT_ID.supabase.co"

    /// Your Supabase anon/public key
    /// Find at: https://app.supabase.com/project/_/settings/api
    static let supabaseAnonKey = "YOUR_ANON_KEY_HERE"

    /// Your user ID (for single-user mode)
    /// Generate a UUID or use the one from your web/extension config
    /// In multi-user mode, this would come from Supabase Auth
    static let userId = "YOUR_USER_ID_HERE"

    /// App Group identifier for sharing data with Share Extension
    /// Must match the App Group capability in Xcode
    static let appGroupIdentifier = "group.com.yourname.stash"
}
