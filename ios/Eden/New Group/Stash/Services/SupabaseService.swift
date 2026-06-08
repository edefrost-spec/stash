import Foundation
import Combine
import Supabase
import SwiftData

/// Service layer for Supabase operations
@MainActor
class SupabaseService: ObservableObject {
    static let shared = SupabaseService()

    private let client: SupabaseClient
    private let storageBucket = "uploads"

    @Published var isOnline = true
    @Published var lastSyncDate: Date?

    private init() {
        self.client = SupabaseClient(
            supabaseURL: URL(string: Config.supabaseURL)!,
            supabaseKey: Config.supabaseAnonKey
        )
    }

    // MARK: - Storage

    func uploadImageToStorage(data: Data, fileName: String, contentType: String) async throws -> String {
        let encodedPath = encodeStoragePath("\(Config.userId)/\(fileName)")
        let uploadURL = URL(string: "\(Config.supabaseURL)/storage/v1/object/\(storageBucket)/\(encodedPath)")!

        var request = URLRequest(url: uploadURL)
        request.httpMethod = "POST"
        request.httpBody = data
        request.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(Config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("false", forHTTPHeaderField: "x-upsert")

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "SupabaseStorage", code: 1, userInfo: [NSLocalizedDescriptionKey: "Image upload failed"])
        }

