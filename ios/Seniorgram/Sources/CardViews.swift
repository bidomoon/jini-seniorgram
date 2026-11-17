import SwiftUI
import PhotosUI

extension Color {
    static let sgGreen = Color(red: 0.08, green: 0.34, blue: 0.28)
    static let sgCream = Color(red: 0.98, green: 0.98, blue: 0.95)
}

extension CardTheme {
    var colors: [Color] {
        switch self {
        case .flowers: return [.white, Color(red: 0.96, green: 0.94, blue: 0.82)]
        case .mint: return [Color(red: 0.91, green: 0.97, blue: 0.91), .white]
        case .peach: return [Color(red: 1, green: 0.91, blue: 0.88), .white]
        case .sky: return [Color(red: 0.87, green: 0.94, blue: 1), .white]
        }
    }
}

@MainActor
struct NativeHome: View {
    @Binding var largeText: Bool
    @State private var path: [CardDraft] = []
    @State private var voiceOpen = false
    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 18) {
                        Text("로그인 없이 바로 만들어요").font(.headline).foregroundStyle(Color.sgGreen)
                        Text("마음을 전하는 카드,\n내 손으로 만들어요.").font(.largeTitle.bold()).fixedSize(horizontal: false, vertical: true)
                        Text("친구에게 안부 인사, 손주에게 생일 축하. 이름만 넣어도 나만의 카드가 완성돼요.")
                        NavigationLink(value: CardDraft(occasion: .morning)) {
                            Text("인사 카드 바로 만들기").frame(maxWidth: .infinity, minHeight: 48)
                        }.buttonStyle(.borderedProminent).accessibilityIdentifier("start-card")
                        Button { voiceOpen = true } label: {
                            Label("말로 만들어볼게요", systemImage: "mic").frame(maxWidth: .infinity, minHeight: 48)
                        }.buttonStyle(.bordered).accessibilityIdentifier("start-voice")
                    }.padding(24).background(Color.sgGreen.opacity(0.07), in: RoundedRectangle(cornerRadius: 24))
                    Text("어떤 마음을 전할까요?").font(.title2.bold())
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 145))], spacing: 14) {
                        ForEach(CardOccasion.allCases) { occasion in
                            NavigationLink(value: CardDraft(occasion: occasion)) {
                                VStack(alignment: .leading, spacing: 12) {
                                    Image(systemName: occasion.symbol).font(.title2)
                                    Text(occasion.label).font(.headline).fixedSize(horizontal: false, vertical: true)
                                }.frame(maxWidth: .infinity, minHeight: 95, alignment: .leading).padding(18)
                                    .background(.white, in: RoundedRectangle(cornerRadius: 18))
                            }.buttonStyle(.plain).foregroundStyle(Color.sgGreen)
                        }
                    }
                    Text("완성한 작품은 내 작품에 보관하고, 사진 앱에 저장하거나 카카오톡·메시지로 나눌 수 있어요.")
                        .foregroundStyle(.secondary)
                }.padding(20)
            }
            .background(Color.sgCream).navigationTitle("시니어그램")
            .toolbar { Button(largeText ? "기본 글씨" : "큰 글씨") { largeText.toggle() }.accessibilityIdentifier("font-toggle") }
            .navigationDestination(for: CardDraft.self) { NativeCardEditor(initial: $0) }
            .sheet(isPresented: $voiceOpen) {
                VoiceDraftSheet { draft in voiceOpen = false; path.append(draft) }
            }
        }
    }
}

