import UIKit
import SwiftUI
import Social
import Combine
import UniformTypeIdentifiers
import WebKit

/// Share Extension for saving articles from Safari and other apps
class ShareViewController: UIViewController {
    private var sharedURLs: [URL] = []
    private var sharedTexts: [String] = []
    private var sharedImages: [UIImage] = []
    private var sharedImageURLs: [URL] = []
    private var sharedAudioFiles: [URL] = []
    private var webView: WKWebView?
    private var isLoading = true
    private var loadingState = ShareLoadingState()

    override func viewDidLoad() {
        super.viewDidLoad()

        // Set up hosting controller for SwiftUI view
        let shareView = ShareExtensionView(
            loadingState: loadingState,
            onSave: { [weak self] folder in
                self?.saveToStash(folder: folder)
            },
            onCancel: { [weak self] in
                self?.cancel()
            }
        )

        let hostingController = UIHostingController(rootView: shareView)
        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        hostingController.didMove(toParent: self)

        // Extract shared content
        extractSharedContent()
    }

    private func extractSharedContent() {
        Task { [weak self] in
            guard let self else { return }
            let payloads = await self.loadSharedItems()
            await MainActor.run {
                self.sharedURLs = payloads.urls
                self.sharedTexts = payloads.texts
                self.sharedImages = payloads.images
                self.sharedImageURLs = payloads.imageURLs
                self.sharedAudioFiles = payloads.audioFiles
                self.isLoading = false
                self.loadingState.isReady = true
            }
        }
    }

    private func saveToStash(folder: String?) {
        guard !sharedURLs.isEmpty || !sharedTexts.isEmpty || !sharedImages.isEmpty || !sharedImageURLs.isEmpty || !sharedAudioFiles.isEmpty else {
            showError("No content to save")
            return
        }

        // Show loading state
        let alert = UIAlertController(title: "Saving...", message: nil, preferredStyle: .alert)
        present(alert, animated: true)

        Task {
            do {
                let items = try await buildQueueItems(folderId: folder)
                try ShareQueueStore.enqueue(items)

                await MainActor.run {
                    alert.dismiss(animated: true) {
                        self.showSuccess()
                    }
                }
            } catch {
                await MainActor.run {
                    alert.dismiss(animated: true) {
                        self.showError(error.localizedDescription)
                    }
                }
            }
        }
    }

