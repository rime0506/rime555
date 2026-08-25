import Foundation
import ReplayKit
import WebKit
import UIKit

final class ScreenShareManager {
    private let recorder = RPScreenRecorder.shared()
    private var isCapturing = false
    private var lastFrameTime: TimeInterval = 0
    private var targetFPS: Double = 8
    var onFrame: ((String) -> Void)?

    func startCapture(fps: Double = 8) {
        guard !isCapturing else { return }
        targetFPS = max(5, min(10, fps))
        isCapturing = true
        lastFrameTime = 0

        recorder.startCapture { [weak self] sampleBuffer, bufferType, error in
            guard let self = self else { return }
            if let error = error {
                print("[ScreenShare] startCapture error: \(error.localizedDescription)")
                return
            }
            guard self.isCapturing, bufferType == .video else { return }
            self.handleVideoSample(sampleBuffer)
        } completionHandler: { error in
            if let error = error {
                print("[ScreenShare] completion error: \(error.localizedDescription)")
            }
        }
    }

    func stopCapture() {
        guard isCapturing else { return }
        isCapturing = false
        recorder.stopCapture { error in
            if let error = error {
                print("[ScreenShare] stopCapture error: \(error.localizedDescription)")
            }
        }
    }

    private func handleVideoSample(_ sampleBuffer: CMSampleBuffer) {
        let now = CACurrentMediaTime()
        guard now - lastFrameTime >= (1.0 / targetFPS) else { return }
        lastFrameTime = now

        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let ciImage = CIImage(cvPixelBuffer: imageBuffer)
        let context = CIContext(options: nil)
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else { return }
        let image = UIImage(cgImage: cgImage)
        guard let jpegData = image.jpegData(compressionQuality: 0.45) else { return }
        let base64 = jpegData.base64EncodedString()
        onFrame?(base64)
    }
}

final class ScreenShareBridge: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?
    private let manager = ScreenShareManager()

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
        manager.onFrame = { [weak self] base64 in
            self?.emitFrame(base64)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "screenShareBridge" else { return }
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "startCapture":
            let fps = body["fps"] as? Double ?? 8
            manager.startCapture(fps: fps)
        case "stopCapture":
            manager.stopCapture()
        default:
            break
        }
    }

    private func emitFrame(_ base64: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let webView = self.webView else { return }
            let escaped = base64
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
            let script = "window.onFrame('\(escaped)')"
            webView.evaluateJavaScript(script) { _, error in
                if let error = error {
                    print("[ScreenShareBridge] JS eval error: \(error.localizedDescription)")
                }
            }
        }
    }
}
