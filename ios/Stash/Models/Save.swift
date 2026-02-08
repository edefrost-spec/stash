import Foundation
import SwiftData

/// Save model matching Supabase schema
@Model
final class Save {
    // MARK: - Identity
    @Attribute(.unique) var id: String
    var userId: String

    // MARK: - Content
    var url: String?
    var title: String?
    var excerpt: String?
    var content: String?  // Full article text
    var highlight: String?  // Saved highlight/selection
    var notes: String?  // User notes

    // MARK: - Metadata
    var siteName: String?
    var author: String?
    var publishedAt: Date?
    var imageUrl: String?

    // MARK: - Status
    var isArchived: Bool
    var isFavorite: Bool
    var isPinned: Bool
    var readAt: Date?

    // MARK: - Audio
    var audioUrl: String?

    // MARK: - Styling (for quick notes)
    var noteColor: String?
    var noteGradient: String?

    // MARK: - Product data
    var isProduct: Bool
    var productPrice: Double?
    var productCurrency: String?
    var productAvailability: String?

    // MARK: - Relationships
    var folder: Folder?
    @Relationship(deleteRule: .nullify, inverse: \Tag.saves)
    var tags: [Tag]

    // MARK: - Timestamps
    var createdAt: Date
    var updatedAt: Date

    // MARK: - Sync status
    var needsSync: Bool  // Local-only: needs to be synced to Supabase

    init(
        id: String = UUID().uuidString,
        userId: String = Config.userId,
        url: String? = nil,
        title: String? = nil,
        excerpt: String? = nil,
        content: String? = nil,
        highlight: String? = nil,
        notes: String? = nil,
        siteName: String? = nil,
        author: String? = nil,
        publishedAt: Date? = nil,
        imageUrl: String? = nil,
        isArchived: Bool = false,
        isFavorite: Bool = false,
        isPinned: Bool = false,
        readAt: Date? = nil,
        audioUrl: String? = nil,
        noteColor: String? = nil,
        noteGradient: String? = nil,
        isProduct: Bool = false,
        productPrice: Double? = nil,
        productCurrency: String? = nil,
        productAvailability: String? = nil,
        folder: Folder? = nil,
        tags: [Tag] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        needsSync: Bool = true
    ) {
        self.id = id
        self.userId = userId
        self.url = url
        self.title = title
        self.excerpt = excerpt
        self.content = content
        self.highlight = highlight
        self.notes = notes
        self.siteName = siteName
        self.author = author
        self.publishedAt = publishedAt
        self.imageUrl = imageUrl
        self.isArchived = isArchived
        self.isFavorite = isFavorite
        self.isPinned = isPinned
        self.readAt = readAt
        self.audioUrl = audioUrl
        self.noteColor = noteColor
        self.noteGradient = noteGradient
        self.isProduct = isProduct
        self.productPrice = productPrice
        self.productCurrency = productCurrency
        self.productAvailability = productAvailability
        self.folder = folder
        self.tags = tags
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.needsSync = needsSync
    }

    /// Display title - falls back to URL if no title
    var displayTitle: String {
        if let title = title, !title.isEmpty {
            return title
        }
        return url ?? "Untitled"
    }

    /// Display subtitle for list view
    var displaySubtitle: String? {
        if let siteName = siteName, !siteName.isEmpty {
            return siteName
        }
        if let url = url, let host = URL(string: url)?.host {
            return host
        }
        return nil
    }

    /// Check if save has readable content
    var hasContent: Bool {
        content != nil && !(content?.isEmpty ?? true)
    }

    /// Get save type for UI
    var saveType: SaveType {
        if isProduct {
            return .product
        }
        if let noteGradient = noteGradient, !noteGradient.isEmpty {
            return .note
        }
        if imageUrl != nil && content == nil {
            return .image
        }
        if let highlight = highlight, !highlight.isEmpty, content == nil {
            return .highlight
        }
        if hasContent {
            return .article
        }
        return .link
    }
}

// MARK: - Save Type Enum
enum SaveType {
    case article
    case highlight
    case note
    case product
    case image
    case link

    var icon: String {
        switch self {
        case .article: return "doc.text.fill"
        case .highlight: return "highlighter"
        case .note: return "note.text"
        case .product: return "cart.fill"
        case .image: return "photo.fill"
        case .link: return "link"
        }
    }

    var color: String {
        switch self {
        case .article: return "blue"
        case .highlight: return "yellow"
        case .note: return "purple"
        case .product: return "green"
        case .image: return "pink"
        case .link: return "gray"
        }
    }
}