@MainActor
struct VoiceDraftSheet: View {
    let proceed: (CardDraft) -> Void
    @StateObject private var speech = NativeSpeech()
    @State private var text = ""
    @State private var error = ""
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scene
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("“서준에게 생일 축하 카드 만들어줘”처럼 말씀해보세요.")
                    Button { Task { await speech.start() } } label: {
                        Label(speech.listening ? "듣기 멈추기" : "말로 하기", systemImage: speech.listening ? "stop.circle" : "mic")
                            .frame(maxWidth: .infinity, minHeight: 50)
                    }.buttonStyle(.borderedProminent).disabled(speech.starting)
                    Text(speech.notice).accessibilityAddTraits(.updatesFrequently)
                }
                Section("내용을 확인하고 고쳐주세요") {
                    TextEditor(text: $text).frame(minHeight: 140).accessibilityIdentifier("voice-request")
                    Text("인식한 내용은 확인 버튼을 누르기 전에는 카드에 적용되지 않아요.")
                    Button("확인하고 카드 만들기") {
                        do { speech.stop(); let draft = try CardRequestRouter.draft(for: text); proceed(draft) }
                        catch { self.error = error.localizedDescription }
                    }.disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || speech.listening || speech.starting)
                        .accessibilityIdentifier("confirm-voice")
                    if !error.isEmpty { Text(error).foregroundStyle(.red) }
                }
                Section {
                    Text("한국어 기기 내 음성 인식을 지원하는 iPhone에서 사용할 수 있어요. 지원하지 않거나 권한을 허용하지 않아도 글로 입력할 수 있습니다.")
                }
            }.navigationTitle("말로 카드 만들기").tint(.sgGreen)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("닫기") { speech.stop(); dismiss() } } }
        }
        .onReceive(speech.$transcript) { if !($0.isEmpty) { text = $0 } }
        .onChange(of: text) { _, value in if value.count > 800 { text = String(value.prefix(800)) } }
        .onChange(of: scene) { _, value in if value != .active { speech.stop() } }
        .onDisappear { speech.stop() }
    }
}

