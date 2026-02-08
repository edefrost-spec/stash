import Foundation
import SwiftData

/// Service for syncing local SwiftData with Supabase
@MainActor
class SyncService: ObservableObject {
    static let shared = SyncService()

    private let supabase = SupabaseService.shared

    @Published var isSyncing = false
    @Published var lastError: Error?

    private init() {}

    /// Sync all data with Supabase
    func syncAll(context: ModelContext) async {
        guard !isSyncing else { return }

        isSyncing = true
        defer { isSyncing = false }

        do {
            // First, push local changes to Supabase
            try await pushLocalChanges(context: context)

            // Then, pull remote changes from Supabase
            try await pullRemoteChanges(context: context)

            SupabaseService.shared.lastSyncDate = Date()
        } catch {
            lastError = error
            print("Sync error: \(error)")
        }
    }

    /// Push local changes that need syncing to Supabase
    private func pushLocalChanges(context: ModelContext) async throws {
        // Find saves that need syncing
        let saveDescriptor = FetchDescriptor<Save>(
            predicate: #Predicate { $0.needsSync }
        )
        let localSaves = try context.fetch(saveDescriptor)

        for save in localSaves {
            let dto = save.toDTO()

            // Check if save exists on server (by checking if it was created locally)
            if save.createdAt > (SupabaseService.shared.lastSyncDate ?? .distantPast) {
                // New save - create on server
                _ = try await supabase.createSave(dto)
            } else {
                // Existing save - update on server
                try await supabase.updateSave(dto)
            }

            save.needsSync = false
        }

        // Sync folders
        let folderDescriptor = FetchDescriptor<Folder>(
            predicate: #Predicate { $0.needsSync }
        )
        let localFolders = try context.fetch(folderDescriptor)

        for folder in localFolders {
            let dto = folder.toDTO()

            if folder.createdAt > (SupabaseService.shared.lastSyncDate ?? .distantPast) {
                _ = try await supabase.createFolder(dto)
            } else {
                try await supabase.updateFolder(dto)
            }

            folder.needsSync = false
        }

        // Sync tags
        let tagDescriptor = FetchDescriptor<Tag>(
            predicate: #Predicate { $0.needsSync }
        )
        let localTags = try context.fetch(tagDescriptor)

        for tag in localTags {
            let dto = tag.toDTO()

            if tag.createdAt > (SupabaseService.shared.lastSyncDate ?? .distantPast) {
                _ = try await supabase.createTag(dto)
            }

            tag.needsSync = false
        }

        try context.save()
    }

    /// Pull remote changes from Supabase and update local database
    private func pullRemoteChanges(context: ModelContext) async throws {
        // Fetch all saves from Supabase
        let remoteSaves = try await supabase.fetchSaves()

        for saveDTO in remoteSaves {
            // Check if save exists locally
            let descriptor = FetchDescriptor<Save>(
                predicate: #Predicate { $0.id == saveDTO.id }
            )

            if let existingSave = try context.fetch(descriptor).first {
                // Update existing save if remote is newer
                if saveDTO.updated_at > existingSave.updatedAt {
                    existingSave.updateFrom(dto: saveDTO, context: context)
                }
            } else {
                // Insert new save
                let newSave = saveDTO.toModel(context: context)
                context.insert(newSave)
            }
        }

        // Fetch folders
        let remoteFolders = try await supabase.fetchFolders()

        for folderDTO in remoteFolders {
            let descriptor = FetchDescriptor<Folder>(
                predicate: #Predicate { $0.id == folderDTO.id }
            )

            if let existingFolder = try context.fetch(descriptor).first {
                if folderDTO.updated_at > existingFolder.updatedAt {
                    existingFolder.updateFrom(dto: folderDTO)
                }
            } else {
                let newFolder = folderDTO.toModel()
                context.insert(newFolder)
            }
        }

        // Fetch tags
        let remoteTags = try await supabase.fetchTags()

        for tagDTO in remoteTags {
            let descriptor = FetchDescriptor<Tag>(
                predicate: #Predicate { $0.id == tagDTO.id }
            )

            if let existingTag = try context.fetch(descriptor).first {
                if tagDTO.updated_at > existingTag.updatedAt {
                    existingTag.updateFrom(dto: tagDTO)
                }
            } else {
                let newTag = tagDTO.toModel()
                context.insert(newTag)
            }
        }

        try context.save()
    }
}

// MARK: - Model Extensions for DTO Conversion

extension Save {
    /// Convert to DTO for Supabase
    func toDTO() -> SaveDTO {
        SaveDTO(
            id: id,
            user_id: userId,
            url: url,
            title: title,
            excerpt: excerpt,
            content: content,
            highlight: highlight,
            notes: notes,
            site_name: siteName,
            author: author,
            published_at: publishedAt,
            image_url: imageUrl,
            is_archived: isArchived,
            is_favorite: isFavorite,
            is_pinned: isPinned,
            read_at: readAt,
            audio_url: audioUrl,
            note_color: noteColor,
            note_gradient: noteGradient,
            is_product: isProduct,
            product_price: productPrice,
            product_currency: productCurrency,
            product_availability: productAvailability,
            folder_id: folder?.id,
            created_at: createdAt,
            updated_at: updatedAt
        )
    }

    /// Update from DTO
    func updateFrom(dto: SaveDTO, context: ModelContext) {
        url = dto.url
        title = dto.title
        excerpt = dto.excerpt
        content = dto.content
        highlight = dto.highlight
        notes = dto.notes
        siteName = dto.site_name
        author = dto.author
        publishedAt = dto.published_at
        imageUrl = dto.image_url
        isArchived = dto.is_archived
        isFavorite = dto.is_favorite
        isPinned = dto.is_pinned
        readAt = dto.read_at
        audioUrl = dto.audio_url
        noteColor = dto.note_color
        noteGradient = dto.note_gradient
        isProduct = dto.is_product
        productPrice = dto.product_price
        productCurrency = dto.product_currency
        productAvailability = dto.product_availability
        updatedAt = dto.updated_at

        // Update folder relationship
        if let folderId = dto.folder_id {
            let descriptor = FetchDescriptor<Folder>(
                predicate: #Predicate { $0.id == folderId }
            )
            folder = try? context.fetch(descriptor).first
        } else {
            folder = nil
        }

        needsSync = false
    }
}

extension Folder {
    /// Convert to DTO for Supabase
    func toDTO() -> FolderDTO {
        FolderDTO(
            id: id,
            user_id: userId,
            name: name,
            color: color,
            created_at: createdAt,
            updated_at: updatedAt
        )
    }

    /// Update from DTO
    func updateFrom(dto: FolderDTO) {
        name = dto.name
        color = dto.color
        updatedAt = dto.updated_at
        needsSync = false
    }
}

extension Tag {
    /// Convert to DTO for Supabase
    func toDTO() -> TagDTO {
        TagDTO(
            id: id,
            user_id: userId,
            name: name,
            color: color,
            created_at: createdAt,
            updated_at: updatedAt
        )
    }

    /// Update from DTO
    func updateFrom(dto: TagDTO) {
        name = dto.name
        color = dto.color
        updatedAt = dto.updated_at
        needsSync = false
    }
}
