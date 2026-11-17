import Foundation

enum CardOccasion: String, CaseIterable, Codable, Identifiable {
    case morning, birthday, thanks, support
    var id: Self { self }
    var label: String {
        switch self {
        case .morning: return "안부 인사"
        case .birthday: return "생일 축하"
        case .thanks: return "감사 인사"
        case .support: return "따뜻한 응원"
        }
    }
    var symbol: String {
        switch self {
        case .morning: return "sun.max"
        case .birthday: return "gift"
        case .thanks: return "heart"
        case .support: return "sparkles"
        }
    }
    var title: String {
        switch self {
        case .morning: return "오늘도 좋은 하루"
        case .birthday: return "생일을 축하해요"
        case .thanks: return "마음을 담아 고마워요"
        case .support: return "당신을 응원해요"
        }
    }
    var message: String {
        switch self {
        case .morning: return "당신의 하루에\n작은 행복이 가득하기를."
        case .birthday: return "세상에 와줘서 고마워요.\n건강하고 행복한 날들이 가득하길 바라요."
        case .thanks: return "함께해줘서 고마워요.\n당신 덕분에 오늘도 따뜻합니다."
        case .support: return "천천히 가도 괜찮아요.\n늘 당신의 편에서 응원할게요."
        }
    }
}

enum CardTheme: String, CaseIterable, Codable, Identifiable {
    case flowers, mint, peach, sky
    var id: Self { self }
    var label: String {
        switch self {
        case .flowers: return "따뜻한 꽃"
        case .mint: return "편안한 초록"
        case .peach: return "다정한 분홍"
        case .sky: return "맑은 하늘"
        }
    }
}

struct CardDraft: Hashable {
    var occasion: CardOccasion
    var recipient = ""
    var sender = ""
    var title: String
    var message: String
    var theme: CardTheme = .flowers

    init(occasion: CardOccasion) {
        self.occasion = occasion
        self.title = occasion.title
        self.message = occasion.message
    }

    mutating func boundText() {
        recipient = String(recipient.prefix(16))
        sender = String(sender.prefix(16))
        title = String(title.prefix(30))
        message = String(message.prefix(100))
    }
}

enum CardRequestRouter {
    static func draft(for input: String) throws -> CardDraft {
        let text = String(input.trimmingCharacters(in: .whitespacesAndNewlines).prefix(800))
        guard !text.isEmpty else { throw LocalCardError.message("원하는 카드를 말하거나 적어주세요.") }
        let occasion: CardOccasion
        if text.contains("생일") || text.contains("생신") { occasion = .birthday }
        else if text.contains("감사") || text.contains("고마") { occasion = .thanks }
        else if text.contains("응원") || text.contains("힘내") { occasion = .support }
        else if text.contains("인사") || text.contains("아침") || text.contains("안부") { occasion = .morning }
        else { throw LocalCardError.message("안부·생일·감사·응원 중 어떤 카드를 만들까요? 아래에서 골라도 괜찮아요.") }
        var draft = CardDraft(occasion: occasion)
        if let range = text.range(of: #"[가-힣A-Za-z0-9]{1,16}(?=에게)"#, options: .regularExpression) {
            draft.recipient = String(text[range])
        }
        return draft
    }
}

struct SavedCard: Identifiable, Codable, Equatable {
    let id: UUID
    let title: String
    let createdAt: Date
    let byteCount: Int
    var filename: String { id.uuidString + ".png" }
}

enum LocalCardError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let text): return text }
    }
}