@MainActor
struct CardArtwork: View {
    let draft: CardDraft
    let photo: UIImage?
    var body: some View {
        ZStack {
            LinearGradient(colors: draft.theme.colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            if draft.theme == .flowers { Image("Flowers").resizable().scaledToFill().frame(width: 1080, height: 1080).clipped() }
            VStack(spacing: 26) {
                Text(draft.recipient.isEmpty ? "소중한 당신께" : draft.recipient + " 님께").font(.system(size: 42, weight: .medium))
                Text(draft.title).font(.system(size: 76, weight: .bold)).lineLimit(2).minimumScaleFactor(0.65)
                if let photo {
                    Image(uiImage: photo).resizable().scaledToFill().frame(width: 430, height: 280)
                        .clipped().clipShape(RoundedRectangle(cornerRadius: 30))
                }
                Text(draft.message).font(.system(size: photo == nil ? 51 : 44)).lineSpacing(18).lineLimit(6).minimumScaleFactor(0.65)
                Text(draft.sender.isEmpty ? "마음을 담아" : draft.sender + " 드림").font(.system(size: 38, weight: .medium))
            }.multilineTextAlignment(.center).padding(.horizontal, 90).padding(.bottom, 100)
        }.foregroundStyle(Color.sgGreen).frame(width: 1080, height: 1080).clipped()
            .environment(\.dynamicTypeSize, .large)
    }
}

@MainActor
struct CardPreview: View {
    let draft: CardDraft
    let photo: UIImage?
    var body: some View {
        GeometryReader { geometry in
            CardArtwork(draft: draft, photo: photo).scaleEffect(geometry.size.width / 1080, anchor: .topLeading)
        }.aspectRatio(1, contentMode: .fit).clipShape(RoundedRectangle(cornerRadius: 18))
            .accessibilityElement(children: .ignore).accessibilityLabel("입력한 이름과 문구가 담긴 카드 미리보기")
    }
}

struct ExportedCard: Identifiable {
    let id: UUID
    let image: UIImage
    let png: Data
    let title: String
}

@MainActor
enum NativeCardRenderer {
    static func render(_ draft: CardDraft, photo: UIImage?) throws -> ExportedCard {
        let renderer = ImageRenderer(content: CardArtwork(draft: draft, photo: photo))
        renderer.scale = 1; renderer.isOpaque = true
        guard let image = renderer.uiImage, let png = image.pngData() else {
            throw LocalCardError.message("카드를 완성하지 못했어요. 잠시 후 다시 눌러주세요.")
        }
        return ExportedCard(id: UUID(), image: image, png: png, title: draft.title)
    }
}

@MainActor
struct NativeCardEditor: View {
    @State private var draft: CardDraft
    @State private var photo: UIImage?
    @State private var picker: PhotosPickerItem?
    @State private var photoGeneration = UUID()
    @State private var photoLoading = false
    @State private var output: ExportedCard?
    @State private var notice = ""
    init(initial: CardDraft) { _draft = State(initialValue: initial) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                CardPreview(draft: draft, photo: photo)
                Text("이름만 넣어도 좋아요. 문구는 미리 준비했어요.").foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 10) {
                    Text("누구에게 보내나요?").font(.headline)
                    TextField("예: 서준, 사랑하는 친구", text: $draft.recipient).textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("recipient-field")
                    Text("보내는 분").font(.headline)
                    TextField("예: 할머니, 영희", text: $draft.sender).textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("sender-field")
                }
                DisclosureGroup("문구 바꾸기") {
                    TextField("큰 제목", text: $draft.title).textFieldStyle(.roundedBorder)
                    TextEditor(text: $draft.message).frame(minHeight: 130).accessibilityLabel("전하고 싶은 말")
                    Text("제목 30자, 전하고 싶은 말 100자까지 넣을 수 있어요.").foregroundStyle(.secondary)
                }
                DisclosureGroup("사진 넣기 · 디자인 바꾸기") {
                    VStack(alignment: .leading, spacing: 16) {
                        PhotosPicker(selection: $picker, matching: .images) { Label("내 사진 고르기", systemImage: "photo") }
                            .buttonStyle(.bordered).disabled(photoLoading)
                        if photoLoading { ProgressView("사진을 준비하고 있어요") }
                        if photo != nil { Button("사진 빼기") { photoGeneration = UUID(); photo = nil; picker = nil } }
                        Picker("카드 분위기", selection: $draft.theme) {
                            ForEach(CardTheme.allCases) { Text($0.label).tag($0) }
                        }.pickerStyle(.menu)
                        Text("선택한 사진만 이 기기에서 편집해요. 사진 전체 목록에 접근하지 않습니다.").foregroundStyle(.secondary)
                    }.padding(.top, 12)
                }
                if !notice.isEmpty { Text(notice).foregroundStyle(.red) }
            }.padding(20)
        }
        .navigationTitle(draft.occasion.label).navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            Button {
                do { output = try NativeCardRenderer.render(draft, photo: photo) }
                catch { notice = error.localizedDescription }
            } label: { Text("이대로 카드 만들기").frame(maxWidth: .infinity, minHeight: 50) }
                .buttonStyle(.borderedProminent).disabled(photoLoading).padding(16).background(.regularMaterial)
                .accessibilityIdentifier("finish-card")
        }
        .onChange(of: draft) { _, value in var bounded = value; bounded.boundText(); if bounded != draft { draft = bounded } }
        .onChange(of: picker) { _, selection in
            let run = UUID(); photoGeneration = run
            guard let selection else { photoLoading = false; return }
            photoLoading = true
            Task {
                do {
                    guard let imported = try await selection.loadTransferable(type: ImportedPhoto.self) else {
                        throw LocalCardError.message("사진을 읽지 못했어요. 다른 사진을 골라주세요.")
                    }
                    let image = try imported.downsample()
                    guard photoGeneration == run else { return }
                    photo = image; notice = ""
                } catch { if photoGeneration == run { notice = error.localizedDescription } }
                if photoGeneration == run { photoLoading = false }
            }
        }
        .sheet(item: $output) { CardResultView(card: $0) }
        .onDisappear { photoGeneration = UUID(); photoLoading = false }
    }
}

