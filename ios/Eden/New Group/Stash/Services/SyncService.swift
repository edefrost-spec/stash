import Foundation
import Combine
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
            try await uploadLocalImageIfNeeded(for: save)
            try await uploadLocalAudioIfNeeded(for: save)
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

    private func uploadLocalImageIfNeeded(for save: Save) async throws {
        guard let imageUrl = save.imageUrl, let url = URL(string: imageUrl), url.isFileURL else {
            return
        }

        let data = try Data(contentsOf: url)
        let fileName = "\(save.id)-\(Int(Date().timeIntervalSince1970)).jpg"
        let publicUrl = try await supabase.uploadImageToStorage(
            data: data,
            fileName: fileName,
            contentType: "image/jpeg"
        )

        save.imageUrl = publicUrl
        save.url = publicUrl
        save.updatedAt = Date()

        // Remove local file after upload to avoid buildup.
        try? FileManager.default.removeItem(at: url)
    }

    private func uploadLocalAudioIfNeeded(for save: Save) async throws {
        guard let audioUrl = save.audioUrl, let url = URL(string: audioUrl), url.isFileURL else {
            return
        }

        let data = try Data(contentsOf: url)
        let ext = url.pathExtension.isEmpty ? "m4a" : url.pathExtension
        let storagePath = "\(save.userId)/\(Int(Date().timeIntervalSince1970))-voice-memo.\(ext)"

        try await supabase.uploadAudioToStorage(
            data: data,
            path: storagePath,
            contentType: "audio/\(ext == "m4a" ? "mp4" : ext)"
        )

        save.audioUrl = storagePath
        save.updatedAt = Date()

        // Remove local file after upload
        try? FileManager.default.removeItem(at: url)

        // Trigger transcription (fire-and-forget)
        Task {
            await triggerTranscription(saveId: save.id, userId: save.userId, audioPath: storagePath)
        }
    }

    private func triggerTranscription(saveId: String, userId: String, audioPath: String) async {
        guard let url = URL(string: "\(Config.supabaseURL)/functions/v1/transcribe-audio") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(Config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")

        let body: [String: String] = [
            "save_id": saveId,
            "user_id": userId,
            "audio_path": audioPath
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
                print("Transcription request failed with status: \(httpResponse.statusCode)")
            }
        } catch {
            print("Transcription request error: \(error)")
        }
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
            source: source,
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
        source = dto.source
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

// MARK: - Share Extension Queue Import

@MainActor
final class ShareQueueImporter {
    static let shared = ShareQueueImporter()

    private init() {}

    func importPending(context: ModelContext) async {
        let items = ShareQueueStore.dequeueAll()
        guard !items.isEmpty else { return }

        for item in items {
            if saveExists(id: item.id, context: context) {
                continue
            }

            var folder: Folder?
            if let folderId = item.folderId {
                let descriptor = FetchDescriptor<Folder>(predicate: #Predicate { $0.id == folderId })
                folder = try? context.fetch(descriptor).first
            }

            let save = Save(
                id: item.id,
                userId: item.userId,
                url: item.url,
                title: item.title,
                excerpt: item.excerpt,
                content: item.content,
                highlight: item.highlight,
                notes: item.notes,
                siteName: item.siteName,
                author: item.author,
                publishedAt: item.publishedAt,
                imageUrl: item.imageUrl,
                source: item.source,
                isArchived: item.isArchived,
                isFavorite: item.isFavorite,
                isPinned: item.isPinned,
                readAt: item.readAt,
                audioUrl: item.audioUrl,
                noteColor: item.noteColor,
                noteGradient: item.noteGradient,
                isProduct: item.isProduct,
                productPrice: item.productPrice,
                productCurrency: item.productCurrency,
                productAvailability: item.productAvailability,
                folder: folder,
                tags: [],
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                needsSync: true
            )

            context.insert(save)
        }

        try? context.save()
    }

    private func saveExists(id: String, context: ModelContext) -> Bool {
        let descriptor = FetchDescriptor<Save>(predicate: #Predicate { $0.id == id })
        return (try? context.fetch(descriptor).isEmpty) == false
    }
}

private struct ShareQueueItem: Codable {
    let id: String
    let userId: String
    let url: String?
    let title: String?
    let excerpt: String?
    let content: String?
    let highlight: String?
    let notes: String?
    let siteName: String?
    let author: String?
    let publishedAt: Date?
    let imageUrl: String?
    let isArchived: Bool
    let isFavorite: Bool
    let isPinned: Bool
    let readAt: Date?
    let audioUrl: String?
    let noteColor: String?
    let noteGradient: String?
    let isProduct: Bool
    let productPrice: Double?
    let productCurrency: String?
    let productAvailability: String?
    let folderId: String?
    let createdAt: Date
    let updatedAt: Date
    let source: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case url
        case title
        case excerpt
        case content
        case highlight
        case notes
        case siteName = "site_name"
        case author
        case publishedAt = "published_at"
        case imageUrl = "image_url"
        case isArchived = "is_archived"
        case isFavorite = "is_favorite"
        case isPinned = "is_pinned"
        case readAt = "read_at"
        case audioUrl = "audio_url"
        case noteColor = "note_color"
        case noteGradient = "note_gradient"
        case isProduct = "is_product"
        case productPrice = "product_price"
        case productCurrency = "product_currency"
        case productAvailability = "product_availability"
        case folderId = "folder_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case source
    }
}

private enum ShareQueueStore {
    private static let queueFileName = "share-queue.json"

    static func dequeueAll() -> [ShareQueueItem] {
        let items = loadQueue()
        clearQueue()
        return items
    }

    private static func loadQueue() -> [ShareQueueItem] {
        guard let url = queueFileURL(), let data = try? Data(contentsOf: url) else {
            return []
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([ShareQueueItem].self, from: data)) ?? []
    }

    private static func clearQueue() {
        guard let url = queueFileURL() else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private static func queueFileURL() -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: Config.appGroupIdentifier)?
            .appendingPathComponent(queueFileName)
    }
}