    private func buildQueueItems(folderId: String?) async throws -> [ShareQueueItem] {
        var queueItems: [ShareQueueItem] = []
        var remainingTexts = sharedTexts
        let urlFallbackText = (!sharedURLs.isEmpty && !remainingTexts.isEmpty) ? remainingTexts.removeFirst() : nil

        for (index, url) in sharedURLs.enumerated() {
            // Resolve short URLs (pin.it, t.co, etc.) to final destination
            let resolvedURL = await resolveRedirects(for: url)
            let extracted = await extractReadableContent(from: resolvedURL)

            // Check if this is an image-centric site (Pinterest, etc.)
            // These should be saved as image saves, not article/link saves
            let resolvedHost = resolvedURL.host?.lowercased() ?? ""
            let imageCentricHosts = ["pinterest.com", "www.pinterest.com", "pin.it"]
            let isImageSave = imageCentricHosts.contains(where: {
                resolvedHost == $0 || resolvedHost.hasSuffix(".\($0)")
            }) && extracted?.imageUrl != nil

            if isImageSave {
                queueItems.append(
                    ShareQueueItem(
                        id: UUID().uuidString,
                        userId: Config.userId,
                        url: nil,
                        title: extracted?.title ?? "Pinterest Image",
                        excerpt: extracted?.excerpt,
                        content: nil,
                        highlight: nil,
                        notes: nil,
                        siteName: extracted?.siteName ?? "Pinterest",
                        author: nil,
                        publishedAt: nil,
                        imageUrl: extracted?.imageUrl,
                        isArchived: false,
                        isFavorite: false,
                        isPinned: false,
                        readAt: nil,
                        audioUrl: nil,
                        noteColor: nil,
                        noteGradient: nil,
                        isProduct: false,
                        productPrice: nil,
                        productCurrency: nil,
                        productAvailability: nil,
                        folderId: folderId,
                        createdAt: Date(),
                        updatedAt: Date(),
                        source: "upload"
                    )
                )
            } else {
                let title = extracted?.title ?? resolvedURL.absoluteString
                let excerpt = extracted?.excerpt
                let content = extracted?.content
                let siteName = extracted?.siteName ?? resolvedURL.host
                let imageUrl = extracted?.imageUrl
                let highlight: String? = nil
                let derivedExcerpt = extracted?.excerpt ?? urlFallbackText

                queueItems.append(
                    ShareQueueItem(
                        id: UUID().uuidString,
                        userId: Config.userId,
                        url: resolvedURL.absoluteString,
                        title: title,
                        excerpt: derivedExcerpt,
                        content: content,
                        highlight: highlight,
                        notes: nil,
                        siteName: siteName,
                        author: nil,
                        publishedAt: nil,
                        imageUrl: imageUrl,
                        isArchived: false,
                        isFavorite: false,
                        isPinned: false,
                        readAt: nil,
                        audioUrl: nil,
                        noteColor: nil,
                        noteGradient: nil,
                        isProduct: false,
                        productPrice: nil,
                        productCurrency: nil,
                        productAvailability: nil,
                        folderId: folderId,
                        createdAt: Date(),
                        updatedAt: Date(),
                        source: "ios"
                    )
                )
            }
        }

        for text in remainingTexts {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            queueItems.append(
                ShareQueueItem(
                    id: UUID().uuidString,
                    userId: Config.userId,
                    url: nil,
                    title: "Shared Note",
                    excerpt: String(trimmed.prefix(180)),
                    content: trimmed,
                    highlight: nil,
                    notes: trimmed,
                    siteName: "Note",
                    author: nil,
                    publishedAt: nil,
                    imageUrl: nil,
                    isArchived: false,
                    isFavorite: false,
                    isPinned: false,
                    readAt: nil,
                    audioUrl: nil,
                    noteColor: nil,
                    noteGradient: nil,
                    isProduct: false,
                    productPrice: nil,
                    productCurrency: nil,
                    productAvailability: nil,
                    folderId: folderId,
                    createdAt: Date(),
                    updatedAt: Date(),
                    source: "manual"
                )
            )
        }

        for imageUrl in sharedImageURLs {
            queueItems.append(
                ShareQueueItem(
                    id: UUID().uuidString,
                    userId: Config.userId,
                    url: nil,
                    title: "Shared Image",
                    excerpt: nil,
                    content: nil,
                    highlight: nil,
                    notes: nil,
                    siteName: imageUrl.host,
                    author: nil,
                    publishedAt: nil,
                    imageUrl: imageUrl.absoluteString,
                    isArchived: false,
                    isFavorite: false,
                    isPinned: false,
                    readAt: nil,
                    audioUrl: nil,
                    noteColor: nil,
                    noteGradient: nil,
                    isProduct: false,
                    productPrice: nil,
                    productCurrency: nil,
                    productAvailability: nil,
                    folderId: folderId,
                    createdAt: Date(),
                    updatedAt: Date(),
                    source: "upload"
                )
            )
        }

        for image in sharedImages {
            let localImageURL = try ShareQueueStore.saveImage(image)
            queueItems.append(
                ShareQueueItem(
                    id: UUID().uuidString,
                    userId: Config.userId,
                    url: nil,
                    title: "Shared Image",
                    excerpt: nil,
                    content: nil,
                    highlight: nil,
                    notes: nil,
                    siteName: nil,
                    author: nil,
                    publishedAt: nil,
                    imageUrl: localImageURL.absoluteString,
                    isArchived: false,
                    isFavorite: false,
                    isPinned: false,
                    readAt: nil,
                    audioUrl: nil,
                    noteColor: nil,
                    noteGradient: nil,
                    isProduct: false,
                    productPrice: nil,
                    productCurrency: nil,
                    productAvailability: nil,
                    folderId: folderId,
                    createdAt: Date(),
                    updatedAt: Date(),
                    source: "upload"
                )
            )
        }

        for audioFile in sharedAudioFiles {
            let localAudioURL = try ShareQueueStore.saveAudioFile(audioFile)
            queueItems.append(
                ShareQueueItem(
                    id: UUID().uuidString,
                    userId: Config.userId,
                    url: nil,
                    title: "Voice Memo",
                    excerpt: nil,
                    content: nil,
                    highlight: nil,
                    notes: nil,
                    siteName: "Voice Memo",
                    author: nil,
                    publishedAt: nil,
                    imageUrl: nil,
                    isArchived: false,
                    isFavorite: false,
                    isPinned: false,
                    readAt: nil,
                    audioUrl: localAudioURL.absoluteString,
                    noteColor: nil,
                    noteGradient: nil,
                    isProduct: false,
                    productPrice: nil,
                    productCurrency: nil,
                    productAvailability: nil,
                    folderId: folderId,
                    createdAt: Date(),
                    updatedAt: Date(),
                    source: "upload"
                )
            )
        }

        return queueItems
    }

