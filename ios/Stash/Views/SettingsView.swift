import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var supabase = SupabaseService.shared
    @StateObject private var syncService = SyncService.shared

    @State private var showClearCacheAlert = false
    @State private var cacheSize = "Calculating..."

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Image(systemName: "bookmark.fill")
                            .font(.title)
                            .foregroundStyle(.blue)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Stash")
                                .font(.title2)
                                .bold()
                            Text("Self-hosted read-it-later")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 8)
                }

                Section("Sync") {
                    HStack {
                        Label("Status", systemImage: "arrow.triangle.2.circlepath")
                        Spacer()
                        if syncService.isSyncing {
                            ProgressView()
                        } else {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                        }
                    }

                    if let lastSync = supabase.lastSyncDate {
                        LabeledContent("Last Sync") {
                            Text(lastSync, style: .relative)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Button {
                        Task {
                            await syncService.syncAll(context: modelContext)
                        }
                    } label: {
                        Label("Sync Now", systemImage: "arrow.clockwise")
                    }
                    .disabled(syncService.isSyncing)
                }

                Section("Storage") {
                    LabeledContent("Cache Size") {
                        Text(cacheSize)
                            .foregroundStyle(.secondary)
                    }

                    Button(role: .destructive) {
                        showClearCacheAlert = true
                    } label: {
                        Label("Clear Cache", systemImage: "trash")
                    }
                }

                Section("Account") {
                    LabeledContent("User ID") {
                        Text(Config.userId.prefix(8) + "...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    LabeledContent("Server") {
                        Text(URL(string: Config.supabaseURL)?.host ?? "Unknown")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("About") {
                    Link(destination: URL(string: "https://github.com/yourusername/stash")!) {
                        Label("GitHub Repository", systemImage: "link")
                    }

                    LabeledContent("Version") {
                        Text("1.0.0")
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        // TODO: Implement logout/reset
                    } label: {
                        Text("Reset App")
                    }
                }
            }
            .navigationTitle("Settings")
            .alert("Clear Cache?", isPresented: $showClearCacheAlert) {
                Button("Cancel", role: .cancel) {}
                Button("Clear", role: .destructive) {
                    clearCache()
                }
            } message: {
                Text("This will delete all locally cached saves. They will be re-downloaded on next sync.")
            }
            .onAppear {
                calculateCacheSize()
            }
        }
    }

    private func calculateCacheSize() {
        // Simple approximation - count saves
        let descriptor = FetchDescriptor<Save>()
        if let saves = try? modelContext.fetch(descriptor) {
            let count = saves.count
            let estimatedSizeKB = count * 50 // Rough estimate: 50KB per save
            if estimatedSizeKB < 1024 {
                cacheSize = "\(estimatedSizeKB) KB"
            } else {
                cacheSize = String(format: "%.1f MB", Double(estimatedSizeKB) / 1024.0)
            }
        }
    }

    private func clearCache() {
        let descriptor = FetchDescriptor<Save>()
        if let saves = try? modelContext.fetch(descriptor) {
            for save in saves {
                modelContext.delete(save)
            }
            try? modelContext.save()
            calculateCacheSize()
        }
    }
}

#Preview {
    SettingsView()
        .modelContainer(for: [Save.self])
}
