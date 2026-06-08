import SwiftUI
import SwiftData

struct SearchView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var supabase = SupabaseService.shared

    @Query private var localSaves: [Save]

    @State private var searchText = ""
    @State private var searchResults: [Save] = []
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var useServerSearch = false

    var body: some View {
        NavigationStack {
            VStack {
                // Search mode toggle
                Picker("Search Mode", selection: $useServerSearch) {
                    Text("Local").tag(false)
                    Text("Server").tag(true)
                }
                .pickerStyle(.segmented)
                .padding()

                // Search results
                List {
                    if searchText.isEmpty {
                        ContentUnavailableView(
                            "Search Saves",
                            systemImage: "magnifyingglass",
                            description: Text("Enter a search term to find saves")
                        )
                    } else if isSearching {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    } else if let error = searchError {
                        ContentUnavailableView(
                            "Search Failed",
                            systemImage: "exclamationmark.triangle",
                            description: Text(error)
                        )
                    } else if searchResults.isEmpty {
                        ContentUnavailableView(
                            "No Results",
                            systemImage: "doc.text.magnifyingglass",
                            description: Text("Try different keywords")
                        )
                    } else {
                        ForEach(searchResults) { save in
                            NavigationLink(destination: SaveDetailView(save: save)) {
                                SaveRowView(save: save)
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
            .navigationTitle("Search")
            .searchable(text: $searchText, prompt: "Search title, content, highlights...")
            .onChange(of: searchText) {
                performSearch()
            }
            .onChange(of: useServerSearch) {
                performSearch()
            }
        }
    }

    private func performSearch() {
        guard !searchText.isEmpty else {
            searchResults = []
            return
        }

        if useServerSearch {
            performServerSearch()
        } else {
            performLocalSearch()
        }
    }

    private func performLocalSearch() {
        let query = searchText.lowercased()

        searchResults = localSaves.filter { save in
            save.displayTitle.lowercased().contains(query) ||
            (save.excerpt ?? "").lowercased().contains(query) ||
            (save.content ?? "").lowercased().contains(query) ||
            (save.highlight ?? "").lowercased().contains(query) ||
            (save.notes ?? "").lowercased().contains(query) ||
            save.tags.contains(where: { $0.name.lowercased().contains(query) })
        }
        .sorted { $0.createdAt > $1.createdAt }
    }

    private func performServerSearch() {
        isSearching = true
        searchError = nil

        Task {
            do {
                let dtos = try await supabase.searchSaves(query: searchText)

                // Convert DTOs to local models and find existing or create new
                searchResults = dtos.compactMap { dto in
                    let descriptor = FetchDescriptor<Save>(
                        predicate: #Predicate { $0.id == dto.id }
                    )

                    if let existing = try? modelContext.fetch(descriptor).first {
                        return existing
                    } else {
                        let newSave = dto.toModel(context: modelContext)
                        modelContext.insert(newSave)
                        return newSave
                    }
                }

                isSearching = false
            } catch {
                searchError = error.localizedDescription
                isSearching = false
            }
        }
    }
}

#Preview {
    SearchView()
        .modelContainer(for: [Save.self])
}
