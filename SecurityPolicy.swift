import Foundation
import JavaScriptCore
import CryptoKit

struct GuardFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

struct PolicyDecision {
    let allowed: Bool
    let reason: String
    let url: String?
}

final class SecurityPolicy {
    static let localRules = "[{\"trigger\":{\"url-filter\":\"^https?://\"},\"action\":{\"type\":\"block\"}},{\"trigger\":{\"url-filter\":\"^wss?://\"},\"action\":{\"type\":\"block\"}}]"
    private let context: JSContext
    private let policy: JSValue
    let root: URL
    let rules: String

    init(resources: URL) throws {
        root = resources.standardizedFileURL.resolvingSymlinksInPath()
        // Every executable resource and every local room asset is pinned in the native binary.
        for (path, expected) in SecurityManifest.files {
            let file = root.appendingPathComponent(path).standardizedFileURL.resolvingSymlinksInPath()
            guard file.path.hasPrefix(root.path + "/") else { throw GuardFailure(message: "A bundled resource escaped its directory.") }
            let bytes = try Data(contentsOf: file, options: .mappedIfSafe)
            let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
            guard digest == expected else { throw GuardFailure(message: "Bundled resource integrity failed: \(path). The app will not open web content.") }
        }
        guard let ctx = JSContext(),
              let source = String(data: try Data(contentsOf: root.appendingPathComponent("BrowserPolicy.js")), encoding: .utf8),
              let rulesText = String(data: try Data(contentsOf: root.appendingPathComponent("ContentRules.json")), encoding: .utf8) else {
            throw GuardFailure(message: "The browser protection resources could not be read.")
        }
        context = ctx
        ctx.evaluateScript(source)
        guard ctx.exception == nil, let value = ctx.evaluateScript("BrowserPolicy"), !value.isUndefined else {
            throw GuardFailure(message: "The browser policy did not initialise.")
        }
        policy = value
        ctx.evaluateScript(try String(contentsOf: root.appendingPathComponent("ReaderDocument.js"), encoding: .utf8))
        guard ctx.exception == nil else { throw GuardFailure(message: "The reader policy did not initialise.") }
        rules = rulesText
    }

    private func decide(_ method: String, _ argument: Any) -> PolicyDecision {
        context.exception = nil
        guard let fn = policy.forProperty(method), !fn.isUndefined,
              let result = fn.call(withArguments: [argument]), context.exception == nil,
              let data = result.toDictionary() else {
            return PolicyDecision(allowed: false, reason: "The browser policy failed closed.", url: nil)
        }
        return PolicyDecision(allowed: data["allowed"] as? Bool == true,
                              reason: data["reason"] as? String ?? "This request is blocked.",
                              url: data["url"] as? String)
    }
    func url(_ value: String) -> PolicyDecision { decide("inspectURL", value) }
    func navigation(_ info: [String: Any]) -> PolicyDecision { decide("navigation", info) }
    func response(_ info: [String: Any]) -> PolicyDecision { decide("response", info) }
    func readDocument(_ source: String, mime: String) -> [String: Any] {
        call("PageReader", "read", ["source": source, "mime": mime]) as? [String: Any] ?? ["text": "The document could not be read.", "links": []]
    }
    func scriptDocument(_ source: String, url: String) -> String? {
        call("PageReader", "scripted", ["source": source, "url": url, "nonce": UUID().uuidString]) as? String
    }
    func renderDocument(_ source: String, url: String) -> String? {
        call("PageReader", "design", ["source": source, "url": url]) as? String
    }
    func quantDocument(_ text: String, url: String, style: String, routes: [[String:String]], assetRoot: String) -> String? {
        call("PageReader", "quant", ["text": text, "url": url, "style": style, "routes": routes, "assetRoot": assetRoot]) as? String
    }
    private func call(_ object: String, _ method: String, _ value: Any) -> Any? {
        context.exception = nil
        guard ["PageReader"].contains(object), let target = context.evaluateScript(object),
              let fn = target.forProperty(method), let result = fn.call(withArguments: [value]), context.exception == nil else { return nil }
        return result.toObject()
    }
    func permitsLocalURL(_ url: URL) -> Bool {
        guard url.isFileURL, (url.host == nil || url.host == "" || url.host == "localhost") else { return false }
        let resolved = url.standardizedFileURL.resolvingSymlinksInPath()
        let localRoots = ["Room", "Studio"]
        return localRoots.contains { folder in
            let allowed = root.appendingPathComponent(folder, isDirectory: true).standardizedFileURL.resolvingSymlinksInPath().path + "/"
            return resolved.path.hasPrefix(allowed)
        }
    }
    func selfTest() throws {
        guard let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("PolicyCases.json"))) as? [[String: Any]] else {
            throw GuardFailure(message: "Missing policy test cases.")
        }
        for row in raw {
            guard let function = row["function"] as? String, let input = row["input"], let expected = row["allowed"] as? Bool else { throw GuardFailure(message: "Malformed policy test case.") }
            if decide(function, input).allowed != expected { throw GuardFailure(message: "Policy self-test failed: \(row["name"] ?? "unknown case").") }
        }
        guard let local = quantDocument("Safety check\n\n<script>must remain text</script>", url: "https://example.com/page?private=value", style: "field", routes: [["url":"https://example.com/next","label":"Continue"]], assetRoot: "quant-asset://local"),
              local.contains("QUANT / REBUILT VIEW"), local.contains("&lt;script&gt;must remain text&lt;/script&gt;"),
              !local.contains("<script>"), !local.contains("private=value"), local.contains("connect-src &#39;none&#39;"), local.contains("quant-asset://local/quant-art-04.png") else {
            throw GuardFailure(message: "The sealed local renderer self-test failed.")
        }
    }
}
