import AppKit
import WebKit

// Executed by Build-on-Mac.command, on the actual macOS WebKit runtime.
// No public website is contacted by these checks.
final class LocalLoadProbe: NSObject, WKNavigationDelegate {
    var finished = false
    var failure: String?
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("typeof QuantCore === 'object' && typeof QuantCore.QuantAnything === 'function' && !!document.getElementById('chatForm')") { [weak self] value, error in
            self?.failure = (error != nil || value as? Bool != true) ? "The protected local room did not load its scripts and UI." : nil
            self?.finished = true
        }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failure = error.localizedDescription; finished = true }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failure = error.localizedDescription; finished = true }
}

func runNativeChecks() throws {
    guard let resources = Bundle.main.resourceURL else { throw GuardFailure(message: "Missing native resources.") }
    let policy = try SecurityPolicy(resources: resources); try policy.selfTest()
    var completed = false, rule: WKContentRuleList?, compileError: Error?
    WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "QuantStrictWeb-v1", encodedContentRuleList: policy.rules) { r, e in rule = r; compileError = e; completed = true }
    let timeout = Date().addingTimeInterval(20)
    while !completed && Date() < timeout { RunLoop.current.run(until: Date().addingTimeInterval(0.02)) }
    guard completed, compileError == nil, rule != nil else { throw GuardFailure(message: "Native content-blocker compilation failed.") }
    let web = WKWebViewConfiguration(); web.websiteDataStore = .nonPersistent(); web.defaultWebpagePreferences.allowsContentJavaScript = false; web.defaultWebpagePreferences.isLockdownModeEnabled = true
    guard !web.websiteDataStore.isPersistent, !web.defaultWebpagePreferences.allowsContentJavaScript, web.defaultWebpagePreferences.isLockdownModeEnabled else { throw GuardFailure(message: "The native protection settings were not retained.") }
    var localCompleted = false, localRule: WKContentRuleList?, localError: Error?
    WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "QuantLocalOnly-v1", encodedContentRuleList: SecurityPolicy.localRules) { r, e in localRule = r; localError = e; localCompleted = true }
    let localTimeout = Date().addingTimeInterval(20)
    while !localCompleted && Date() < localTimeout { RunLoop.current.run(until: Date().addingTimeInterval(0.02)) }
    guard localCompleted, localError == nil, let localRule else { throw GuardFailure(message: "Native local network-guard compilation failed.") }
    let local = WKWebViewConfiguration(); local.websiteDataStore = .nonPersistent()
    local.defaultWebpagePreferences.allowsContentJavaScript = true
    local.userContentController.add(localRule)
    let probe = LocalLoadProbe(), view = WKWebView(frame: NSRect(x: 0, y: 0, width: 1000, height: 750), configuration: local)
    view.navigationDelegate = probe
    view.loadFileURL(resources.appendingPathComponent("Room/Quant.html"), allowingReadAccessTo: resources.appendingPathComponent("Room", isDirectory: true))
    let roomTimeout = Date().addingTimeInterval(20)
    while !probe.finished && Date() < roomTimeout { RunLoop.current.run(until: Date().addingTimeInterval(0.02)) }
    view.stopLoading(); view.navigationDelegate = nil
    guard probe.finished, probe.failure == nil else { throw GuardFailure(message: probe.failure ?? "Native room loading timed out.") }
    print("Native checks passed: integrity, policy fixtures, WebKit content-rule compilation, privacy preferences and protected room script loading.")
}
