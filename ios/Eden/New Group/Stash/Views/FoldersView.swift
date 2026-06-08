import SwiftUI
import SwiftData

struct FoldersView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Folder.name) private var folders: [Folder]

    @State private var showNewFolderSheet = false

    var body: some View {
        NavigationStack {
            List {
                if folders.isEmpty {
                    ContentUnavailableView(
                        "No Folders",
                        systemImage: "folder",
                        description: Text("Create folders to organize your saves")
                    )
                } else {
                    ForEach(folders) { folder in
                        NavigationLink(destination: FolderDetailView(folder: folder)) {
                            FolderRowView(folder: folder)
                        }
                    }
                    .onDelete(perform: deleteFolders)
                }
            }
            .navigationTitle("Folders")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNewFolderSheet = true
                    } label: {
                        Label("New Folder", systemImage: "folder.badge.plus")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    EditButton()
                }
            }
            .sheet(isPresented: $showNewFolderSheet) {
                NewFolderSheet()
            }
        }
    }

    private func deleteFolders(at offsets: IndexSet) {
        for index in offsets {
            let folder = folders[index]
            modelContext.delete(folder)
        }
        try? modelContext.save()
    }
}

struct FolderRowView: View {
    let folder: Folder

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(hex: folder.color ?? "#999999"))
                .frame(width: 32, height: 32)
                .overlay {
                    Image(systemName: "folder.fill")
                        .foregroundStyle(.white)
                        .font(.caption)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text(folder.name)
                    .font(.headline)

                Text("\(folder.saveCount) saves")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct FolderDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var folder: Folder

    @State private var isEditingName = false

    var body: some View {
        List {
            Section {
                if isEditingName {
                    TextField("Folder name", text: $folder.name)
                        .onSubmit {
                            saveChanges()
                            isEditingName = false
                        }
                } else {
                    HStack {
                        Text(folder.name)
                        Spacer()
                        Button("Edit") {
                            isEditingName = true
                        }
                        .font(.caption)
                    }
                }
            }

            Section("Saves") {
                if folder.saves.isEmpty {
                    Text("No saves in this folder")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(folder.saves) { save in
                        NavigationLink(destination: SaveDetailView(save: save)) {
                            SaveRowView(save: save)
                        }
                    }
                }
            }
        }
        .navigationTitle("Folder")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func saveChanges() {
        folder.updatedAt = Date()
        folder.needsSync = true
        try? modelContext.save()
    }
}

struct NewFolderSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var folderName = ""
    @State private var selectedColor = "#3B82F6"

    let availableColors = [
        "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
        "#6366F1", "#8B5CF6", "#EC4899", "#6B7280"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Folder name", text: $folderName)
                }

                Section("Color") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 12) {
                        ForEach(availableColors, id: \.self) { color in
                            Circle()
                                .fill(Color(hex: color))
                                .frame(width: 44, height: 44)
                                .overlay {
                                    if selectedColor == color {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.white)
                                            .bold()
                                    }
                                }
                                .onTapGesture {
                                    selectedColor = color
                                }
                        }
                    }
                }
            }
            .navigationTitle("New Folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        createFolder()
                    }
                    .disabled(folderName.isEmpty)
                }
            }
        }
    }

    private func createFolder() {
        let folder = Folder(name: folderName, color: selectedColor)
        modelContext.insert(folder)
        try? modelContext.save()
        dismiss()
    }
}

#Preview {
    FoldersView()
        .modelContainer(for: [Folder.self, Save.self])
}