        return "\(Config.supabaseURL)/storage/v1/object/public/\(storageBucket)/\(encodedPath)"
    }

    func uploadAudioToStorage(data: Data, path: String, contentType: String) async throws {
        let audioBucket = "audio"
        let encodedPath = encodeStoragePath(path)
        let uploadURL = URL(string: "\(Config.supabaseURL)/storage/v1/object/\(audioBucket)/\(encodedPath)")!

        var request = URLRequest(url: uploadURL)
        request.httpMethod = "POST"
        request.httpBody = data
        request.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(Config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("false", forHTTPHeaderField: "x-upsert")

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw NSError(domain: "SupabaseStorage", code: 3, userInfo: [NSLocalizedDescriptionKey: "Audio upload failed"])
        }
    }

    private func encodeStoragePath(_ path: String) -> String {
        path
            .split(separator: "/")
            .map { $0.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? String($0) }
            .joined(separator: "/")
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
        let params: [String: String] = [
            "search_query": query,
            "user_uuid": Config.userId
        ]

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
    let source: String?
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

    enum CodingKeys: String, CodingKey {
        case id
        case user_id
        case url
        case title
        case excerpt
        case content
        case highlight
        case notes
        case site_name
        case author
        case published_at
        case image_url
        case source
        case is_archived
        case is_favorite
        case is_pinned
        case read_at
        case audio_url
        case note_color
        case note_gradient
        case is_product
        case product_price
        case product_currency
        case product_availability
        case folder_id
        case created_at
        case updated_at
    }

    init(
        id: String,
        user_id: String,
        url: String?,
        title: String?,
        excerpt: String?,
        content: String?,
        highlight: String?,
        notes: String?,
        site_name: String?,
        author: String?,
        published_at: Date?,
        image_url: String?,
        source: String? = nil,
        is_archived: Bool,
        is_favorite: Bool,
        is_pinned: Bool,
        read_at: Date?,
        audio_url: String?,
        note_color: String?,
        note_gradient: String?,
        is_product: Bool,
        product_price: Double?,
        product_currency: String?,
        product_availability: String?,
        folder_id: String?,
        created_at: Date,
        updated_at: Date
    ) {
        self.id = id
        self.user_id = user_id
        self.url = url
        self.title = title
        self.excerpt = excerpt
        self.content = content
        self.highlight = highlight
        self.notes = notes
        self.site_name = site_name
        self.author = author
        self.published_at = published_at
        self.image_url = image_url
        self.source = source
        self.is_archived = is_archived
        self.is_favorite = is_favorite
        self.is_pinned = is_pinned
        self.read_at = read_at
        self.audio_url = audio_url
        self.note_color = note_color
        self.note_gradient = note_gradient
        self.is_product = is_product
        self.product_price = product_price
        self.product_currency = product_currency
        self.product_availability = product_availability
        self.folder_id = folder_id
        self.created_at = created_at
        self.updated_at = updated_at
    }

    init(from decoder: Decoder) throws {
        // Try tolerant decode first (handles product_price as string/number)
        if let decoded = try? SaveDTO.decodeLossy(from: decoder) {
            self = decoded
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        user_id = try container.decode(String.self, forKey: .user_id)
        url = try container.decodeIfPresent(String.self, forKey: .url)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        excerpt = try container.decodeIfPresent(String.self, forKey: .excerpt)
        content = try container.decodeIfPresent(String.self, forKey: .content)
        highlight = try container.decodeIfPresent(String.self, forKey: .highlight)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        site_name = try container.decodeIfPresent(String.self, forKey: .site_name)
        author = try container.decodeIfPresent(String.self, forKey: .author)
        published_at = try container.decodeIfPresent(Date.self, forKey: .published_at)
        image_url = try container.decodeIfPresent(String.self, forKey: .image_url)
        source = try container.decodeIfPresent(String.self, forKey: .source)
        is_archived = try container.decode(Bool.self, forKey: .is_archived)
        is_favorite = try container.decode(Bool.self, forKey: .is_favorite)
        is_pinned = try container.decode(Bool.self, forKey: .is_pinned)
        read_at = try container.decodeIfPresent(Date.self, forKey: .read_at)
        audio_url = try container.decodeIfPresent(String.self, forKey: .audio_url)
        note_color = try container.decodeIfPresent(String.self, forKey: .note_color)
        note_gradient = try container.decodeIfPresent(String.self, forKey: .note_gradient)
        is_product = try container.decode(Bool.self, forKey: .is_product)

        product_price = Self.decodeDoubleLossy(from: container, forKey: .product_price)

        product_currency = try container.decodeIfPresent(String.self, forKey: .product_currency)
        product_availability = try container.decodeIfPresent(String.self, forKey: .product_availability)
        folder_id = try container.decodeIfPresent(String.self, forKey: .folder_id)
        created_at = try container.decode(Date.self, forKey: .created_at)
        updated_at = try container.decode(Date.self, forKey: .updated_at)
    }

    private static func decodeLossy(from decoder: Decoder) throws -> SaveDTO {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        let id = try container.decode(String.self, forKey: .id)
        let user_id = try container.decode(String.self, forKey: .user_id)
        let url = try container.decodeIfPresent(String.self, forKey: .url)
        let title = try container.decodeIfPresent(String.self, forKey: .title)
        let excerpt = try container.decodeIfPresent(String.self, forKey: .excerpt)
        let content = try container.decodeIfPresent(String.self, forKey: .content)
        let highlight = try container.decodeIfPresent(String.self, forKey: .highlight)
        let notes = try container.decodeIfPresent(String.self, forKey: .notes)
        let site_name = try container.decodeIfPresent(String.self, forKey: .site_name)
        let author = try container.decodeIfPresent(String.self, forKey: .author)
        let published_at = try container.decodeIfPresent(Date.self, forKey: .published_at)
        let image_url = try container.decodeIfPresent(String.self, forKey: .image_url)
        let source = try container.decodeIfPresent(String.self, forKey: .source)
        let is_archived = try container.decodeIfPresent(Bool.self, forKey: .is_archived) ?? false
        let is_favorite = try container.decodeIfPresent(Bool.self, forKey: .is_favorite) ?? false
        let is_pinned = try container.decodeIfPresent(Bool.self, forKey: .is_pinned) ?? false
        let read_at = try container.decodeIfPresent(Date.self, forKey: .read_at)
        let audio_url = try container.decodeIfPresent(String.self, forKey: .audio_url)
        let note_color = try container.decodeIfPresent(String.self, forKey: .note_color)
        let note_gradient = try container.decodeIfPresent(String.self, forKey: .note_gradient)
        let is_product = try container.decodeIfPresent(Bool.self, forKey: .is_product) ?? false

        let product_price = Self.decodeDoubleLossy(from: container, forKey: .product_price)

        let product_currency = try container.decodeIfPresent(String.self, forKey: .product_currency)
        let product_availability = try container.decodeIfPresent(String.self, forKey: .product_availability)
        let folder_id = try container.decodeIfPresent(String.self, forKey: .folder_id)
        let created_at = try container.decode(Date.self, forKey: .created_at)
        let updated_at = try container.decode(Date.self, forKey: .updated_at)

        return SaveDTO(
            id: id,
            user_id: user_id,
            url: url,
            title: title,
            excerpt: excerpt,
            content: content,
            highlight: highlight,
            notes: notes,
            site_name: site_name,
            author: author,
            published_at: published_at,
            image_url: image_url,
            source: source,
            is_archived: is_archived,
            is_favorite: is_favorite,
            is_pinned: is_pinned,
            read_at: read_at,
            audio_url: audio_url,
            note_color: note_color,
            note_gradient: note_gradient,
            is_product: is_product,
            product_price: product_price,
            product_currency: product_currency,
            product_availability: product_availability,
            folder_id: folder_id,
            created_at: created_at,
            updated_at: updated_at
        )
    }

    private static func decodeDoubleLossy(
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys
    ) -> Double? {
        do {
            if let numeric = try container.decodeIfPresent(Double.self, forKey: key) {
                return numeric
            }
        } catch {
            // Fall through to string decode
        }

        if let stringValue = try? container.decodeIfPresent(String.self, forKey: key) {
            return Double(stringValue)
        }

        return nil
    }

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
            source: source,
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
