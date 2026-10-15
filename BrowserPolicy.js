/* Pure, dependency-free policy. No browser APIs, networking, persistence or native handles. */
'use strict';
const BrowserPolicy = (() => {
  const fail = reason => ({allowed: false, reason});
  const deniedSuffixes = ['localhost', 'local', 'internal', 'intranet', 'lan', 'home', 'home.arpa', 'test', 'invalid', 'example', 'onion', 'arpa'];
  function inspectURL(text) {
    if (typeof text !== 'string' || !text || text.length > 4096) return fail('Use an HTTPS address of at most 4,096 characters.');
    if (/[\s\\\u0000-\u0020\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(text)) return fail('Control characters, spaces and backslashes are not allowed in addresses.');
    const match = /^https:\/\/([^/?#]+)([/?#].*)?$/i.exec(text);
    if (!match) return fail('Only HTTPS websites are allowed.');
    const authority = match[1];
    if (authority.includes('@') || authority.includes('%')) return fail('Embedded credentials and encoded hostnames are blocked.');
    const host = authority.replace(/:443$/, '').toLowerCase();
    if (host.includes(':') || host.length > 253) return fail('IP literals and non-standard ports are blocked.');
    const labels = host.split('.');
    if (labels.length < 2 || !/^[a-z]{2,63}$/.test(labels.at(-1))) return fail('Use a public DNS hostname, not an IP address or a local name.');
    if (!labels.every(x => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))) return fail('This hostname is outside the strict address format.');
    if (deniedSuffixes.some(x => host === x || host.endsWith('.' + x))) return fail('Local and special-use hostnames are blocked.');
    return {allowed: true, host, url: 'https://' + host + (match[2] || '/')};
  }
  function navigation(request) {
    if (!request || request.enabled !== true) return fail('Web browsing is switched off.');
    if (request.mainFrame !== true) return fail('Embedded frames and pop-up windows are blocked.');
    if (request.method !== 'GET') return fail('Forms, uploads and non-GET navigation are blocked.');
    if (request.download === true) return fail('Website downloads are blocked.');
    if (!['typed', 'link', 'backForward', 'reload', 'redirect'].includes(request.intent)) return fail('Unrequested navigation is blocked.');
    return inspectURL(request.url);
  }
  function response(info) {
    const url = inspectURL(info?.url); if (!url.allowed) return url;
    if (info.mainFrame !== true) return fail('Embedded documents are blocked.');
    if (!['text/html', 'text/plain'].includes(String(info.mime || '').toLowerCase())) return fail('Only HTML and plain-text documents can open in this browser.');
    if (info.download === true) return fail('Attachment downloads are blocked.');
    if (Number.isFinite(info.length) && info.length > 8 * 1024 * 1024) return fail('The declared document size exceeds 8 MB.');
    return {allowed: true};
  }
  return Object.freeze({inspectURL, navigation, response});
})();
