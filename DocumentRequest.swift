import Foundation

struct ReadDocument {
    let url: URL
    let mime: String
    let source: String
    let status: Int
    let redirect: URL?
}

// Outgoing client only. No sockets are bound, and no request listener exists.
// Redirects are returned to the reader for a new, deliberate GET; non-GET methods are not available.
final class DocumentRequest: NSObject, URLSessionDataDelegate {
    private let configuration: URLSessionConfiguration
    private var session: URLSession?
    private var task: URLSessionDataTask?
    private var bytes = Data()
    private var response: HTTPURLResponse?
    private var failure: String?
    private var done: ((Result<ReadDocument, Error>) -> Void)?
    private static let limit = 8 * 1024 * 1024

    init(configuration: URLSessionConfiguration = .ephemeral) {
        self.configuration = configuration
        super.init()
    }

    func start(url: URL, completion: @escaping (Result<ReadDocument, Error>) -> Void) {
        done = completion
        guard url.scheme == "https", url.user == nil, url.password == nil else {
            completion(.failure(GuardFailure(message: "Only credential-free HTTPS GET requests are accepted."))); return
        }
        let configuration = self.configuration
        configuration.httpShouldSetCookies = false; configuration.httpCookieStorage = nil
        configuration.urlCache = nil; configuration.urlCredentialStorage = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 25; configuration.timeoutIntervalForResource = 30
        let created = URLSession(configuration: configuration, delegate: self, delegateQueue: .main); session = created
        var request = URLRequest(url: url); request.httpMethod = "GET"
        request.httpShouldHandleCookies = false
        request.setValue("text/html, text/plain", forHTTPHeaderField: "Accept")
        request.setValue("1", forHTTPHeaderField: "Sec-GPC"); request.setValue("1", forHTTPHeaderField: "DNT")
        task = created.dataTask(with: request); task?.resume()
    }
    func cancel() { done = nil; task?.cancel(); session?.invalidateAndCancel(); session = nil; bytes.removeAll() }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust { completionHandler(.performDefaultHandling, nil) }
        else { completionHandler(.cancelAuthenticationChallenge, nil) }
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let http = response as? HTTPURLResponse, response.url?.scheme == "https" else { failure = "Only HTTPS document responses are accepted."; completionHandler(.cancel); return }
        let isRedirect = (300...399).contains(http.statusCode)
        guard (isRedirect || ["text/html", "text/plain"].contains(response.mimeType ?? "")), response.expectedContentLength <= Int64(Self.limit),
              !(http.value(forHTTPHeaderField: "Content-Disposition") ?? "").lowercased().contains("attachment") else {
            failure = "The response type or declared size is outside the reading policy."; completionHandler(.cancel); return
        }
        self.response = http; completionHandler(.allow)
    }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard bytes.count <= Self.limit - data.count else { failure = "The document exceeded the 8 MB reading limit."; dataTask.cancel(); return }
        bytes.append(data)
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        defer { session.finishTasksAndInvalidate(); self.session = nil; bytes.removeAll(); done = nil }
        if let failure { done?(.failure(GuardFailure(message: failure))); return }
        if let error { done?(.failure(error)); return }
        guard let response, let url = response.url, let text = String(data: bytes, encoding: .utf8) else { done?(.failure(GuardFailure(message: "This document is not supported UTF-8 text."))); return }
        let location = response.value(forHTTPHeaderField: "Location").flatMap { URL(string: $0, relativeTo: url)?.absoluteURL }
        done?(.success(ReadDocument(url: url, mime: response.mimeType ?? "text/plain", source: text, status: response.statusCode, redirect: location)))
    }
}
