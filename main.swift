import AppKit
import WebKit

final class QuantApplication: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var window: NSWindow!
    private var room: WKWebView!
    private var policy: SecurityPolicy?
    private var browserPane: BrowserPane?
    private let logo = NSImageView()
    private let webSwitch = NSButton(checkboxWithTitle: "Web access", target: nil, action: nil)
    private let split = NSSplitView(), webPanel = NSView(), roomPanel = NSView()
    private let status = NSTextField(labelWithString: "Quant stays here. Web access is off.")
    private var activeDownloads = Set<ObjectIdentifier>()
    private var downloadPaths: [ObjectIdentifier: URL] = [:]
    private var completingQuit = false
    private var localView = "room"
    private var checkingLocalChange = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildWindow()
        do {
            guard let root = Bundle.main.resourceURL else { throw GuardFailure(message: "The app resources are missing.") }
            let verified = try SecurityPolicy(resources: root); try verified.selfTest(); policy = verified
            logo.image = NSImage(contentsOf: root.appendingPathComponent("Room/assets/quant-art-04.png")); NSApp.applicationIconImage = logo.image
            prepareRules(verified)
        } catch { failClosed(error.localizedDescription) }
    }
    private func buildWindow() {
        window = NSWindow(contentRect: NSRect(x:0,y:0,width:1460,height:940),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title = "Quant as Anything"; window.delegate = self; window.minSize = NSSize(width:1100,height:700)
        window.backgroundColor = NSColor(calibratedRed:0.933,green:0.91,blue:0.863,alpha:1); window.titlebarAppearsTransparent = true; window.isRestorable = false; window.center()
        let root = NSView(); window.contentView = root
        let bar = NSStackView(); bar.orientation = .horizontal; bar.spacing = 16
        logo.imageScaling = .scaleProportionallyUpOrDown; logo.widthAnchor.constraint(equalToConstant:36).isActive = true; logo.heightAnchor.constraint(equalToConstant:36).isActive = true
        let name = NSTextField(labelWithString:"QUANT"); name.font = NSFont(name:"Baskerville",size:20)
        let subtitle = NSTextField(labelWithString:"A room of your own."); subtitle.font = .systemFont(ofSize:12); subtitle.setContentHuggingPriority(.defaultLow,for:.horizontal)
        webSwitch.target = self; webSwitch.action = #selector(toggleWeb); webSwitch.isEnabled = false
        let brandViews: [NSView] = [logo,name,subtitle,webSwitch,NSButton(title:"Quant’s room",target:self,action:#selector(home)),NSButton(title:"Designer studio",target:self,action:#selector(studio)),NSButton(title:"Install model starter",target:self,action:#selector(installModelStarter)),NSButton(title:"About",target:self,action:#selector(about))]
        for view in brandViews { bar.addArrangedSubview(view) }
        split.isVertical = true; split.dividerStyle = .thin; split.addArrangedSubview(webPanel); split.addArrangedSubview(roomPanel); webPanel.isHidden = true
        status.font = .systemFont(ofSize:11); status.maximumNumberOfLines = 2
        let views: [NSView] = [bar,split,status]
        for view in views { view.translatesAutoresizingMaskIntoConstraints = false; root.addSubview(view) }
        NSLayoutConstraint.activate([bar.topAnchor.constraint(equalTo:root.topAnchor,constant:12),bar.leadingAnchor.constraint(equalTo:root.leadingAnchor,constant:20),bar.trailingAnchor.constraint(equalTo:root.trailingAnchor,constant:-20),bar.heightAnchor.constraint(equalToConstant:42),split.topAnchor.constraint(equalTo:bar.bottomAnchor,constant:10),split.leadingAnchor.constraint(equalTo:root.leadingAnchor),split.trailingAnchor.constraint(equalTo:root.trailingAnchor),split.bottomAnchor.constraint(equalTo:status.topAnchor,constant:-8),status.leadingAnchor.constraint(equalTo:root.leadingAnchor,constant:20),status.trailingAnchor.constraint(equalTo:root.trailingAnchor,constant:-20),status.bottomAnchor.constraint(equalTo:root.bottomAnchor,constant:-10)])
        installMenu(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps:true)
    }
    private func fill(_ view:NSView,in parent:NSView) {
        view.translatesAutoresizingMaskIntoConstraints = false; parent.addSubview(view)
        NSLayoutConstraint.activate([view.leadingAnchor.constraint(equalTo:parent.leadingAnchor),view.trailingAnchor.constraint(equalTo:parent.trailingAnchor),view.topAnchor.constraint(equalTo:parent.topAnchor),view.bottomAnchor.constraint(equalTo:parent.bottomAnchor)])
    }
    private func installMenu() {
        let menu = NSMenu(), application = NSMenuItem(), appMenu = NSMenu(); menu.addItem(application); application.submenu = appMenu
        appMenu.addItem(withTitle:"About Quant",action:#selector(about),keyEquivalent:"").target = self; appMenu.addItem(.separator()); appMenu.addItem(withTitle:"Quit Quant",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q")
        let editItem = NSMenuItem(), edit = NSMenu(title:"Edit"); editItem.submenu = edit; menu.addItem(editItem)
        for (title,action,key) in [("Undo",Selector(("undo:")),"z"),("Cut",#selector(NSText.cut(_:)),"x"),("Copy",#selector(NSText.copy(_:)),"c"),("Paste",#selector(NSText.paste(_:)),"v"),("Select All",#selector(NSText.selectAll(_:)),"a")] { edit.addItem(withTitle:title,action:action,keyEquivalent:key) }
        let browseItem = NSMenuItem(), browse = NSMenu(title:"Browse"); browseItem.submenu = browse; menu.addItem(browseItem)
        browse.addItem(withTitle:"Address",action:#selector(focusAddress),keyEquivalent:"l").target = self
        browse.addItem(withTitle:"Read again with GET",action:#selector(refresh),keyEquivalent:"r").target = self
        let localItem = NSMenuItem(), local = NSMenu(title:"Local"); localItem.submenu = local; menu.addItem(localItem)
        local.addItem(withTitle:"Quant’s room",action:#selector(home),keyEquivalent:"1").target = self
        local.addItem(withTitle:"Designer studio",action:#selector(studio),keyEquivalent:"2").target = self
        local.addItem(withTitle:"Install model starter",action:#selector(installModelStarter),keyEquivalent:"").target = self
        NSApp.mainMenu = menu
    }
    private func prepareRules(_ policy:SecurityPolicy) {
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier:"QuantStrictWeb-v2",encodedContentRuleList:policy.rules) { [weak self] rules,error in
            guard let self else { return }; guard error == nil, let rules else { self.failClosed("The browser protection rules failed to compile."); return }
            WKContentRuleListStore.default().compileContentRuleList(forIdentifier:"QuantLocalOnly-v1",encodedContentRuleList:SecurityPolicy.localRules) { [weak self] localRules,error in
                guard let self else { return }; guard error == nil, let localRules else { self.failClosed("The local room network guard failed to compile."); return }
                let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .default(); configuration.processPool = WKProcessPool()
                configuration.defaultWebpagePreferences.allowsContentJavaScript = true; configuration.preferences.javaScriptCanOpenWindowsAutomatically = false; configuration.userContentController.add(localRules)
                self.room = WKWebView(frame:.zero,configuration:configuration); self.room.isInspectable = false; self.room.navigationDelegate = self; self.room.uiDelegate = self
                self.fill(self.room,in:self.roomPanel); self.loadLocalPage("Room/Quant.html", directory: "Room")
                let pane = BrowserPane(policy:policy,rules:rules,localRules:localRules); self.browserPane = pane; self.fill(pane,in:self.webPanel); self.webSwitch.isEnabled = true
            }
        }
    }
    @objc private func toggleWeb() {
        let enabled = webSwitch.state == .on; browserPane?.setEnabled(enabled); webPanel.isHidden = !enabled; roomPanel.isHidden = false; split.adjustSubviews()
        if enabled { split.setPosition(max(660,window.contentView!.bounds.width-400),ofDividerAt:0); browserPane?.focusAddress() }
        status.stringValue = enabled ? "Web is on · GET reads first · choose Quant or website rendering · GET only; page scripts require separate approval." : "Web is off. Quant’s room stays local."
    }
    @objc private func focusAddress() { if webSwitch.state == .on { browserPane?.focusAddress() } }
    @objc private func refresh() { if webSwitch.state == .on { browserPane?.refreshGET() } }
    private func loadLocalPage(_ relative: String, directory: String) {
        guard let policy else { return }
        let file = policy.root.appendingPathComponent(relative)
        let access = policy.root.appendingPathComponent(directory, isDirectory: true)
        room.stopLoading()
        room.loadFileURL(file, allowingReadAccessTo: access)
    }
    @objc private func home() {
        roomPanel.isHidden = false; split.adjustSubviews()
        if localView == "room" { room?.evaluateJavaScript("document.querySelector('button[data-view=home]')?.click()") { _,_ in } }
        else { requestLocalPage("Room/Quant.html", directory: "Room", view: "room") }
        status.stringValue = "Quant’s room stays local. Web access is \(webSwitch.state == .on ? "on by your choice" : "off")."
    }
    @objc private func studio() {
        guard room != nil, policy != nil else { return }
        roomPanel.isHidden = false; split.adjustSubviews()
        if localView != "studio" { requestLocalPage("Studio/studio.html", directory: "Studio", view: "studio") }
        status.stringValue = "Designer studio is local. It can make a card or brief; it cannot send or generate an image."
    }
    @objc private func installModelStarter() {
        guard let source = policy?.root.appendingPathComponent("ModelCard/Current", isDirectory: true), FileManager.default.fileExists(atPath: source.path) else { blocked("The bundled Quant Book starter is missing."); return }
        let panel = NSOpenPanel(); panel.title = "Choose where to install your Quant model starter"; panel.prompt = "Install local copy"
        panel.canChooseFiles = false; panel.canChooseDirectories = true; panel.allowsMultipleSelection = false; panel.canCreateDirectories = true; panel.resolvesAliases = false
        panel.beginSheetModal(for: window) { [weak self] response in
            guard let self, response == .OK, let parent = panel.url else { return }
            let destination = parent.appendingPathComponent("Quant-as-Anything-Starter", isDirectory: true)
            guard !FileManager.default.fileExists(atPath: destination.path) else { self.blocked("A Quant-as-Anything-Starter folder already exists there. Nothing was replaced."); return }
            do {
                try FileManager.default.copyItem(at: source, to: destination)
                self.status.stringValue = "The checked Quant Books and room were copied to your chosen folder. Open Quant.html to use them."
            } catch { self.blocked("The local model starter could not be copied: \(error.localizedDescription)") }
        }
    }
    private func requestLocalPage(_ relative: String, directory: String, view: String) {
        guard let room, !checkingLocalChange else { return }
        guard activeDownloads.isEmpty else { blocked("Finish saving your local copy before changing rooms."); return }
        checkingLocalChange = true
        let check = "(() => { const e = new Event('beforeunload', {cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented || document.getElementById('saveState')?.textContent === 'Keeping your place…' || !!document.querySelector('#noteDialog[open],#modelDialog[open]') || !!document.getElementById('prompt')?.value.trim(); })()"
        room.evaluateJavaScript(check) { [weak self] value, error in
            guard let self else { return }
            if error == nil, value as? Bool == false {
                self.checkingLocalChange = false; self.localView = view
                self.loadLocalPage(relative, directory: directory); return
            }
            let alert = NSAlert(); alert.messageText = "Keep your work before switching"
            alert.informativeText = "This view has unsaved work or could not confirm its save state. Keep it open to save a copy before leaving."
            alert.addButton(withTitle: "Keep working"); alert.addButton(withTitle: "Switch view")
            alert.beginSheetModal(for: self.window) { [weak self] result in
                guard let self else { return }; self.checkingLocalChange = false
                if result == .alertSecondButtonReturn { self.localView = view; self.loadLocalPage(relative, directory: directory) }
            }
        }
    }
    @objc private func about() {
        let alert = NSAlert(); alert.messageText = "Quant · Joe Smith · Fiduci Group"
        alert.informativeText = "Quant’s public resident stays local. A native HTTPS GET receives a response as inert data, keeps readable text and safe link destinations, and discards the page runtime. Quant can then rebuild a new view from that text and pinned local artwork. Manual or approved timed updates repeat the same cookie-free GET; JavaScript-only content remains unavailable. Website design is a separate choice. POST is unavailable. Inline JavaScript requires a separate confirmation for the current page; external scripts stay blocked.\n\nSelected Books are genuine checked .quantbook records; selected Contexts update current terrain and source-linked Book continuity. The Designer studio makes local cards and briefs. There is no image generator in this build. The app has no listening server or incoming POST endpoint. Websites cannot read Quant’s memory. Local storage is not separately encrypted. HTTPS is not a guarantee against a compromised device or trust store."
        alert.beginSheetModal(for:window,completionHandler:nil)
    }
    private func blocked(_ message:String) { status.stringValue = message }
    private func failClosed(_ message:String) { webSwitch.isEnabled = false; browserPane?.setEnabled(false); let alert = NSAlert(); alert.messageText = "Quant could not establish its protections"; alert.informativeText = message; alert.alertStyle = .critical; alert.beginSheetModal(for:window) { _ in NSApp.terminate(nil) } }
    func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,preferences:WKWebpagePreferences,decisionHandler:@escaping(WKNavigationActionPolicy,WKWebpagePreferences)->Void) {
        guard webView === room, let policy, let url = action.request.url else { decisionHandler(.cancel,preferences); return }
        preferences.allowsContentJavaScript = true
        if policy.permitsLocalURL(url), url.lastPathComponent == "Read-Me.html" { decisionHandler(.cancel,preferences); about(); return }
        if action.targetFrame?.isMainFrame == true, policy.permitsLocalURL(url) {
            if url.lastPathComponent == "Quant.html", localView != "room" {
                decisionHandler(.cancel,preferences); requestLocalPage("Room/Quant.html", directory:"Room", view:"room"); return
            }
            if url.lastPathComponent == "studio.html", localView != "studio" {
                decisionHandler(.cancel,preferences); requestLocalPage("Studio/studio.html", directory:"Studio", view:"studio"); return
            }
        }
        if action.shouldPerformDownload, trusted(webView,action.sourceFrame), url.scheme == "blob" { decisionHandler(.download,preferences); return }
        decisionHandler(action.targetFrame?.isMainFrame == true && policy.permitsLocalURL(url) ? .allow : .cancel,preferences)
    }
    func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for action:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView? { nil }
    func webView(_ webView:WKWebView,requestMediaCapturePermissionFor origin:WKSecurityOrigin,initiatedByFrame frame:WKFrameInfo,type:WKMediaCaptureType,decisionHandler:@escaping(WKPermissionDecision)->Void) { decisionHandler(.deny) }
    func webView(_ webView:WKWebView,didReceive challenge:URLAuthenticationChallenge,completionHandler:@escaping(URLSession.AuthChallengeDisposition,URLCredential?)->Void) { completionHandler(.cancelAuthenticationChallenge,nil) }
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView) { blocked("Quant’s room process ended. Save state cannot be confirmed; reopen the app to recover its stored room.") }
    private func trusted(_ webView: WKWebView, _ frame: WKFrameInfo) -> Bool { webView === room && frame.isMainFrame && (frame.request.url.map { policy?.permitsLocalURL($0) == true } ?? false) }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard trusted(webView, frame) else { completionHandler(); return }
        let alert = NSAlert(); alert.messageText = "Quant"; alert.informativeText = String(message.prefix(2000)); alert.beginSheetModal(for: window) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard trusted(webView, frame) else { completionHandler(false); return }
        let alert = NSAlert(); alert.messageText = "Quant’s local room"; alert.informativeText = String(message.prefix(2000)); alert.addButton(withTitle: "Continue"); alert.addButton(withTitle: "Cancel"); alert.beginSheetModal(for: window) { response in completionHandler(response == .alertFirstButtonReturn) }
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) { completionHandler(nil) }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        guard trusted(webView, frame) else { completionHandler(nil); blocked("Websites cannot open local files."); return }
        let panel = NSOpenPanel(); panel.title = "Choose a local file for Quant"; panel.prompt = "Choose copy"
        panel.canChooseFiles = !parameters.allowsDirectories; panel.canChooseDirectories = parameters.allowsDirectories; panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canCreateDirectories = false; panel.resolvesAliases = false
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        guard webView === room, navigationAction.request.url?.scheme == "blob" else { download.cancel { _ in }; return }
        activeDownloads.insert(ObjectIdentifier(download)); download.delegate = self
    }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.cancel { _ in } }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard activeDownloads.contains(ObjectIdentifier(download)), response.url?.scheme == "blob", response.expectedContentLength <= 192 * 1024 * 1024 else { completionHandler(nil); return }
        let panel = NSSavePanel(); panel.title = "Save a copy from Quant"; panel.canCreateDirectories = true
        let name = URL(fileURLWithPath: suggestedFilename).lastPathComponent.components(separatedBy: .controlCharacters).joined()
        panel.nameFieldStringValue = name.isEmpty ? "Quant-copy.txt" : String(name.prefix(180))
        panel.beginSheetModal(for: window) { [weak self] result in
            let url = result == .OK ? panel.url : nil
            if let url { self?.downloadPaths[ObjectIdentifier(download)] = url }
            completionHandler(url)
        }
    }
    func downloadDidFinish(_ download: WKDownload) {
        activeDownloads.remove(ObjectIdentifier(download)); downloadPaths.removeValue(forKey: ObjectIdentifier(download))
        status.stringValue = "The copy finished saving. Your original source files were not written back."
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        activeDownloads.remove(ObjectIdentifier(download)); downloadPaths.removeValue(forKey: ObjectIdentifier(download)); blocked("The local copy did not finish saving. Keep the room open and try again.")
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if completingQuit || room == nil { return .terminateNow }
        if !activeDownloads.isEmpty { confirmQuit("A local copy is still being saved."); return .terminateLater }
        // Only the bundled local room is evaluated; website text is never executed by the host.
        let check = "(() => { const e = new Event('beforeunload', {cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented || document.getElementById('saveState')?.textContent === 'Keeping your place…' || !!document.querySelector('#noteDialog[open],#modelDialog[open]') || !!document.getElementById('prompt')?.value.trim(); })()"
        room.evaluateJavaScript(check) { [weak self] value, error in
            guard let self else { sender.reply(toApplicationShouldTerminate: false); return }
            if error != nil || value as? Bool != false { self.confirmQuit("Quant could not confirm that the current room is saved. Keep it open to save a portable copy.") }
            else { self.completingQuit = true; sender.reply(toApplicationShouldTerminate: true) }
        }
        return .terminateLater
    }
    private func confirmQuit(_ message: String) {
        let alert = NSAlert(); alert.messageText = "Keep your room before closing"; alert.informativeText = message; alert.addButton(withTitle: "Keep open"); alert.addButton(withTitle: "Quit anyway")
        alert.beginSheetModal(for: window) { [weak self] result in let quit = result == .alertSecondButtonReturn; self?.completingQuit = quit; NSApp.reply(toApplicationShouldTerminate: quit) }
    }
    func applicationWillTerminate(_ notification: Notification) { browserPane?.setEnabled(false) }
}

let app = NSApplication.shared
if CommandLine.arguments.contains("--self-test") {
    do { try runNativeChecks(); exit(0) }
    catch { fputs("Native security checks failed: \(error.localizedDescription)\n", stderr); exit(1) }
}
let delegate = QuantApplication()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
