import XCTest

final class SeniorgramUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
        app.launch()
        return app
    }

    func testCreateKeepRelaunchAndReopenCard() throws {
        let app = launch()
        XCTAssertTrue(app.buttons["start-card"].waitForExistence(timeout: 10))
        attach(app, name: "01-Home")
        app.buttons["start-card"].tap()
        let recipient = app.textFields["recipient-field"]
        if !recipient.isHittable { app.swipeUp() }
        XCTAssertTrue(recipient.waitForExistence(timeout: 5))
        recipient.tap(); recipient.typeText("Seojun")
        let sender = app.textFields["sender-field"]
        sender.tap(); sender.typeText("Grandma")
        app.buttons["finish-card"].tap()
        XCTAssertTrue(app.buttons["keep-card"].waitForExistence(timeout: 10))
        attach(app, name: "02-Completed-card")
        app.buttons["keep-card"].tap()
        XCTAssertFalse(app.buttons["keep-card"].isEnabled)
        app.buttons["close-result"].tap()
        app.terminate(); app.launch()
        app.tabBars.buttons["내 작품"].tap()
        let saved = app.buttons["open-saved-card"].firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 8))
        saved.tap()
        XCTAssertTrue(app.buttons["close-result"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["keep-card"].isEnabled)
        attach(app, name: "03-Reopened-card")
    }

    func testVoiceSheetRequiresDeliberateInputAndCanClose() {
        let app = launch()
        app.buttons["start-voice"].tap()
        let confirm = app.buttons["confirm-voice"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        XCTAssertFalse(confirm.isEnabled)
        XCTAssertTrue(app.textViews["voice-request"].exists)
        XCTAssertFalse(app.alerts.firstMatch.exists, "Opening the sheet must not request microphone access")
        attach(app, name: "04-Voice-with-typed-alternative")
        app.buttons["닫기"].tap()
        XCTAssertTrue(app.buttons["start-card"].waitForExistence(timeout: 5))
    }

    private func attach(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways
        add(attachment)
    }
}
