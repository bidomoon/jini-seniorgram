import SwiftUI

@main
struct SeniorgramApp: App {
    @StateObject private var library = CardLibrary()
    var body: some Scene {
        WindowGroup { SeniorgramRoot().environmentObject(library) }
    }
}

struct SeniorgramRoot: View {
    @AppStorage("seniorgram-large-text") private var largeText = false
    @Environment(\.dynamicTypeSize) private var systemText
    var body: some View {
        TabView {
            NativeHome(largeText: $largeText).tabItem { Label("만들기", systemImage: "square.and.pencil") }
            NativeGallery().tabItem { Label("내 작품", systemImage: "photo.on.rectangle") }
            NativeHelp().tabItem { Label("사용법", systemImage: "questionmark.circle") }
        }
        .tint(.sgGreen)
        .dynamicTypeSize(max(systemText, largeText ? .xxxLarge : .large))
    }
}
