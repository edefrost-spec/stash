import SwiftUI
import SwiftData

struct SaveDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var save: Save

    @State private var isEditingNotes = false
    @State private var showTagSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(save.displayTitle)
                        .font(.title)
                        .bold()

                    if let siteName = save.siteName {
                        Text(siteName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    if let author = save.author {
                        Text("by \(author)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        if let publishedAt = save.publishedAt {
                            Text(publishedAt, style: .date)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }

                        Spacer()

                        Text(save.createdAt, style: .relative)
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding()

                Divider()

                // Hero image
                if let imageUrl = save.imageUrl, let url = URL(string: imageUrl) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Rectangle()
                            .fill(.gray.opacity(0.2))
                    }
                    .frame(maxHeight: 300)
                    .clipped()
                }

                // Highlight (if this is a highlight save)
                if let highlight = save.highlight, !highlight.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Highlight", systemImage: "highlighter")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Text(highlight)
                            .font(.body)
                            .padding()
                            .background(.yellow.opacity(0.2))
                            .cornerRadius(8)
                    }
                    .padding(.horizontal)
                }

                // Main content
                if let content = save.content, !content.isEmpty {
                    Text(content)
                        .font(.body)
                        .padding(.horizontal)
                        .textSelection(.enabled)
                }

                // Notes section
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Label("Notes", systemImage: "note.text")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Spacer()

                        Button {
                            isEditingNotes.toggle()
                        } label: {
                            Text(isEditingNotes ? "Done" : "Edit")
                                .font(.caption)
                        }
                    }

                    if isEditingNotes {
                        TextField("Add your notes...", text: Binding(
                            get: { save.notes ?? "" },
                            set: { newValue in
                                save.notes = newValue.isEmpty ? nil : newValue
                                save.updatedAt = Date()
                                save.needsSync = true
                                try? modelContext.save()
                            }
                        ), axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(5...10)
                    } else if let notes = save.notes, !notes.isEmpty {
                        Text(notes)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("No notes yet")
                            .font(.body)
                            .foregroundStyle(.tertiary)
                            .italic()
                    }
                }
                .padding()
                .background(.gray.opacity(0.1))
                .cornerRadius(8)
                .padding(.horizontal)

                // Tags
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Label("Tags", systemImage: "tag")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Spacer()

                        Button {
                            showTagSheet = true
                        } label: {
                            Text("Manage")
                                .font(.caption)
                        }
                    }

                    if save.tags.isEmpty {
                        Text("No tags")
                            .font(.body)
                            .foregroundStyle(.tertiary)
                            .italic()
                    } else {
                        FlowLayout(spacing: 8) {
                            ForEach(save.tags) { tag in
                                TagChip(tag: tag)
                            }
                        }
                    }
                }
                .padding()
                .background(.gray.opacity(0.1))
                .cornerRadius(8)
                .padding(.horizontal)

                // Product info (if applicable)
                if save.isProduct {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Product", systemImage: "cart")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        if let price = save.productPrice, let currency = save.productCurrency {
                            Text("\(currency) \(price, specifier: "%.2f")")
                                .font(.title2)
                                .bold()
                        }

                        if let availability = save.productAvailability {
                            Text(availability)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                    .background(.green.opacity(0.1))
                    .cornerRadius(8)
                    .padding(.horizontal)
                }

                // Audio player (if audio available)
                if let audioUrl = save.audioUrl, let url = URL(string: audioUrl) {
                    AudioPlayerView(url: url)
                        .padding()
                        .background(.blue.opacity(0.1))
                        .cornerRadius(8)
                        .padding(.horizontal)
                }

                // Metadata footer
                if let url = save.url {
                    Link(destination: URL(string: url)!) {
                        HStack {
                            Image(systemName: "link")
                            Text("Open Original")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                        }
                        .padding()
                        .background(.blue.opacity(0.1))
                        .cornerRadius(8)
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.bottom, 32)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        toggleFavorite()
                    } label: {
                        Label(
                            save.isFavorite ? "Unfavorite" : "Favorite",
                            systemImage: save.isFavorite ? "star.fill" : "star"
                        )
                    }

                    Button {
                        markAsRead()
                    } label: {
                        Label(
                            save.readAt == nil ? "Mark as Read" : "Mark as Unread",
                            systemImage: save.readAt == nil ? "eye" : "eye.slash"
                        )
                    }

                    Divider()

                    Button(role: .destructive) {
                        archiveSave()
                    } label: {
                        Label("Archive", systemImage: "archivebox")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showTagSheet) {
            TagManagementSheet(save: save)
        }
        .onAppear {
            // Mark as read when viewed
            if save.readAt == nil {
                save.readAt = Date()
                save.updatedAt = Date()
                save.needsSync = true
                try? modelContext.save()
            }
        }
    }

    private func toggleFavorite() {
        save.isFavorite.toggle()
        save.updatedAt = Date()
        save.needsSync = true
        try? modelContext.save()
    }

    private func markAsRead() {
        if save.readAt == nil {
            save.readAt = Date()
        } else {
            save.readAt = nil
        }
        save.updatedAt = Date()
        save.needsSync = true
        try? modelContext.save()
    }

    private func archiveSave() {
        save.isArchived = true
        save.updatedAt = Date()
        save.needsSync = true
        try? modelContext.save()
    }
}