@MainActor
struct CardResultView: View {
    let card: ExportedCard
    @EnvironmentObject private var library: CardLibrary
    @Environment(\.dismiss) private var dismiss
    @State private var message = ""
    @State private var working = false
    @State private var photoSaved = false
    @State private var showShare = false
    @State private var shareURL: URL?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Image(uiImage: card.image).resizable().scaledToFit().clipShape(RoundedRectangle(cornerRadius: 18))
                        .accessibilityLabel("완성 카드: " + card.title)
                    Text("이름과 문구가 맞는지 한 번 읽어보세요.")
                    Button(library.contains(card.id) ? "내 작품에 보관했어요" : "이 기기 내 작품에 보관") {
                        do { try library.save(id: card.id, title: card.title, png: card.png); message = "내 작품에 보관했어요. 앱을 다시 열어도 볼 수 있어요." }
                        catch { message = error.localizedDescription }
                    }.buttonStyle(.borderedProminent).disabled(library.contains(card.id) || working)
                        .accessibilityIdentifier("keep-card")
                    Button(photoSaved ? "사진 앱에 저장했어요" : "사진 앱에 저장하기") {
                        working = true
                        Task {
                            do { try await NativePhotoSave.save(card.image); photoSaved = true; message = "사진 앱에 저장했어요." }
                            catch { message = error.localizedDescription }
                            working = false
                        }
                    }.buttonStyle(.bordered).disabled(photoSaved || working)
                    Button("카카오톡 · 메시지로 공유") {
                        do {
                            let url = FileManager.default.temporaryDirectory.appendingPathComponent(card.id.uuidString + ".png")
                            try card.png.write(to: url, options: [.atomic, .completeFileProtection])
                            shareURL = url; showShare = true
                        } catch { message = "공유 파일을 준비하지 못했어요. 기기 저장 공간을 확인해주세요." }
                    }.buttonStyle(.bordered).disabled(working).accessibilityIdentifier("share-card")
                    if working { ProgressView("저장하고 있어요") }
                    if !message.isEmpty { Text(message).accessibilityIdentifier("result-status") }
                    Text("기기 보관함은 이 앱 안에 저장됩니다. 앱을 삭제하면 사라질 수 있으므로 중요한 작품은 사진 앱에도 저장해주세요.").foregroundStyle(.secondary)
                    Text("공유창에서 보낼 앱과 받을 사람을 직접 선택하고 전송 결과를 확인해주세요. 자동으로 발송하지 않습니다.").foregroundStyle(.secondary)
                }.padding(20).buttonStyle(.bordered).controlSize(.large)
            }.navigationTitle("카드가 완성됐어요").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("닫기") { dismiss() }.accessibilityIdentifier("close-result") } }
                .sheet(isPresented: $showShare) {
                    if let shareURL {
                        NativeShareSheet(url: shareURL) { completed, error in
                            Task { @MainActor in
                                message = error != nil ? "공유를 마치지 못했어요. 다시 시도해주세요." : completed ? "공유창 처리를 마쳤어요. 선택한 앱에서 실제 전송 결과를 확인해주세요." : "공유창을 닫았어요. 아직 전송됐다고 확인하지 않았습니다."
                            }
                        }
                    }
                }
        }.tint(.sgGreen).interactiveDismissDisabled(working)
    }
}

