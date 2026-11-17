import XCTest
import UIKit
@testable import Seniorgram

final class SeniorgramTests: XCTestCase {
    func testKoreanRequestSelectsBirthdayAndRecipient() throws {
        let draft = try CardRequestRouter.draft(for: "서준에게 생일 축하 카드 만들어줘")
        XCTAssertEqual(draft.occasion, .birthday)
        XCTAssertEqual(draft.recipient, "서준")
        XCTAssertEqual(try CardRequestRouter.draft(for: "엄마 생신 축하").occasion, .birthday)
        XCTAssertEqual(try CardRequestRouter.draft(for: "친구에게 감사 카드").occasion, .thanks)
        XCTAssertEqual(try CardRequestRouter.draft(for: "힘내 응원해").occasion, .support)
    }

    func testUnsupportedAndEmptyRequestsAreNotPretendedAIGeneration() {
        XCTAssertThrowsError(try CardRequestRouter.draft(for: "바다 영상을 생성해줘"))
        XCTAssertThrowsError(try CardRequestRouter.draft(for: " \n "))
    }

    func testTextLimitsKeepCompleteUnicodeCharacters() {
        var draft = CardDraft(occasion: .morning)
        draft.recipient = String(repeating: "가", count: 20)
        draft.sender = String(repeating: "👨‍👩‍👧‍👦", count: 20)
        draft.title = String(repeating: "축", count: 40)
        draft.message = String(repeating: "복", count: 120)
        draft.boundText()
        XCTAssertEqual(draft.recipient.count, 16)
        XCTAssertEqual(draft.sender.count, 16)
        XCTAssertEqual(draft.title.count, 30)
        XCTAssertEqual(draft.message.count, 100)
    }

    @MainActor
    func testExportIsReal1080PixelPNG() throws {
        let card = try NativeCardRenderer.render(CardDraft(occasion: .birthday), photo: nil)
        XCTAssertEqual(card.image.cgImage?.width, 1080)
        XCTAssertEqual(card.image.cgImage?.height, 1080)
        XCTAssertTrue(card.png.starts(with: [137,80,78,71,13,10,26,10]))
        XCTAssertNotNil(UIImage(data: card.png))
    }

    @MainActor
    func testLibrarySurvivesReloadAndIgnoresDuplicateSave() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let card = try NativeCardRenderer.render(CardDraft(occasion: .thanks), photo: nil)
        let library = CardLibrary(root: root)
        let item = try library.save(id: card.id, title: card.title, png: card.png)
        try library.save(id: card.id, title: "duplicate", png: card.png)
        XCTAssertEqual(library.cards.count, 1)
        let reopened = CardLibrary(root: root)
        XCTAssertEqual(reopened.cards, [item])
        XCTAssertEqual(try Data(contentsOf: reopened.fileURL(for: item)), card.png)
    }

    @MainActor
    func testQuotaAndInvalidImageDoNotOverwriteExistingCard() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let card = try NativeCardRenderer.render(CardDraft(occasion: .support), photo: nil)
        let library = CardLibrary(root: root, maximumCount: 1)
        let item = try library.save(id: card.id, title: card.title, png: card.png)
        XCTAssertThrowsError(try library.save(id: UUID(), title: "new", png: card.png))
        XCTAssertThrowsError(try library.save(id: UUID(), title: "bad", png: Data("invalid".utf8)))
        XCTAssertEqual(library.cards, [item])
        XCTAssertEqual(try Data(contentsOf: library.fileURL(for: item)), card.png)
    }

    @MainActor
    func testCorruptIndexBlocksWritesAndPreservesOriginalBytes() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let index = root.appendingPathComponent("index.json")
        let corrupt = Data("unfinished-index".utf8)
        try corrupt.write(to: index)
        let library = CardLibrary(root: root)
        XCTAssertNotNil(library.loadError)
        let card = try NativeCardRenderer.render(CardDraft(occasion: .morning), photo: nil)
        XCTAssertThrowsError(try library.save(id: card.id, title: card.title, png: card.png))
        XCTAssertEqual(try Data(contentsOf: index), corrupt)
    }

    @MainActor
    func testDeletingOneCardPreservesOtherCardAcrossReload() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let library = CardLibrary(root: root)
        let png = try NativeCardRenderer.render(CardDraft(occasion: .morning), photo: nil).png
        let first = try library.save(id: UUID(), title: "first", png: png)
        let second = try library.save(id: UUID(), title: "second", png: png)
        try library.remove(first)
        XCTAssertFalse(FileManager.default.fileExists(atPath: library.fileURL(for: first).path))
        XCTAssertEqual(try Data(contentsOf: library.fileURL(for: second)), png)
        XCTAssertEqual(CardLibrary(root: root).cards, [second])
    }
}
