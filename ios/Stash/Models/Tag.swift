import Foundation
import SwiftData

/// Tag model for categorizing saves
@Model
final class Tag {
    @Attribute(.unique) var id: String
    var userId: String
    var name: String
    var color: String?  // Hex color code

    @Relationship(deleteRule: .nullify)
    var saves: [Save]

    var createdAt: Date
    var updatedAt: Date
    var needsSync: Bool

    init(
        id: String = UUID().uuidString,
        userId: String = Config.userId,
        name: String,
        color: String? = nil,
        saves: [Save] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        needsSync: Bool = true
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.color = color
        self.saves = saves
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.needsSync = needsSync
    }

    /// Number of saves with this tag
    var saveCount: Int {
        saves.count
    }
}
