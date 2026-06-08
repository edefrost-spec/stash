import Foundation

/// Supabase configuration
/// Copy this file to Config.swift and add your credentials
enum Config {
    /// Your Supabase project URL
    /// Find at: https://app.supabase.com/project/_/settings/api
    static let supabaseURL = "https://eacfqyvrsvgrstjbeyeh.supabase.co"

    /// Your Supabase anon/public key
    /// Find at: https://app.supabase.com/project/_/settings/api
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhY2ZxeXZyc3ZncnN0amJleWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NzYyNDMsImV4cCI6MjA4NDE1MjI0M30.cltDGHh-OCZ2gxO3edcVIvCY3hXdTf4PAAZWESGE4CQ"

    /// Your user ID (for single-user mode)
    /// Generate a UUID or use the one from your web/extension config
    /// In multi-user mode, this would come from Supabase Auth
    static let userId = "93dfdbc7-8d8f-4b97-8014-7e4e85e7b2e7"

    /// App Group identifier for sharing data with Share Extension
    /// Must match the App Group capability in Xcode
    static let appGroupIdentifier = "group.com.Eden.stash"
}
