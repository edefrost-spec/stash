import Foundation
import Supabase

/// Minimal Supabase service for the Share Extension.
final class SupabaseService {
    static let shared = SupabaseService()

    private let client: SupabaseClient

    private init() {
        self.client = SupabaseClient(
            supabaseURL: URL(string: Config.supabaseURL)!,
            supabaseKey: Config.supabaseAnonKey
        )
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
}
