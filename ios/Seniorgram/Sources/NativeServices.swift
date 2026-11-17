import AVFoundation
import Speech
import Photos
import PhotosUI
import ImageIO
import CoreTransferable
import UniformTypeIdentifiers
import SwiftUI
import Combine

struct ImportedPhoto: Transferable {
    let url: URL
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(importedContentType: .image) { received in
            let values = try received.file.resourceValues(forKeys: [.fileSizeKey])
            guard let size = values.fileSize, size > 0, size <= 25 * 1024 * 1024 else {
                throw LocalCardError.message("25MB 이하 사진을 골라주세요.")
            }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".image")
            try FileManager.default.copyItem(at: received.file, to: url)
            return ImportedPhoto(url: url)
        }
    }
    func downsample() throws -> UIImage {
        defer { try? FileManager.default.removeItem(at: url) }
        guard let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
              let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 1600
              ] as CFDictionary) else {
            throw LocalCardError.message("사진을 읽지 못했어요. 다른 사진을 골라주세요.")
        }
        return UIImage(cgImage: cgImage)
    }
}

@MainActor
final class NativeSpeech: ObservableObject {
    @Published private(set) var listening = false
    @Published private(set) var starting = false
    @Published private(set) var transcript = ""
    @Published private(set) var notice = "마이크를 누른 뒤 천천히 말씀해주세요. 글로 적어도 괜찮아요."
    private var engine: AVAudioEngine?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var timeout: Task<Void, Never>?
    private var epoch = UUID()

    func start() async {
        guard !starting else { return }
        if listening { stop(); return }
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR")),
              recognizer.supportsOnDeviceRecognition, recognizer.isAvailable else {
            notice = "이 기기에서는 한국어 기기 내 음성 인식을 사용할 수 없어요. 아래에 직접 적어주세요."
            return
        }
        starting = true
        let permissionRun = UUID(); epoch = permissionRun
        let authorization = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard epoch == permissionRun else { return }
        guard authorization == .authorized else {
            starting = false; notice = "음성 인식 권한이 필요해요. 설정에서 허용하거나 글로 적어주세요."; return
        }
        let microphoneAllowed = await AVAudioApplication.requestRecordPermission()
        guard epoch == permissionRun else { return }
        starting = false
        guard authorization == .authorized, microphoneAllowed else {
            notice = "마이크와 음성 인식 권한이 필요해요. iPhone 설정에서 허용하거나 글로 적어주세요."
            return
        }
        stop()
        let run = UUID(); epoch = run
        let audio = AVAudioEngine()
        let bufferRequest = SFSpeechAudioBufferRecognitionRequest()
        bufferRequest.requiresOnDeviceRecognition = true
        bufferRequest.shouldReportPartialResults = true
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true)
            let format = audio.inputNode.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                throw LocalCardError.message("마이크를 연결하지 못했어요. 글로 요청해주세요.")
            }
            audio.inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in bufferRequest.append(buffer) }
            engine = audio; request = bufferRequest
            transcript = ""; listening = true; notice = "듣고 있어요. 다 말했으면 듣기 멈추기를 눌러주세요."
            recognitionTask = recognizer.recognitionTask(with: bufferRequest) { [weak self] result, error in
                Task { @MainActor [weak self] in
                    guard let self, self.epoch == run else { return }
                    if let result { self.transcript = String(result.bestTranscription.formattedString.prefix(800)) }
                    if error != nil || result?.isFinal == true {
                        self.stop()
                        self.notice = self.transcript.isEmpty ? "말소리를 듣지 못했어요. 다시 말하거나 글로 적어주세요." : "들은 내용을 확인하고 계속해주세요."
                    }
                }
            }
            audio.prepare(); try audio.start()
            timeout = Task { [weak self] in
                do { try await Task.sleep(nanoseconds: 45_000_000_000) } catch { return }
                guard let self, self.epoch == run else { return }
                self.stop(); self.notice = "듣기를 멈췄어요. 적힌 내용을 확인하고 계속해주세요."
            }
        } catch {
            stop(); notice = "마이크를 시작하지 못했어요. 다른 앱의 녹음을 마치거나 글로 적어주세요."
        }
    }

    func stop() {
        epoch = UUID(); timeout?.cancel(); timeout = nil
        if let engine { engine.stop(); engine.inputNode.removeTap(onBus: 0) }
        engine = nil; request?.endAudio(); request = nil
        recognitionTask?.cancel(); recognitionTask = nil
        listening = false; starting = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

enum NativePhotoSave {
    static func save(_ image: UIImage) async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            throw LocalCardError.message("사진 추가가 허용되지 않았어요. iPhone 설정에서 허용하거나 공유 버튼을 이용해주세요.")
        }
        try await PHPhotoLibrary.shared().performChanges {
            PHAssetChangeRequest.creationRequestForAsset(from: image)
        }
    }
}

struct NativeShareSheet: UIViewControllerRepresentable {
    let url: URL
    let completion: (Bool, Error?) -> Void
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.completionWithItemsHandler = { _, completed, _, error in completion(completed, error) }
        return controller
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
