import UIKit
import SwiftUI
import Social
import UniformTypeIdentifiers
import WebKit

/// Share Extension for saving articles from Safari and other apps
class ShareViewController: UIViewController {
    private var url: URL?
    private var selectedText: String?
    private var webView: WKWebView?

    override func viewDidLoad() {
        super.viewDidLoad()

        // Set up hosting controller for SwiftUI view
        let shareView = ShareExtensionView(
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
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let itemProvider = extensionItem.attachments?.first else {
            return
        }

        // Try to get URL
        if itemProvider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
                if let url = item as? URL {
                    self?.url = url
                    self?.extractArticle(from: url)
                } else if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                    self?.url = url
                    self?.extractArticle(from: url)
                }
            }
        }

        // Try to get plain text (for highlights)
        if itemProvider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (item, error) in
                if let text = item as? String {
                    self?.selectedText = text
                }
            }
        }
    }

    private func extractArticle(from url: URL) {
        // Create a WKWebView to load the page and extract article content
        let config = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: config)

        webView?.load(URLRequest(url: url))

        // Wait for page to load, then extract content
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            self?.extractReadableContent()
        }
    }

    private func extractReadableContent() {
        // JavaScript to extract article content using Safari Reader mode selectors
        let js = """
        (function() {
            // Try to get article element
            let article = document.querySelector('article') ||
                         document.querySelector('[role="main"]') ||
                         document.querySelector('main');

            if (!article) {
                article = document.body;
            }

            // Extract text content
            let title = document.title || '';
            let excerpt = '';
            let content = article.innerText || '';

            // Try to get meta description for excerpt
            let metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                excerpt = metaDesc.getAttribute('content') || '';
            }

            // Get site name
            let siteName = '';
            let ogSiteName = document.querySelector('meta[property="og:site_name"]');
            if (ogSiteName) {
                siteName = ogSiteName.getAttribute('content') || '';
            }

            // Get image
            let imageUrl = '';
            let ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) {
                imageUrl = ogImage.getAttribute('content') || '';
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

        webView?.evaluateJavaScript(js) { [weak self] (result, error) in
            if let dict = result as? [String: Any] {
                // Store extracted data to use when saving
                UserDefaults(suiteName: Config.appGroupIdentifier)?.set(dict, forKey: "pendingSave")
            }
        }
    }

    private func saveToStash(folder: String?) {
        guard let url = url else {
            showError("No URL to save")
            return
        }

        // Show loading state
        let alert = UIAlertController(title: "Saving...", message: nil, preferredStyle: .alert)
        present(alert, animated: true)

        Task {
            do {
                // Get extracted content if available
                let extractedData = UserDefaults(suiteName: Config.appGroupIdentifier)?
                    .dictionary(forKey: "pendingSave") as? [String: String]

                // Create save via Supabase service
                let saveDTO = SaveDTO(
                    id: UUID().uuidString,
                    user_id: Config.userId,
                    url: url.absoluteString,
                    title: extractedData?["title"] ?? url.absoluteString,
                    excerpt: extractedData?["excerpt"],
                    content: extractedData?["content"],
                    highlight: selectedText,
                    notes: nil,
                    site_name: extractedData?["siteName"] ?? url.host,
                    author: nil,
                    published_at: nil,
                    image_url: extractedData?["imageUrl"],
                    is_archived: false,
                    is_favorite: false,
                    is_pinned: false,
                    read_at: nil,
                    audio_url: nil,
                    note_color: nil,
                    note_gradient: nil,
                    is_product: false,
                    product_price: nil,
                    product_currency: nil,
                    product_availability: nil,
                    folder_id: nil, // TODO: Use selected folder
                    created_at: Date(),
                    updated_at: Date()
                )

                let supabase = SupabaseService.shared
                _ = try await supabase.createSave(saveDTO)

                // Trigger auto-tagging in background
                try? await supabase.autoTagSave(saveId: saveDTO.id)

                // Clean up
                UserDefaults(suiteName: Config.appGroupIdentifier)?.removeObject(forKey: "pendingSave")

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

// MARK: - SwiftUI View

struct ShareExtensionView: View {
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
                            Text("Save")
                                .bold()
                            Spacer()
                        }
                    }
                    .buttonStyle(.borderedProminent)
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
    ShareExtensionView(onSave: { _ in }, onCancel: {})
}