@MainActor
struct NativeGallery: View {
    @EnvironmentObject private var library: CardLibrary
    @State private var opened: ExportedCard?
    @State private var deleting: SavedCard?
    @State private var error = ""
    var body: some View {
        NavigationStack {
            List {
                if let message = library.loadError { Text(message).foregroundStyle(.red) }
                if library.cards.isEmpty { ContentUnavailableView("아직 보관한 작품이 없어요", systemImage: "photo", description: Text("카드를 완성하고 ‘이 기기 내 작품에 보관’을 눌러주세요.")) }
                ForEach(library.cards) { item in
                    HStack(spacing: 16) {
                        if let image = UIImage(contentsOfFile: library.fileURL(for: item).path) {
                            Image(uiImage: image).resizable().scaledToFill().frame(width: 72, height: 72).clipped().clipShape(RoundedRectangle(cornerRadius: 10)).accessibilityHidden(true)
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text(item.title).font(.headline)
                            Text(item.createdAt, style: .date).foregroundStyle(.secondary)
                            Button("열기 · 저장 · 공유") {
                                do {
                                    let data = try Data(contentsOf: library.fileURL(for: item))
                                    guard let image = UIImage(data: data) else { throw LocalCardError.message("작품 파일을 읽지 못했어요.") }
                                    opened = ExportedCard(id: item.id, image: image, png: data, title: item.title)
                                } catch { self.error = "이 작품을 열지 못했어요. 기존 파일을 삭제하지 않았습니다." }
                            }.accessibilityIdentifier("open-saved-card")
                        }
                    }.padding(.vertical, 8).swipeActions { Button("삭제", role: .destructive) { deleting = item } }
                }
                Section { Text("최대 50개·100MB를 기기에 보관할 수 있어요. 다른 기기와 자동으로 동기화되지 않습니다.") }
            }.navigationTitle("내 작품")
                .sheet(item: $opened) { CardResultView(card: $0) }
                .alert("이 작품을 기기 보관함에서 삭제할까요?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } })) {
                    Button("취소", role: .cancel) { deleting = nil }
                    Button("삭제", role: .destructive) {
                        if let item = deleting { do { try library.remove(item) } catch { self.error = error.localizedDescription } }
                        deleting = nil
                    }
                } message: { Text("사진 앱에 따로 저장한 파일은 남습니다. 보관함 삭제는 되돌릴 수 없어요.") }
                .alert("보관함 안내", isPresented: Binding(get: { !error.isEmpty }, set: { if !$0 { error = "" } })) { Button("확인") { error = "" } } message: { Text(error) }
        }
    }
}

@MainActor
struct NativeHelp: View {
    var body: some View {
        NavigationStack {
            List {
                Section("처음 만드는 카드") {
                    Text("1. 만들기에서 안부·생일·감사·응원 중 하나를 골라주세요.")
                    Text("2. 받는 이름과 보내는 분을 넣고, 원하면 사진과 문구를 바꿔주세요.")
                    Text("3. 카드 만들기를 누른 뒤 내 작품에 보관하거나 사진 앱에 저장하세요.")
                }
                Section("말로 시작하기") {
                    Text("만들기 화면에서 ‘말로 만들어볼게요’를 누르세요. 마이크를 누르고 ‘서준에게 생일 카드 만들어줘’처럼 말한 뒤 적힌 내용을 확인해주세요.")
                    Text("기기 내 한국어 음성 인식과 권한이 필요해요. 지원하지 않아도 글로 요청할 수 있습니다.")
                }
                Section("카카오톡으로 보내기") {
                    Text("완성 카드에서 공유를 누르고 카카오톡과 대화 상대를 선택하세요. 앱이 보이지 않으면 사진 앱에 저장한 뒤 카카오톡 대화방의 사진 첨부를 이용하세요.")
                }
                Section("개인정보와 보관") {
                    Text("이 iPhone 시험본은 회원가입·결제·광고 추적 없이 카드 제작과 기기 보관을 제공합니다. 선택한 사진과 문구를 운영 서버로 보내지 않습니다. 기기 내 음성 인식이 지원될 때만 마이크 입력을 시작합니다.")
                    Text("사진 앱에 저장할 때만 사진 추가 권한을 요청합니다. 기기 백업과 공유한 뒤의 처리는 iPhone 설정과 선택한 서비스의 정책을 따릅니다.")
                    Text("AI 생성·회원 계정·구독 기능은 이 시험본에 포함되지 않습니다. 지원되지 않는 기능을 구매할 수 없어요.")
                }
                Section("사용 중 도움이 필요하면") {
                    Link("시니어그램 지원 안내", destination: URL(string: "https://jini-seniorgram.netlify.app/ios-support.html")!)
                    Link("iPhone 앱 개인정보 안내", destination: URL(string: "https://jini-seniorgram.netlify.app/ios-privacy.html")!)
                }
            }.navigationTitle("사용법")
        }
    }
}
