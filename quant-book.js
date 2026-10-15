/* A typed, portable Book for the local Quant as Anything resident. */
'use strict';
const QuantBook = (() => {
  const marker = '\n# QUANT_SHA256:';
  const maximum = 8 * 1024 * 1024;

  function checked(payload) {
    if (payload?.format !== 'quantbook/v1' || typeof payload.name !== 'string' ||
        !payload.name.trim() || payload.name.length > 140 || typeof payload.text !== 'string' ||
        payload.text.length > maximum || !Array.isArray(payload.records) || payload.records.length > 800) {
      throw Error('This is not a supported Quant Book.');
    }
    const body = JSON.stringify({kind: '.book', records: payload.records});
    const store = new QuantCore.MemoryStore('.book', 800);
    store.loadText(body + marker + QuantCore.sha256(body) + '\n');
    if (store.records.size !== payload.records.length) throw Error('The Book has duplicate records.');
    return {name: payload.name, text: payload.text, records: [...store.records.values()]};
  }

  function encode(name, text, records) {
    const payload = {format: 'quantbook/v1', name, text, records};
    checked(payload);
    const body = JSON.stringify(payload);
    if (new TextEncoder().encode(body).length > maximum) throw Error('Book exceeds the 8 MB limit.');
    return body + marker + QuantCore.sha256(body) + '\n';
  }

  function decode(value) {
    if (typeof value !== 'string' || new TextEncoder().encode(value).length > maximum + 100) throw Error('Book exceeds the 8 MB limit.');
    const end = value.lastIndexOf(marker);
    if (end < 0 || !/^[0-9a-f]{64}\n?$/.test(value.slice(end + marker.length)) ||
        QuantCore.sha256(value.slice(0, end)) !== value.slice(end + marker.length).trim()) {
      throw Error('The Quant Book integrity check failed.');
    }
    return checked(JSON.parse(value.slice(0, end)));
  }

  function fromText(name, text, source) {
    const resident = new QuantCore.QuantAnything();
    resident.ingest(text, source, '.book');
    return encode(name, text, [...resident.book.records.values()]);
  }

  return Object.freeze({encode, decode, fromText});
})();