    private func loadSharedItems() async -> (urls: [URL], texts: [String], images: [UIImage], imageURLs: [URL], audioFiles: [URL]) {
        var urls: [URL] = []
        var texts: [String] = []
        var images: [UIImage] = []
        var imageURLs: [URL] = []
        var audioFiles: [URL] = []

        guard let inputItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            return (urls, texts, images, imageURLs, audioFiles)
        }

        for item in inputItems {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                // Check for audio files first (voice memos from Voice Memos app)
                if provider.hasItemConformingToTypeIdentifier(UTType.audio.identifier) ||
                   provider.hasItemConformingToTypeIdentifier(UTType.mpeg4Audio.identifier) {
                    if let audioURL = await loadAudioFile(from: provider) {
                        audioFiles.append(audioURL)
                        continue // Don't process the same item as a URL or file
                    }
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    if let url = await loadURL(from: provider, type: .url) {
                        if isImageURL(url) {
                            imageURLs.append(url)
                        } else if isAudioURL(url) {
                            audioFiles.append(url)
                        } else {
                            urls.append(url)
                        }
                    }
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    if let text = await loadText(from: provider) {
                        texts.append(text)
                    }
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    if let image = await loadImage(from: provider) {
                        images.append(image)
                    }
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                    if let fileURL = await loadURL(from: provider, type: .fileURL) {
                        if isImageURL(fileURL), let image = UIImage(contentsOfFile: fileURL.path) {
                            images.append(image)
                        } else if isAudioURL(fileURL) {
                            audioFiles.append(fileURL)
                        } else {
                            urls.append(fileURL)
                        }
                    }
                }
            }
        }

        return (urls, texts, images, imageURLs, audioFiles)
    }

    private func loadURL(from provider: NSItemProvider, type: UTType) async -> URL? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { item, _ in
                if let url = item as? URL {
                    continuation.resume(returning: url)
                    return
                }
                if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                    continuation.resume(returning: url)
                    return
                }
                continuation.resume(returning: nil)
            }
        }
    }

    private func loadText(from provider: NSItemProvider) async -> String? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                if let text = item as? String {
                    continuation.resume(returning: text)
                    return
                }
                continuation.resume(returning: nil)
            }
        }
    }

    private func loadImage(from provider: NSItemProvider) async -> UIImage? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { item, _ in
                if let image = item as? UIImage {
                    continuation.resume(returning: image)
                    return
                }
                if let data = item as? Data, let image = UIImage(data: data) {
                    continuation.resume(returning: image)
                    return
                }
                // Photos app often provides images as file URLs
                if let url = item as? URL, let data = try? Data(contentsOf: url), let image = UIImage(data: data) {
                    continuation.resume(returning: image)
                    return
                }
                continuation.resume(returning: nil)
            }
        }
    }

    private func loadAudioFile(from provider: NSItemProvider) async -> URL? {
        // Try loading as m4a first (Voice Memos default format), then generic audio
        let audioTypes = [UTType.mpeg4Audio.identifier, UTType.audio.identifier]
        for typeId in audioTypes {
            if provider.hasItemConformingToTypeIdentifier(typeId) {
                let result: URL? = await withCheckedContinuation { continuation in
                    provider.loadItem(forTypeIdentifier: typeId, options: nil) { item, error in
                        if let url = item as? URL {
                            continuation.resume(returning: url)
                            return
                        }
                        if let data = item as? Data {
                            // Write data to a temp file
                            let tempDir = FileManager.default.temporaryDirectory
                            let tempFile = tempDir.appendingPathComponent("\(UUID().uuidString).m4a")
                            do {
                                try data.write(to: tempFile)
                                continuation.resume(returning: tempFile)
                            } catch {
                                continuation.resume(returning: nil)
                            }
                            return
                        }
                        continuation.resume(returning: nil)
                    }
                }
                if result != nil { return result }
            }
        }
        return nil
    }

    private func isAudioURL(_ url: URL) -> Bool {
        let ext = url.pathExtension.lowercased()
        let audioExtensions = ["m4a", "mp3", "wav", "aac", "ogg", "flac", "webm", "mp4", "caf"]
        if audioExtensions.contains(ext) { return true }
        if !ext.isEmpty, UTType(filenameExtension: ext)?.conforms(to: .audio) == true {
            return true
        }
        return false
    }

    private func isImageURL(_ url: URL) -> Bool {
        // Check file extension first
        let ext = url.pathExtension.lowercased()
        if !ext.isEmpty, UTType(filenameExtension: ext)?.conforms(to: .image) == true {
            return true
        }

        // Check known image CDN hosts (serve images without file extensions)
        let host = url.host?.lowercased() ?? ""
        let imageCDNHosts = [
            "i.pinimg.com",
            "pbs.twimg.com",
            "images.unsplash.com",
            "i.imgur.com",
            "i.redd.it",
            "preview.redd.it",
            "media.giphy.com"
        ]
        return imageCDNHosts.contains(where: { host == $0 || host.hasSuffix(".\($0)") })
    }

    /// Resolve short/redirect URLs (e.g. pin.it → pinterest.com) to their final destination
    private func resolveRedirects(for url: URL) async -> URL {
        await withCheckedContinuation { continuation in
            var request = URLRequest(url: url)
            request.httpMethod = "HEAD"
            let task = URLSession.shared.dataTask(with: request) { _, response, _ in
                if let httpResponse = response as? HTTPURLResponse,
                   let finalURL = httpResponse.url {
                    continuation.resume(returning: finalURL)
                } else {
                    continuation.resume(returning: url)
                }
            }
            task.resume()
        }
    }

    /// Fetch server-rendered HTML and extract Open Graph meta tags via string parsing.
    /// This works for SPAs like Pinterest that include og: tags in the initial HTML response
    /// but don't render them into the DOM quickly enough for WKWebView JS extraction.
    private func extractMetaFromHTML(url: URL) async -> ExtractedArticle? {
        do {
            var request = URLRequest(url: url)
            request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", forHTTPHeaderField: "User-Agent")
            let (data, _) = try await URLSession.shared.data(for: request)
            guard let html = String(data: data, encoding: .utf8) else { return nil }

            func extractMeta(_ property: String) -> String? {
                // Match both property="..." and name="..." attributes
                let patterns = [
                    "meta[^>]*property=\"\(property)\"[^>]*content=\"([^\"]*)\"",
                    "meta[^>]*content=\"([^\"]*)\"[^>]*property=\"\(property)\""
                ]
                for pattern in patterns {
                    if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
                       let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
                       let range = Range(match.range(at: 1), in: html) {
                        let value = String(html[range])
                        if !value.isEmpty { return value }
                    }
                }
                return nil
            }

            let title = extractMeta("og:title")
            let description = extractMeta("og:description")
            let siteName = extractMeta("og:site_name")
            let imageUrl = extractMeta("og:image")

            // Only return if we got something useful
            guard title != nil || imageUrl != nil else { return nil }

            return ExtractedArticle(
                title: title ?? url.host ?? "",
                excerpt: description,
                content: description,
                siteName: siteName,
                imageUrl: imageUrl
            )
        } catch {
            return nil
        }
    }

    private func extractReadableContent(from url: URL) async -> ExtractedArticle? {
        guard ["http", "https"].contains(url.scheme?.lowercased() ?? "") else {
            return nil
        }

        // For known SPA-heavy sites, use server-side HTML extraction instead of WKWebView
        let host = url.host?.lowercased() ?? ""
        let spaHosts = ["pinterest.com", "www.pinterest.com", "pin.it",
                         "instagram.com", "www.instagram.com",
                         "twitter.com", "x.com", "mobile.twitter.com"]
        if spaHosts.contains(where: { host == $0 || host.hasSuffix(".\($0)") }) {
            if let extracted = await extractMetaFromHTML(url: url) {
                return extracted
            }
        }

        await MainActor.run {
            let config = WKWebViewConfiguration()
            self.webView = WKWebView(frame: .zero, configuration: config)
            self.webView?.load(URLRequest(url: url))
        }

        try? await Task.sleep(nanoseconds: 2_000_000_000)

        let js = """
        (function() {
            let article = document.querySelector('article') ||
                         document.querySelector('[role="main"]') ||
                         document.querySelector('main');

            if (!article) {
                article = document.body;
            }

            let title = document.title || '';
            let excerpt = '';
            let content = (article.innerText || '').trim();

            // Extract meta description
            let metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                excerpt = metaDesc.getAttribute('content') || '';
            }

            // Fallback: use og:description if excerpt is empty
            if (!excerpt) {
                let ogDesc = document.querySelector('meta[property="og:description"]');
                if (ogDesc) {
                    excerpt = ogDesc.getAttribute('content') || '';
                }
            }

            // Fallback: use og:title if title is empty or generic
            if (!title || title.length < 3) {
                let ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle) {
                    title = ogTitle.getAttribute('content') || title;
                }
            }

            // If article content is very short (SPA not rendered), use excerpt as content
            if (content.length < 50 && excerpt.length > 0) {
                content = excerpt;
            }

            let siteName = '';
            let ogSiteName = document.querySelector('meta[property="og:site_name"]');
            if (ogSiteName) {
                siteName = ogSiteName.getAttribute('content') || '';
            }

            let imageUrl = '';
            let ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) {
                imageUrl = ogImage.getAttribute('content') || '';
            }
            // Fallback to twitter:image
            if (!imageUrl) {
                let twImage = document.querySelector('meta[name="twitter:image"]');
                if (twImage) {
                    imageUrl = twImage.getAttribute('content') || '';
                }
            }

            return {
                title: title,
                excerpt: excerpt.substring(0, 300),
                content: content.substring(0, 100000),
                siteName: siteName,
                imageUrl: imageUrl
            };
        })();
        """

        return await withCheckedContinuation { continuation in
            webView?.evaluateJavaScript(js) { result, _ in
                guard let dict = result as? [String: Any] else {
                    continuation.resume(returning: nil)
                    return
                }
                let article = ExtractedArticle(
                    title: dict["title"] as? String ?? "",
                    excerpt: dict["excerpt"] as? String,
                    content: dict["content"] as? String,
                    siteName: dict["siteName"] as? String,
                    imageUrl: dict["imageUrl"] as? String
                )
                continuation.resume(returning: article)
            }
        }
    }

    private func showSuccess() {
        let alert = UIAlertController(
            title: "Saved!",
            message: "Added to your Stash",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        })
        present(alert, animated: true)
    }

    private func showError(_ message: String) {
        let alert = UIAlertController(
            title: "Error",
            message: message,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    private func cancel() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}

private struct ExtractedArticle {
    let title: String
    let excerpt: String?
    let content: String?
    let siteName: String?
    let imageUrl: String?
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
    private static let imagesFolderName = "share-images"

    static func enqueue(_ items: [ShareQueueItem]) throws {
        var existing = loadQueue()
        existing.append(contentsOf: items)
        try saveQueue(existing)
    }

    static func saveImage(_ image: UIImage) throws -> URL {
        guard let containerURL = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: Config.appGroupIdentifier) else {
            throw NSError(domain: "ShareQueueStore", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing App Group container"])
        }

        let imagesFolder = containerURL.appendingPathComponent(imagesFolderName, isDirectory: true)
        try FileManager.default.createDirectory(at: imagesFolder, withIntermediateDirectories: true, attributes: nil)

        let filename = "\(UUID().uuidString).jpg"
        let fileURL = imagesFolder.appendingPathComponent(filename)

        guard let data = image.jpegData(compressionQuality: 0.9) else {
            throw NSError(domain: "ShareQueueStore", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to encode image"])
        }

        try data.write(to: fileURL, options: .atomic)
        return fileURL
    }

    static func saveAudioFile(_ sourceURL: URL) throws -> URL {
        guard let containerURL = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: Config.appGroupIdentifier) else {
            throw NSError(domain: "ShareQueueStore", code: 4, userInfo: [NSLocalizedDescriptionKey: "Missing App Group container"])
        }

        let audioFolder = containerURL.appendingPathComponent("share-audio", isDirectory: true)
        try FileManager.default.createDirectory(at: audioFolder, withIntermediateDirectories: true, attributes: nil)

        let ext = sourceURL.pathExtension.isEmpty ? "m4a" : sourceURL.pathExtension
        let filename = "\(UUID().uuidString).\(ext)"
        let destURL = audioFolder.appendingPathComponent(filename)

        try FileManager.default.copyItem(at: sourceURL, to: destURL)
        return destURL
    }

    private static func loadQueue() -> [ShareQueueItem] {
        guard let url = queueFileURL(), let data = try? Data(contentsOf: url) else {
            return []
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([ShareQueueItem].self, from: data)) ?? []
    }

    private static func saveQueue(_ items: [ShareQueueItem]) throws {
        guard let url = queueFileURL() else {
            throw NSError(domain: "ShareQueueStore", code: 3, userInfo: [NSLocalizedDescriptionKey: "Missing App Group container"])
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(items)
        try data.write(to: url, options: .atomic)
    }

    private static func queueFileURL() -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: Config.appGroupIdentifier)?
            .appendingPathComponent(queueFileName)
    }
}

// MARK: - SwiftUI View

class ShareLoadingState: ObservableObject {
    @Published var isReady = false
}

struct ShareExtensionView: View {
    @ObservedObject var loadingState: ShareLoadingState
    let onSave: (String?) -> Void
    let onCancel: () -> Void

    @State private var selectedFolder: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Image(systemName: "bookmark.fill")
                            .foregroundStyle(.blue)
                        Text("Save to Stash")
                            .font(.headline)
                    }
                }

                Section("Folder") {
                    Picker("Folder", selection: $selectedFolder) {
                        Text("None").tag(nil as String?)
                        // TODO: Load folders from shared container
                    }
                }

                Section {
                    Button {
                        onSave(selectedFolder)
                    } label: {
                        HStack {
                            Spacer()
                            if loadingState.isReady {
                                Text("Save")
                                    .bold()
                            } else {
                                ProgressView()
                                    .padding(.trailing, 8)
                                Text("Loading...")
                                    .bold()
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!loadingState.isReady)
                }
            }
            .navigationTitle("Save to Stash")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        onCancel()
                    }
                }
            }
        }
    }
}

#Preview {
    ShareExtensionView(loadingState: ShareLoadingState(), onSave: { _ in }, onCancel: {})
}
