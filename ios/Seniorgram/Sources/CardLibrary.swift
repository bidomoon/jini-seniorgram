import Foundation
import Combine
import UIKit

@MainActor
final class CardLibrary: ObservableObject {
    @Published private(set) var cards: [SavedCard] = []
    @Published private(set) var loadError: String?
    private let root: URL
    private let fileManager: FileManager
    private let maximumCount: Int
    private let maximumBytes = 100 * 1024 * 1024
    private var indexURL: URL { root.appendingPathComponent("index.json") }

    init(root: URL? = nil, maximumCount: Int = 50, fileManager: FileManager = .default) {
        self.fileManager = fileManager
        self.maximumCount = maximumCount
        self.root = root ?? fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("SeniorgramCards", isDirectory: true)
        do {
            try fileManager.createDirectory(at: self.root, withIntermediateDirectories: true)
            if fileManager.fileExists(atPath: indexURL.path) {
                let decoded = try JSONDecoder().decode([SavedCard].self, from: Data(contentsOf: indexURL))
                guard Set(decoded.map(\.id)).count == decoded.count,
                      decoded.allSatisfy({ $0.byteCount > 0 && $0.byteCount <= 12 * 1024 * 1024 }) else {
                    throw LocalCardError.message("기존 보관함을 확인해야 해요.")
                }
                cards = decoded.sorted { $0.createdAt > $1.createdAt }
            }
        } catch {
            // Never replace an unreadable index with an empty one.
            loadError = "보관함을 읽지 못했어요. 기존 파일을 지우지 않았습니다. 앱을 다시 열거나 도움말을 확인해주세요."
        }
    }

    func fileURL(for card: SavedCard) -> URL { root.appendingPathComponent(card.filename) }

    func contains(_ id: UUID) -> Bool { cards.contains { $0.id == id } }

    @discardableResult
    func save(id: UUID, title: String, png: Data) throws -> SavedCard {
        guard loadError == nil else { throw LocalCardError.message(loadError!) }
        if let existing = cards.first(where: { $0.id == id }) { return existing }
        guard png.count <= 12 * 1024 * 1024,
              png.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]), UIImage(data: png) != nil else {
            throw LocalCardError.message("완성 이미지를 확인하지 못했어요. 다시 만들어주세요.")
        }
        guard cards.count < maximumCount, cards.reduce(0, { $0 + $1.byteCount }) + png.count <= maximumBytes else {
            throw LocalCardError.message("기기 보관함이 가득 찼어요. 중요한 작품을 사진 앱에 저장한 뒤 보관함을 정리해주세요.")
        }
        let item = SavedCard(id: id, title: String(title.prefix(60)), createdAt: Date(), byteCount: png.count)
        let url = fileURL(for: item)
        try png.write(to: url, options: [.atomic, .completeFileProtection])
        do {
            let updated = [item] + cards
            try JSONEncoder().encode(updated).write(to: indexURL, options: [.atomic, .completeFileProtection])
            cards = updated
        } catch {
            try? fileManager.removeItem(at: url)
            throw LocalCardError.message("작품을 보관하지 못했어요. 사진 앱 저장이나 공유를 이용해주세요.")
        }
        return item
    }

    func remove(_ item: SavedCard) throws {
        guard loadError == nil else { throw LocalCardError.message(loadError!) }
        guard cards.contains(where: { $0.id == item.id }) else { return }
        let original = fileURL(for: item)
        let staged = root.appendingPathComponent(item.id.uuidString + ".removing")
        let hadFile = fileManager.fileExists(atPath: original.path)
        if hadFile { try fileManager.moveItem(at: original, to: staged) }
        do {
            let updated = cards.filter { $0.id != item.id }
            try JSONEncoder().encode(updated).write(to: indexURL, options: [.atomic, .completeFileProtection])
            cards = updated
        } catch {
            if hadFile { try? fileManager.moveItem(at: staged, to: original) }
            throw LocalCardError.message("삭제를 마치지 못했어요. 보관함을 다시 확인해주세요.")
        }
        if hadFile { try? fileManager.removeItem(at: staged) }
    }
}
