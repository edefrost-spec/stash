import SwiftUI
import SwiftData

struct SavesListView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var syncService = SyncService.shared

    @Query(
        filter: #Predicate<Save> { !$0.isArchived },
        sort: \Save.createdAt,
        order: .reverse
    ) private var saves: [Save]

    @State private var searchText = ""
    @State private var selectedFolder: Folder?
    @State private var selectedTags: Set<Tag> = []
    @State private var showFilters = false
    @State private var isRefreshing = false

    var filteredSaves: [Save] {
        var result = saves

        // Filter by search text
        if !searchText.isEmpty {
            result = result.filter { save in
                save.displayTitle.localizedCaseInsensitiveContains(searchText) ||
                (save.excerpt ?? "").localizedCaseInsensitiveContains(searchText) ||
                (save.content ?? "").localizedCaseInsensitiveContains(searchText)
            }
        }

        // Filter by folder
        if let folder = selectedFolder {
            result = result.filter { $0.folder?.id == folder.id }
        }

        // Filter by tags
        if !selectedTags.isEmpty {
            result = result.filter { save in
                !Set(save.tags).isDisjoint(with: selectedTags)
            }
        }

        return result
    }

    var body: some View {
        NavigationStack {
            List {
                if filteredSaves.isEmpty {
                    ContentUnavailableView(
                        "No Saves",
                        systemImage: "bookmark.slash",
                        description: Text("Save articles from Safari using the Share Extension")
                    )
                } else {
                    ForEach(filteredSaves) { save in
                        NavigationLink(destination: SaveDetailView(save: save)) {
                            SaveRowView(save: save)
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                toggleFavorite(save)
                            } label: {
                                Label("Favorite", systemImage: save.isFavorite ? "star.fill" : "star")
                            }
                            .tint(.yellow)
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                archiveSave(save)
                            } label: {
                                Label("Archive", systemImage: "archivebox")
                            }
                        }
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search saves")
            .navigationTitle("Saves")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showFilters.toggle()
                    } label: {
                        Label("Filters", systemImage: "line.3.horizontal.decrease.circle")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            await refreshSaves()
                        }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .disabled(isRefreshing)
                }
            }
            .refreshable {
                await refreshSaves()
            }
            .sheet(isPresented: $showFilters) {
                FilterSheetView(
                    selectedFolder: $selectedFolder,
                    selectedTags: $selectedTags
                )
            }
            .overlay {
                if syncService.isSyncing {
                    ProgressView()
                        .scaleEffect(1.5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(.ultraThinMaterial)
                }
            }
        }
    }

    private func refreshSaves() async {
        isRefreshing = true
        await syncService.syncAll(context: modelContext)
        isRefreshing = false
    }

    private func toggleFavorite(_ save: Save) {
        save.isFavorite.toggle()
        save.updatedAt = Date()
        save.needsSync = true
        try? modelContext.save()
    }

    private func archiveSave(_ save: Save) {
        withAnimation {
            save.isArchived = true
            save.updatedAt = Date()
            save.needsSync = true
            try? modelContext.save()
        }
    }
}

// MARK: - Save Row View

struct SaveRowView: View {
    let save: Save

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header with type icon and title
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: save.saveType.icon)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 4) {
                    Text(save.displayTitle)
                        .font(.headline)
                        .lineLimit(2)

                    if let subtitle = save.displaySubtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                if save.isFavorite {
                    Image(systemName: "star.fill")
                        .foregroundStyle(.yellow)
                        .font(.caption)
                }
            }

            // Excerpt
            if let excerpt = save.excerpt, !excerpt.isEmpty {
                Text(excerpt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            // Metadata row
            HStack(spacing: 12) {
                // Tags
                if !save.tags.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "tag.fill")
                            .font(.caption2)
                        Text(save.tags.map(\.name).joined(separator: ", "))
                            .font(.caption)
                    }
                    .foregroundStyle(.secondary)
                }

                Spacer()

                // Date
                Text(save.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Filter Sheet

struct FilterSheetView: View {
    @Environment(\.dismiss) private var dismiss
    @Query private var folders: [Folder]
    @Query private var tags: [Tag]

    @Binding var selectedFolder: Folder?
    @Binding var selectedTags: Set<Tag>

    var body: some View {
        NavigationStack {
            Form {
                Section("Folder") {
                    Button {
                        selectedFolder = nil
                    } label: {
                        HStack {
                            Text("All Folders")
                            Spacer()
                            if selectedFolder == nil {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }

                    ForEach(folders) { folder in
                        Button {
                            selectedFolder = folder
                        } label: {
                            HStack {
                                Circle()
                                    .fill(Color(hex: folder.color ?? "#999999"))
                                    .frame(width: 12, height: 12)

                                Text(folder.name)

                                Spacer()

                                if selectedFolder?.id == folder.id {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.blue)
                                }
                            }
                        }
                    }
                }

                Section("Tags") {
                    if tags.isEmpty {
                        Text("No tags yet")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(tags) { tag in
                            Button {
                                if selectedTags.contains(tag) {
                                    selectedTags.remove(tag)
                                } else {
                                    selectedTags.insert(tag)
                                }
                            } label: {
                                HStack {
                                    Circle()
                                        .fill(Color(hex: tag.color ?? "#999999"))
                                        .frame(width: 12, height: 12)

                                    Text(tag.name)

                                    Spacer()

                                    if selectedTags.contains(tag) {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.blue)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .cancellationAction) {
                    Button("Clear") {
                        selectedFolder = nil
                        selectedTags.removeAll()
                    }
                }
            }
        }
    }
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

#Preview {
    SavesListView()
        .modelContainer(for: [Save.self, Folder.self, Tag.self])
}
