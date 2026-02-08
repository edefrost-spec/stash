import Foundation
import Supabase
import SwiftData

/// Service layer for Supabase operations
@MainActor
class SupabaseService: ObservableObject {
    static let shared = SupabaseService()

    private let client: SupabaseClient

    @Published var isOnline = true
    @Published var lastSyncDate: Date?

    private init() {
        self.client = SupabaseClient(
            supabaseURL: URL(string: Config.supabaseURL)!,
            supabaseKey: Config.supabaseAnonKey
        )
    }

    // MARK: - Saves

    /// Fetch all saves from Supabase
    func fetchSaves() async throws -> [SaveDTO] {
        let response: [SaveDTO] = try await client
            .from("saves")
            .select()
            .eq("user_id", value: Config.userId)
            .order("created_at", ascending: false)
            .execute()
            .value

        return response
    }

    /// Create a new save on Supabase
    func createSave(_ save: SaveDTO) async throws -> SaveDTO {
        let response: SaveDTO = try await client
            .from("saves")
            .insert(save)
            .select()
            .single()
            .execute()
            .value

        return response
    }

    /// Update an existing save on Supabase
    func updateSave(_ save: SaveDTO) async throws {
        try await client
            .from("saves")
            .update(save)
            .eq("id", value: save.id)
            .execute()
    }

    /// Delete a save from Supabase
    func deleteSave(id: String) async throws {
        try await client
            .from("saves")
            .delete()
            .eq("id", value: id)
            .execute()
    }

    /// Search saves using full-text search
    func searchSaves(query: String) async throws -> [SaveDTO] {
        struct SearchParams: Encodable {
            let search_query: String
            let user_uuid: String
        }

        let params = SearchParams(search_query: query, user_uuid: Config.userId)

        let response: [SaveDTO] = try await client
            .rpc("search_saves", params: params)
            .execute()
            .value

        return response
    }

    // MARK: - Folders

    /// Fetch all folders from Supabase
    func fetchFolders() async throws -> [FolderDTO] {
        let response: [FolderDTO] = try await client
            .from("folders")
            .select()
            .eq("user_id", value: Config.userId)
            .order("name", ascending: true)
            .execute()
            .value

        return response
    }

    /// Create a new folder on Supabase
    func createFolder(_ folder: FolderDTO) async throws -> FolderDTO {
        let response: FolderDTO = try await client
            .from("folders")
            .insert(folder)
            .select()
            .single()
            .execute()
            .value

        return response
    }

    /// Update an existing folder on Supabase
    func updateFolder(_ folder: FolderDTO) async throws {
        try await client
            .from("folders")
            .update(folder)
            .eq("id", value: folder.id)
            .execute()
    }

    /// Delete a folder from Supabase
    func deleteFolder(id: String) async throws {
        try await client
            .from("folders")
            .delete()
            .eq("id", value: id)
            .execute()
    }

    // MARK: - Tags

    /// Fetch all tags from Supabase
    func fetchTags() async throws -> [TagDTO] {
        let response: [TagDTO] = try await client
            .from("tags")
            .select()
            .eq("user_id", value: Config.userId)
            .order("name", ascending: true)
            .execute()
            .value

        return response
    }

    /// Create a new tag on Supabase
    func createTag(_ tag: TagDTO) async throws -> TagDTO {
        let response: TagDTO = try await client
            .from("tags")
            .insert(tag)
            .select()
            .single()
            .execute()
            .value

        return response
    }

    // MARK: - Edge Functions

    /// Trigger server-side save with Readability extraction
    func savePageFromURL(url: String, highlight: String? = nil, source: String = "ios") async throws -> SaveDTO {
        struct SavePageRequest: Encodable {
            let url: String
            let user_id: String
            let highlight: String?
            let source: String
        }

        let request = SavePageRequest(
            url: url,
            user_id: Config.userId,
            highlight: highlight,
            source: source
        )

        let response: SaveDTO = try await client.functions
            .invoke("save-page", options: FunctionInvokeOptions(body: request))
            .value

        return response
    }

    /// Trigger auto-tagging for a save
    func autoTagSave(saveId: String) async throws {
        struct AutoTagRequest: Encodable {
            let save_id: String
            let user_id: String
        }

        let request = AutoTagRequest(save_id: saveId, user_id: Config.userId)

        _ = try await client.functions
            .invoke("auto-tag", options: FunctionInvokeOptions(body: request))
    }
}

// MARK: - Data Transfer Objects

/// DTO matching Supabase saves table schema
struct SaveDTO: Codable, Identifiable {
    let id: String
    let user_id: String
    let url: String?
    let title: String?
    let excerpt: String?
    let content: String?
    let highlight: String?
    let notes: String?
    let site_name: String?
    let author: String?
    let published_at: Date?
    let image_url: String?
    let is_archived: Bool
    let is_favorite: Bool
    let is_pinned: Bool
    let read_at: Date?
    let audio_url: String?
    let note_color: String?
    let note_gradient: String?
    let is_product: Bool
    let product_price: Double?
    let product_currency: String?
    let product_availability: String?
    let folder_id: String?
    let created_at: Date
    let updated_at: Date

    /// Convert to SwiftData Save model
    func toModel(context: ModelContext) -> Save {
        let save = Save(
            id: id,
            userId: user_id,
            url: url,
            title: title,
            excerpt: excerpt,
            content: content,
            highlight: highlight,
            notes: notes,
            siteName: site_name,
            author: author,
            publishedAt: published_at,
            imageUrl: image_url,
            isArchived: is_archived,
            isFavorite: is_favorite,
            isPinned: is_pinned,
            readAt: read_at,
            audioUrl: audio_url,
            noteColor: note_color,
            noteGradient: note_gradient,
            isProduct: is_product,
            productPrice: product_price,
            productCurrency: product_currency,
            productAvailability: product_availability,
            createdAt: created_at,
            updatedAt: updated_at,
            needsSync: false
        )

        // Lookup folder if folder_id exists
        if let folderId = folder_id {
            let descriptor = FetchDescriptor<Folder>(
                predicate: #Predicate { $0.id == folderId }
            )
            save.folder = try? context.fetch(descriptor).first
        }

        return save
    }
}

/// DTO matching Supabase folders table schema
struct FolderDTO: Codable, Identifiable {
    let id: String
    let user_id: String
    let name: String
    let color: String?
    let created_at: Date
    let updated_at: Date

    /// Convert to SwiftData Folder model
    func toModel() -> Folder {
        Folder(
            id: id,
            userId: user_id,
            name: name,
            color: color,
            createdAt: created_at,
            updatedAt: updated_at,
            needsSync: false
        )
    }
}

/// DTO matching Supabase tags table schema
struct TagDTO: Codable, Identifiable {
    let id: String
    let user_id: String
    let name: String
    let color: String?
    let created_at: Date
    let updated_at: Date

    /// Convert to SwiftData Tag model
    func toModel() -> Tag {
        Tag(
            id: id,
            userId: user_id,
            name: name,
            color: color,
            createdAt: created_at,
            updatedAt: updated_at,
            needsSync: false
        )
    }
}