// MARK: - Tag Chip View

struct TagChip: View {
    let tag: Tag

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color(hex: tag.color ?? "#999999"))
                .frame(width: 8, height: 8)

            Text(tag.name)
                .font(.caption)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.gray.opacity(0.2))
        .cornerRadius(16)
    }
}

// MARK: - Flow Layout for Tags

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.replacingUnspecifiedDimensions().width, subviews: subviews, spacing: spacing)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.frames[index].minX, y: bounds.minY + result.frames[index].minY), proposal: .unspecified)
        }
    }

    struct FlowResult {
        var frames: [CGRect] = []
        var size: CGSize = .zero

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var currentX: CGFloat = 0
            var currentY: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if currentX + size.width > maxWidth && currentX > 0 {
                    currentX = 0
                    currentY += lineHeight + spacing
                    lineHeight = 0
                }

                frames.append(CGRect(origin: CGPoint(x: currentX, y: currentY), size: size))
                currentX += size.width + spacing
                lineHeight = max(lineHeight, size.height)
            }

            self.size = CGSize(width: maxWidth, height: currentY + lineHeight)
        }
    }
}

// MARK: - Audio Player View

struct AudioPlayerView: View {
    let url: URL
    @State private var isPlaying = false

    var body: some View {
        HStack {
            Button {
                isPlaying.toggle()
                // TODO: Implement actual audio playback
            } label: {
                Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.title)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Audio Available")
                    .font(.subheadline)
                    .bold()

                Text("Tap to listen")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }
}

// MARK: - Tag Management Sheet

struct TagManagementSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Query private var allTags: [Tag]

    @Bindable var save: Save
    @State private var newTagName = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        TextField("New tag", text: $newTagName)
                        Button("Add") {
                            addTag()
                        }
                        .disabled(newTagName.isEmpty)
                    }
                }

                Section("Available Tags") {
                    ForEach(allTags) { tag in
                        Button {
                            toggleTag(tag)
                        } label: {
                            HStack {
                                TagChip(tag: tag)
                                Spacer()
                                if save.tags.contains(where: { $0.id == tag.id }) {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.blue)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Manage Tags")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func addTag() {
        let tag = Tag(name: newTagName)
        modelContext.insert(tag)
        save.tags.append(tag)
        save.updatedAt = Date()
        save.needsSync = true
        try? modelContext.save()
        newTagName = ""
    }

    private func toggleTag(_ tag: Tag) {
        if let index = save.tags.firstIndex(where: { $0.id == tag.id }) {
            save.tags.remove(at: index)
        } else {
            save.tags.append(tag)
        }
        save.updatedAt = Date()
        save.needsSync = true
        try? modelContext.save()
    }
}

#Preview {
    NavigationStack {
        SaveDetailView(save: Save(
            title: "Sample Article",
            excerpt: "This is a sample excerpt for the preview.",
            content: "Full article content would go here...",
            siteName: "Example.com"
        ))
    }
    .modelContainer(for: [Save.self, Tag.self])
}
