// VisionPlugin.swift
// Capacitor plugin: Vision analysis using Apple Vision framework.
//
// Add this file and VisionPlugin.m to the Xcode project (App/App target)
// and ensure both are included in the "Compile Sources" build phase.
//
// Runs VNClassifyImageRequest (confidence ≥ 0.3) and VNRecognizeTextRequest
// (accurate mode) on a background queue. Returns labels and recognised text
// to the web layer. Falls back to empty arrays on any error.

import Foundation
import Capacitor
import Vision
import UIKit

@objc(VisionPlugin)
public class VisionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VisionPlugin"
    public let jsName     = "Vision"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "analyze", returnType: CAPPluginReturnPromise),
    ]

    @objc func analyze(_ call: CAPPluginCall) {
        guard let base64 = call.getString("imageBase64"),
              let imageData = Data(base64Encoded: base64),
              let uiImage  = UIImage(data: imageData),
              let cgImage  = uiImage.cgImage else {
            call.resolve(["labels": [], "text": []])
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            var collectedLabels: [String] = []
            var collectedText:   [String] = []

            let group = DispatchGroup()

            // ── VNClassifyImageRequest ────────────────────────────────────────
            group.enter()
            let classifyRequest = VNClassifyImageRequest { request, _ in
                defer { group.leave() }
                guard let results = request.results as? [VNClassificationObservation] else { return }
                collectedLabels = results
                    .filter { $0.confidence >= 0.3 }
                    .map    { $0.identifier }
            }

            let classifyHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try? classifyHandler.perform([classifyRequest])

            // ── VNRecognizeTextRequest ────────────────────────────────────────
            group.enter()
            let textRequest = VNRecognizeTextRequest { request, _ in
                defer { group.leave() }
                guard let results = request.results as? [VNRecognizedTextObservation] else { return }
                collectedText = results.compactMap { $0.topCandidates(1).first?.string }
            }
            textRequest.recognitionLevel = .accurate

            let textHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try? textHandler.perform([textRequest])

            group.wait()

            call.resolve(["labels": collectedLabels, "text": collectedText])
        }
    }
}
