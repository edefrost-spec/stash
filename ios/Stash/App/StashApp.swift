import SwiftUI
import SwiftData

@main
struct StashApp: App {
    // SwiftData model container for offline storage
    let modelContainer: ModelContainer

    init() {
        do {
            // Configure SwiftData with our models
            modelContainer = try ModelContainer(
                for: Save.self, Folder.self, Tag.self,
                configurations: ModelConfiguration(
                    groupContainer: .identifier(Config.appGroupIdentifier)
                )
            )
        } catch {
            fatalError("Failed to initialize model container: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .modelContainer(modelContainer)
        }
    }
}

struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            SavesListView()
                .tabItem {
                    Label("Saves", systemImage: "bookmark.fill")
                }
                .tag(0)

            SearchView()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }
                .tag(1)

            FoldersView()
                .tabItem {
                    Label("Folders", systemImage: "folder.fill")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(3)
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [Save.self, Folder.self, Tag.self])
}
