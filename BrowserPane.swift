import AppKit
import WebKit

private struct QuantRenderChoice {
    let style: String
    let interval: TimeInterval?
}

// Serves only the four integrity-pinned Quant images to the sealed renderer.
// The custom scheme is local to this WKWebViewConfiguration and never resolves through DNS.
private final class QuantAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    private let allowed = Set(["quant-art-04.png","quant-art-06.png","quant-art-07.png","quant-art-08.png"])
    init(root: URL) { self.root = root; super.init() }
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, url.scheme == "quant-asset", url.host == "local",
              let name = url.pathComponents.last, allowed.contains(name) else {
            urlSchemeTask.didFailWithError(GuardFailure(message:"An unapproved local artwork request was blocked.")); return
        }
        let file = root.appendingPathComponent(name).standardizedFileURL.resolvingSymlinksInPath()
        guard file.deletingLastPathComponent().path == root.path else { urlSchemeTask.didFailWithError(GuardFailure(message:"An artwork path escaped its directory.")); return }
        do {
            let data = try Data(contentsOf:file,options:.mappedIfSafe)
            let response = URLResponse(url:url,mimeType:"image/png",expectedContentLength:data.count,textEncodingName:nil)
            urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
        } catch { urlSchemeTask.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

// The native reader never interprets website HTML. Website design and sealed local Quant
// rendering are separate, explicit per-page choices.
final class BrowserPane: NSView, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private let policy: SecurityPolicy
    private let rules: WKContentRuleList
    private let localRules: WKContentRuleList
    private let assetHandler: QuantAssetSchemeHandler
    private let address = NSTextField()
    private let reader = NSTextView()
    private let bodyPanel = NSView()
    private let links = NSPopUpButton()
    private let status = NSTextField(labelWithString: "Read first. You choose the view and every send.")
    private let render = NSButton(title: "Render website…", target: nil, action: nil)
    private let quantRender = NSButton(title: "Quant render…", target: nil, action: nil)
    private let paperChoice = NSPopUpButton()
    private var browser: WKWebView?
    private var designBoot = false
    private var pageJavaScript = false
    private var rendererIsLocal = false
    private var quantStyle: String?
    private var quantUpdateInterval: TimeInterval?
    private var quantTimer: Timer?
    private var currentRoutes: [[String:String]] = []
    private var enabled = false
    private var current: ReadDocument?
    private var history: [ReadDocument] = []
    private var historyPosition = -1
    private var request: DocumentRequest?
    private var revision = 0
    private var readingSize = 17.0

    init(policy: SecurityPolicy, rules: WKContentRuleList, localRules: WKContentRuleList) {
        self.policy = policy; self.rules = rules; self.localRules = localRules
        self.assetHandler = QuantAssetSchemeHandler(root:policy.root.appendingPathComponent("Room/assets",isDirectory:true).standardizedFileURL.resolvingSymlinksInPath())
        super.init(frame: .zero)
        let stack = NSStackView(); stack.orientation = .vertical; stack.spacing = 9; stack.alignment = .leading
        let navigation = NSStackView(); navigation.orientation = .horizontal; navigation.spacing = 8
        for (title, action) in [("←", #selector(back)), ("→", #selector(forward))] { navigation.addArrangedSubview(NSButton(title: title, target: self, action: action)) }
        address.placeholderString = "HTTPS address"; address.target = self; address.action = #selector(go); address.setAccessibilityLabel("Website address")
        address.setContentHuggingPriority(.defaultLow, for: .horizontal); navigation.addArrangedSubview(address)
        navigation.addArrangedSubview(NSButton(title: "GET", target: self, action: #selector(go)))
        navigation.addArrangedSubview(NSButton(title: "Clear", target: self, action: #selector(clear)))
        let choices = NSStackView(); choices.orientation = .horizontal; choices.spacing = 8
        quantRender.target = self; quantRender.action = #selector(renderWithQuant); quantRender.isEnabled = false
        quantRender.font = NSFont(name: "Baskerville-SemiBold", size: 13) ?? .boldSystemFont(ofSize: 13)
        quantRender.bezelStyle = .rounded
        if let mark = NSImage(contentsOf: policy.root.appendingPathComponent("Room/assets/quant-art-04.png")) { mark.size = NSSize(width:18,height:18); quantRender.image = mark; quantRender.imagePosition = .imageLeading }
        quantRender.toolTip = "Arrange the extracted text in a sealed on-device Quant design"
        choices.addArrangedSubview(quantRender)
        render.target = self; render.action = #selector(renderDesign); render.isEnabled = false
        choices.addArrangedSubview(render)
        choices.addArrangedSubview(NSButton(title: "Text only", target: self, action: #selector(showText)))
        paperChoice.addItems(withTitles: ["Paper", "Warm", "Night"]); paperChoice.selectItem(withTitle: UserDefaults.standard.string(forKey: "readerTone") ?? "Paper")
        paperChoice.target = self; paperChoice.action = #selector(appearance); choices.addArrangedSubview(paperChoice)
        choices.addArrangedSubview(NSButton(title: "A−", target: self, action: #selector(smaller)))
        choices.addArrangedSubview(NSButton(title: "A+", target: self, action: #selector(larger)))
        links.target = self; links.action = #selector(openLink); links.addItem(withTitle: "Links appear here after reading")
        reader.isEditable = false; reader.isRichText = false; reader.isAutomaticLinkDetectionEnabled = false; reader.textContainerInset = NSSize(width: 25, height: 25)
        status.font = .systemFont(ofSize: 11); status.maximumNumberOfLines = 3; status.lineBreakMode = .byWordWrapping
        for row in [navigation, choices] { stack.addArrangedSubview(row); row.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true }
        stack.addArrangedSubview(links); links.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.addArrangedSubview(bodyPanel); bodyPanel.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.addArrangedSubview(status); status.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        stack.translatesAutoresizingMaskIntoConstraints = false; addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),stack.topAnchor.constraint(equalTo: topAnchor, constant: 8),stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8)])
        readingSize = min(28,max(12,UserDefaults.standard.double(forKey: "readerSize") == 0 ? 17 : UserDefaults.standard.double(forKey: "readerSize")))
        appearance(); showText()
    }
    required init?(coder: NSCoder) { fatalError("Use the programmatic app initializer.") }
    func setEnabled(_ value: Bool) { enabled = value; if !value { clear() } }
    func focusAddress() { window?.makeFirstResponder(address) }
    func refreshGET() { if rendererIsLocal { refreshQuantText() } else { go() } }
    private func install(_ view: NSView) {
        bodyPanel.subviews.forEach { $0.removeFromSuperview() }; view.translatesAutoresizingMaskIntoConstraints = false; bodyPanel.addSubview(view)
        NSLayoutConstraint.activate([view.leadingAnchor.constraint(equalTo: bodyPanel.leadingAnchor),view.trailingAnchor.constraint(equalTo: bodyPanel.trailingAnchor),view.topAnchor.constraint(equalTo: bodyPanel.topAnchor),view.bottomAnchor.constraint(equalTo: bodyPanel.bottomAnchor)])
    }
    private func discardDesign() {
        quantTimer?.invalidate(); quantTimer = nil; quantStyle = nil; quantUpdateInterval = nil
        if let browser { browser.stopLoading(); browser.navigationDelegate = nil; browser.uiDelegate = nil; browser.configuration.websiteDataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) {} }
        browser = nil; designBoot = false; rendererIsLocal = false; pageJavaScript = false
    }
    @objc private func appearance() {
        let tone = paperChoice.titleOfSelectedItem ?? "Paper"
        reader.backgroundColor = tone == "Night" ? NSColor(calibratedWhite: 0.13, alpha: 1) : (tone == "Warm" ? NSColor(calibratedRed: 0.94, green: 0.86, blue: 0.73, alpha: 1) : NSColor(calibratedRed: 0.97, green: 0.95, blue: 0.90, alpha: 1))
        reader.textColor = tone == "Night" ? NSColor(calibratedWhite: 0.9, alpha: 1) : NSColor(calibratedWhite: 0.15, alpha: 1)
        reader.font = NSFont(name: "Georgia", size: readingSize) ?? .systemFont(ofSize: readingSize)
        UserDefaults.standard.set(tone, forKey: "readerTone"); UserDefaults.standard.set(readingSize, forKey: "readerSize")
    }
    @objc private func smaller() { readingSize = max(12,readingSize-1); appearance() }
    @objc private func larger() { readingSize = min(28,readingSize+1); appearance() }
    @objc private func showText() { discardDesign(); let scroll = NSScrollView(); scroll.hasVerticalScroller = true; scroll.documentView = reader; reader.autoresizingMask = [.width]; reader.isVerticallyResizable = true; reader.isHorizontallyResizable = false; reader.textContainer?.widthTracksTextView = true; install(scroll) }
    @objc private func clear() {
        revision += 1; request?.cancel(); request = nil
        current = nil; currentRoutes.removeAll(); history.removeAll(); historyPosition = -1; reader.string = "Your reading starts here.\n\nChoose an HTTPS address. Quant’s room remains separate."; address.stringValue = ""
        render.isEnabled = false; quantRender.isEnabled = false; links.removeAllItems(); links.addItem(withTitle: "No page selected"); showText(); status.stringValue = "Visit cleared. No form data is kept in Quant."
    }
    @objc private func go() {
        guard enabled else { return }; var text = address.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.contains("://") { text = "https://" + text }; fetch(text)
    }
    private func fetch(_ value: String, resumeQuant: QuantRenderChoice? = nil, replaceCurrent: Bool = false) {
        let checked = policy.url(value)
        guard enabled, checked.allowed, let normal = checked.url, let url = URL(string: normal) else { status.stringValue = checked.reason; return }
        request?.cancel(); revision += 1; let expected = revision
        let preservingQuant = resumeQuant != nil && replaceCurrent && rendererIsLocal
        if preservingQuant { quantTimer?.invalidate(); quantTimer = nil }
        else { discardDesign(); showText(); render.isEnabled = false; quantRender.isEnabled = false; current = nil; currentRoutes.removeAll(); reader.string = "Reading…"; links.removeAllItems(); links.addItem(withTitle: "Reading a new document…") }
        let operation = DocumentRequest(); request = operation
        status.stringValue = preservingQuant ? "Updating this Quant view with a fresh cookie-free GET…" : "Reading with GET. Page design has not been rendered."
        address.stringValue = normal
        operation.start(url: url) { [weak self] result in
            guard let self, self.enabled, self.revision == expected else { return }; self.request = nil
            switch result {
            case .failure(let error):
                self.status.stringValue = preservingQuant ? "Update stopped; the existing inert view remains · " + error.localizedDescription : "Stopped · " + error.localizedDescription
                if preservingQuant { self.scheduleQuantRefresh() }
            case .success(let document):
                if replaceCurrent, self.history.indices.contains(self.historyPosition) { self.history[self.historyPosition] = document }
                else {
                    if self.historyPosition + 1 < self.history.count { self.history.removeSubrange((self.historyPosition+1)..<self.history.count) }
                    self.history.append(document); if self.history.count > 8 { self.history.removeFirst() }; self.historyPosition = self.history.count - 1
                }
                self.display(document)
                if let resumeQuant { self.showQuant(document,choice:resumeQuant) }
            }
        }
    }
    private func display(_ document: ReadDocument) {
        revision += 1; current = document; address.stringValue = document.url.absoluteString; showText()
        let parsed = policy.readDocument(document.source, mime: document.mime)
        reader.string = parsed["text"] as? String ?? ""; if reader.string.isEmpty { reader.string = "This response contains no readable text." }
        currentRoutes.removeAll(); links.removeAllItems(); links.addItem(withTitle: "Choose a link to read with GET…")
        var choices = parsed["links"] as? [String] ?? []
        if let redirect = document.redirect { choices.insert(redirect.absoluteString,at: 0); reader.string = "Redirect not followed. Choose its destination from the links below the address bar.\n\n" + reader.string }
        let labels = Dictionary(uniqueKeysWithValues:(parsed["routes"] as? [[String:Any]] ?? []).compactMap { row -> (String,String)? in
            guard let href=row["href"] as? String, let label=row["label"] as? String else { return nil }; return (href,label)
        })
        for href in choices {
            guard let url = URL(string: href, relativeTo: document.url)?.absoluteURL else { continue }
            let checked = policy.url(url.absoluteString); guard checked.allowed, let normal=checked.url else { continue }
            let label = labels[href]?.trimmingCharacters(in:.whitespacesAndNewlines) ?? (href == document.redirect?.absoluteString ? "Continue to redirect" : normal)
            if !currentRoutes.contains(where:{$0["url"] == normal}) { currentRoutes.append(["url":normal,"label":String(label.prefix(160))]) }
            links.addItem(withTitle: label == normal ? normal : "\(label) — \(normal)"); links.lastItem?.representedObject = normal
        }
        render.isEnabled = document.mime == "text/html"
        quantRender.isEnabled = !reader.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        status.stringValue = "HTTP \(document.status) · text reading · no website CSS, images or scripts were rendered. Appearance changes stay on this device."
    }
    @objc private func openLink() { if let url = links.selectedItem?.representedObject as? String { fetch(url) } }
    @objc private func back() { guard historyPosition > 0 else { return }; request?.cancel(); historyPosition -= 1; display(history[historyPosition]) }
    @objc private func forward() { guard historyPosition + 1 < history.count else { return }; request?.cancel(); historyPosition += 1; display(history[historyPosition]) }
    private func rendererConfiguration(local: Bool) -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .nonPersistent(); configuration.processPool = WKProcessPool()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false; configuration.defaultWebpagePreferences.isLockdownModeEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false; configuration.allowsAirPlayForMediaPlayback = false
        configuration.userContentController.add(local ? localRules : rules)
        if local { configuration.setURLSchemeHandler(assetHandler,forURLScheme:"quant-asset") }
        return configuration
    }
    private func showQuant(_ document: ReadDocument, choice: QuantRenderChoice) {
        guard let html = policy.quantDocument(reader.string,url:document.url.absoluteString,style:choice.style,routes:currentRoutes,assetRoot:"quant-asset://local") else { status.stringValue = "The local Quant render was blocked; text reading remains available."; return }
        discardDesign(); let configuration = rendererConfiguration(local:true)
        let view = WKWebView(frame:.zero,configuration:configuration); view.navigationDelegate = self; view.uiDelegate = self; view.isInspectable = false
        browser = view; rendererIsLocal = true; quantStyle = choice.style; quantUpdateInterval = choice.interval; install(view); designBoot = true; view.loadHTMLString(html,baseURL:nil)
        scheduleQuantRefresh()
        let update = choice.interval.map { " · fresh GET every \(Int($0)) seconds" } ?? " · refresh only when you ask"
        status.stringValue = "Quant rebuilt this page from extracted text and pinned local artwork\(update) · no website code or memory write."
    }
    private func scheduleQuantRefresh() {
        quantTimer?.invalidate(); quantTimer = nil
        guard rendererIsLocal, let seconds=quantUpdateInterval else { return }
        quantTimer = Timer.scheduledTimer(withTimeInterval:seconds,repeats:false) { [weak self] _ in self?.refreshQuantText() }
    }
    private func refreshQuantText() {
        guard enabled, rendererIsLocal, let document=current, let style=quantStyle else { return }
        fetch(document.url.absoluteString,resumeQuant:QuantRenderChoice(style:style,interval:quantUpdateInterval),replaceCurrent:true)
    }
    @objc private func renderWithQuant() {
        guard enabled, let document = current, !reader.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, let window else { return }
        let expected = revision, alert = NSAlert(); alert.messageText = "Let Quant arrange this page?"
        alert.informativeText = "Quant rebuilds the view from extracted text and the app’s original pinned artwork. Website code, cookies, CSS and images are excluded. Safe links become fresh native GETs. Optional updates repeat that same cookie-free GET; nothing is remembered or taught to Quant. This approval applies to this page only."
        let picker = NSPopUpButton(frame:NSRect(x:0,y:0,width:410,height:30)); picker.addItems(withTitles:["Field Notes — editorial paper and margin marks","Route — stepping points along a line","Index Cards — modular cards and stamps","Quiet Page — calm single-column reading"])
        let refresh = NSPopUpButton(frame:NSRect(x:0,y:0,width:410,height:30)); refresh.addItems(withTitles:["Refresh only when I ask","Update text every 60 seconds","Update text every 5 minutes"])
        let label = NSTextField(labelWithString:"CHOOSE THE VIEW AND WHEN IT MAY UPDATE"); label.font = .systemFont(ofSize:10,weight:.semibold); label.textColor = .secondaryLabelColor
        let accessory = NSStackView(views:[label,picker,refresh]); accessory.orientation = .vertical; accessory.alignment = .leading; accessory.spacing = 7; accessory.frame = NSRect(x:0,y:0,width:410,height:91); picker.widthAnchor.constraint(equalToConstant:410).isActive = true; refresh.widthAnchor.constraint(equalToConstant:410).isActive = true
        alert.accessoryView = accessory; alert.addButton(withTitle:"Keep current view"); alert.addButton(withTitle:"Render locally")
        alert.beginSheetModal(for:window) { [weak self] result in
            guard let self, result == .alertSecondButtonReturn, self.enabled, self.revision == expected else { return }
            let styles = ["field","route","cards","quiet"], style = styles[max(0,min(picker.indexOfSelectedItem,styles.count-1))]
            let intervals: [TimeInterval?] = [nil,60,300], interval = intervals[max(0,min(refresh.indexOfSelectedItem,intervals.count-1))]
            self.showQuant(document,choice:QuantRenderChoice(style:style,interval:interval))
        }
    }
    @objc private func renderDesign() {
        guard enabled, let document = current, document.mime == "text/html", let window else { return }
        let expected = revision, alert = NSAlert(); alert.messageText = "Render this website’s design?"
        alert.informativeText = "The app will display the received HTML and allow HTTPS images and styles from \(document.url.host ?? "this site"). These resources make additional GET requests. Scripts, forms, fonts, frames and downloads stay blocked. This choice applies to this page only."
        alert.addButton(withTitle: "Keep text only"); alert.addButton(withTitle: "Render without JavaScript"); alert.addButton(withTitle: "Review inline JavaScript…")
        alert.beginSheetModal(for: window) { [weak self] result in
            guard let self, self.enabled, self.revision == expected else { return }
            if result == .alertSecondButtonReturn { self.installWebsite(document, scripts: false); return }
            guard result == NSApplication.ModalResponse(rawValue: NSApplication.ModalResponse.alertFirstButtonReturn.rawValue + 2) else { return }
            let review = NSAlert(); review.messageText = "Allow inline JavaScript for this page once?"
            review.informativeText = "Page: \(document.url.absoluteString)\n\nOnly inline scripts from this received document may run in a fresh temporary website view. External scripts, fetch/XHR, WebSockets, forms, workers, frames, media, downloads and file access remain blocked. Scripts may change the page and use CPU. This is not full website JavaScript compatibility. Navigating, refreshing, clearing or returning to text revokes the choice. There is no bridge to Quant or your files."
            review.addButton(withTitle: "Keep JavaScript off"); review.addButton(withTitle: "Allow once for this page")
            review.beginSheetModal(for: window) { [weak self] confirmation in
                guard let self, confirmation == .alertSecondButtonReturn, self.enabled, self.revision == expected else { return }
                self.installWebsite(document, scripts: true)
            }
        }
    }
    private func installWebsite(_ document: ReadDocument, scripts: Bool) {
        let html = scripts ? policy.scriptDocument(document.source, url: document.url.absoluteString) : policy.renderDocument(document.source, url: document.url.absoluteString)
        guard let html else { status.stringValue = "The page failed its rendering policy."; return }
        discardDesign(); pageJavaScript = scripts
        let configuration = rendererConfiguration(local: false)
        configuration.defaultWebpagePreferences.allowsContentJavaScript = scripts
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self; view.uiDelegate = self; view.isInspectable = false
        browser = view; rendererIsLocal = false; install(view); designBoot = true
        view.loadHTMLString(html, baseURL: document.url)
        status.stringValue = scripts ? "Inline JavaScript approved for this document only. Connections and non-GET requests remain blocked by page policy." : "Website design · JavaScript off · GET resources only."
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, preferences: WKWebpagePreferences, decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        preferences.allowsContentJavaScript = pageJavaScript && !rendererIsLocal; preferences.isLockdownModeEnabled = true
        guard webView === browser, enabled else { decisionHandler(.cancel,preferences); return }
        guard (action.request.httpMethod ?? "GET") == "GET" else { decisionHandler(.cancel, preferences); return }
        let initial = action.request.url?.absoluteString == "about:blank" || (!rendererIsLocal && action.request.url == current?.url)
        if designBoot, action.navigationType == .other, action.targetFrame?.isMainFrame == true, initial { designBoot = false; decisionHandler(.allow,preferences); return }
        let value = action.request.url?.absoluteString ?? ""
        decisionHandler(.cancel,preferences)
        if rendererIsLocal {
            if action.navigationType == .linkActivated, action.targetFrame?.isMainFrame == true, action.request.httpMethod == "GET", !action.shouldPerformDownload { fetch(value) }
            else { status.stringValue = "That action was not admitted to the inert Quant view." }
            return
        }
        if action.navigationType == .linkActivated, action.targetFrame?.isMainFrame == true, action.request.httpMethod == "GET", !action.shouldPerformDownload {
            if pageJavaScript, let window {
                let expected = revision, alert = NSAlert()
                alert.messageText = "Open this link with GET?"
                alert.informativeText = value + "\n\nThis leaves the script-enabled page. JavaScript permission will be revoked."
                alert.addButton(withTitle: "Stay here"); alert.addButton(withTitle: "Open with GET")
                alert.beginSheetModal(for: window) { [weak self] result in
                    guard let self, result == .alertSecondButtonReturn, self.enabled, self.revision == expected else { return }
                    self.fetch(value)
                }
            } else { fetch(value) }
        } else { status.stringValue = "Page navigation or submission blocked. Use a link for GET; non-GET actions are unavailable." }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { designBoot = false }
    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) { completionHandler(challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust ? .performDefaultHandling : .cancelAuthenticationChallenge,nil) }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { nil }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.deny) }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) { completionHandler(nil) }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.cancel {_ in} }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.cancel {_ in} }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showText(); status.stringValue = "The page renderer stopped. Text reading remains available." }
}
