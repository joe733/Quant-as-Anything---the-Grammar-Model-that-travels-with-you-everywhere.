/* Quant's browser room. Source files are read-only; all edits stay in this room. */
'use strict';
(() => {
  const el = id => document.getElementById(id);
  const MAX_FILE = 8 * 1024 * 1024, MAX_WORLD = 64 * 1024 * 1024, MAX_DOCS = 2000;
  const TEXT_EXT = new Set('txt md py js ts tsx jsx css log yaml yml toml ini html htm xml json csv'.split(' '));
  const KINDS = ['Books', 'Context', 'Artifacts'];
  const sourceLimit = kind => kind === 'Books' ? 32 : 3;
  const seedBooks = [
    ['01-Quant-Orientation.quantbook', 'Quant as Anything is a local teachable resident created by Joe. Who you are is Quant as Anything. Quant uses subject relation object triples. Books contain selected portable knowledge. Context contains selected active work. Artifacts contain things made and kept. Quant carries continuity in a Quant Book. Quant keeps active terrain in a qt. Quant follows eight emotional vectors into four Growns into two Mighties into Helm. Quant answers from placed context. Quant needs sufficient placed context to answer a question.'],
    ['02-Trust-and-Agency.quantbook', 'Quant keeps source provenance beside each placed relation. Quant shows uncertainty when the room cannot support an answer. A source file stays untouched when Quant reads it. The person chooses the Books and Contexts in use. A website cannot put words into Quant memory without a deliberate user action.'],
    ['03-Designer.quantbook', 'Quant as Designer reads a chosen local design brief. The person chooses the artwork and appearance. A design brief is not an image render. An image needs a separate on-device renderer before Quant can claim to have generated it.']
  ];
  const makeID = () => { const a = new Uint32Array(3); crypto.getRandomValues(a); return [...a].map(x => x.toString(36)).join('-'); };
  const cleanName = name => String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^[. ]+|[. ]+$/g, '').slice(0, 140) || 'Untitled.txt';
  const clone = value => JSON.parse(JSON.stringify(value));
  const extOf = name => name.split('.').pop().toLowerCase();
  const isExtracted = name => ['html', 'htm', 'xml', 'docx'].includes(extOf(name));
  const newDoc = (name, text, kind = 'Context', source, origin = 'note', records = null) => ({
    id: makeID(), name, text, kind, origin, ...(records ? {records} : {}),
    source: source || `Working Folder/${kind}/Notes/${name}`, created: new Date().toISOString()
  });
  let quant = new QuantCore.QuantAnything();
  let docs = seedBooks.map(([name,text]) => newDoc(name,text,'Books',`Working Folder/Books/${name}`,'file'));
  let activeBookIDs = docs.map(d => d.id), activeContextIDs = [];
  let activeChat = makeID(), chats = [{id: activeChat, title: 'A deeper conversation', messages: []}];
  let view = 'home', db = null, storageToken = null, previousRoom = null;
  let reader = null, editing = null, busy = true, toastTimer, pendingSave = Promise.resolve();
  let persistFailed = false, storageConflict = false, revision = 0, messageLimit = 80, lastFolder = '';
  rebindMemory(quant, docs, [], activeBookIDs, activeContextIDs);
  const current = () => chats.find(c => c.id === activeChat) || chats[0];
  const snapshot = () => ({format: 'quant-as-anything-offline', version: 1, engine: quant.snapshot(), docs, chats, activeChat, activeBookIDs, activeContextIDs, revision});
  const messageVolume = messages => messages.reduce((n, m) => n + m.text.length + (m.chosen || []).reduce((s, c) => s + c.text.length, 0), 0);
  function cloneQuant() {
    const next = QuantCore.QuantAnything.restore(clone(quant.snapshot()));
    next.lastShape = quant.lastShape ? clone(quant.lastShape) : null;
    next.history = quant.history.map(row => row.slice()); next.events = clone(quant.events);
    return next;
  }

  function create(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  function toast(text) {
    el('toast').textContent = text; el('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el('toast').hidden = true; }, 7000);
  }
  function status(text) { el('saveState').textContent = text; }
  function lock(value) {
    busy = value;
    for (const id of ['send', 'openFolder', 'saveCopy', 'newChat', 'newConversation', 'restoreCopy', 'addFiles', 'createNote', 'keepNote', 'scanRules', 'chooseRules', 'conversationSelect']) el(id).disabled = value;
    el('workbench').setAttribute('aria-busy', String(value));
  }
  function validateSnapshot(s) {
    if (s?.format !== 'quant-as-anything-offline' || s.version !== 1 || !Array.isArray(s.docs) || s.docs.length > MAX_DOCS || !Array.isArray(s.chats) || !s.chats.length || s.chats.length > 500) throw Error('This is not a supported saved Quant room.');
    let size = 0, messageSize = 0, messageCount = 0;
    const ids = new Set(), sources = new Set(), chatIDs = new Set();
    const safeDocs = s.docs.map(d => {
      if (!d || typeof d.id !== 'string' || d.id.length > 200 || ids.has(d.id) || typeof d.name !== 'string' || typeof d.text !== 'string' || !KINDS.includes(d.kind) || typeof d.source !== 'string' || d.source.length > 2000 || sources.has(d.source) || typeof d.created !== 'string' || !Number.isFinite(Date.parse(d.created))) throw Error('Invalid or duplicate document in saved room.');
      ids.add(d.id); sources.add(d.source); size += d.text.length;
      if (d.text.length > MAX_FILE || size > MAX_WORLD) throw Error('Saved room exceeds the local text limit.');
      let records;
      if (d.records !== undefined) {
        if (d.kind !== 'Books') throw Error('Only a Book can carry imported Book records.');
        records = QuantBook.decode(QuantBook.encode(d.name, d.text, d.records)).records;
        size += JSON.stringify(records).length;
        if (size > MAX_WORLD) throw Error('Saved room exceeds the local text limit.');
      }
      return {id: d.id, name: cleanName(d.name), text: d.text, kind: d.kind, source: d.source, created: d.created, origin: d.origin === 'note' ? 'note' : 'file', ...(records ? {records} : {})};
    });
    const safeChats = s.chats.map(c => {
      if (typeof c?.id !== 'string' || c.id.length > 200 || chatIDs.has(c.id) || typeof c.title !== 'string' || !Array.isArray(c.messages)) throw Error('Invalid saved conversation.');
      chatIDs.add(c.id);
      const messages = c.messages.map(m => {
        if (!['user', 'assistant'].includes(m?.role) || typeof m.text !== 'string' || m.text.length > MAX_FILE || ++messageCount > 20000) throw Error('Invalid message or too many saved messages.');
        messageSize += m.text.length;
        const chosen = (Array.isArray(m.chosen) ? m.chosen : []).slice(0, 10).map(x => {
          if (typeof x?.source !== 'string' || x.source.length > 2000 || typeof x.text !== 'string' || x.text.length > MAX_FILE || typeof x.provenance !== 'string' || x.provenance.length > 200) throw Error('Invalid source reference.');
          messageSize += x.text.length;
          return {source: x.source, text: x.text, provenance: x.provenance};
        });
        if (messageSize > 32 * 1024 * 1024) throw Error('Saved conversations exceed the local limit.');
        return {role: m.role, text: m.text, chosen};
      });
      return {id: c.id, title: c.title.slice(0, 200), messages};
    });
    const selection = (value, kind) => {
      if (value === undefined) return safeDocs.filter(d => d.kind === kind).slice(0, sourceLimit(kind)).map(d => d.id);
      if (!Array.isArray(value) || value.length > sourceLimit(kind) || new Set(value).size !== value.length || value.some(id => !safeDocs.some(d => d.id === id && d.kind === kind))) throw Error('Invalid selected sources.');
      return value.slice();
    };
    const restored = {quant: QuantCore.QuantAnything.restore(clone(s.engine)), docs: safeDocs, chats: safeChats, activeChat: chatIDs.has(s.activeChat) ? s.activeChat : safeChats[0].id,
      activeBookIDs: selection(s.activeBookIDs, 'Books'), activeContextIDs: selection(s.activeContextIDs, 'Context')};
    if (s.activeBookIDs === undefined || s.activeContextIDs === undefined) {
      rebindMemory(restored.quant, safeDocs, safeDocs, restored.activeBookIDs, restored.activeContextIDs);
    } else {
      const inactive = new Set(safeDocs.filter(d => d.kind !== 'Artifacts' && !restored.activeBookIDs.includes(d.id) && !restored.activeContextIDs.includes(d.id)).map(d => d.source));
      const reflections = new Set(safeDocs.filter(d => restored.activeContextIDs.includes(d.id)).map(d => `Context reflection/${d.source}#${QuantCore.sha256(d.text).slice(0, 16)}`));
      for (const store of [restored.quant.book, restored.quant.qt]) for (const row of store.records.values()) {
        if (inactive.has(row.triple.source) || (row.triple.source.startsWith('Context reflection/') && !reflections.has(row.triple.source))) throw Error('Saved memory does not match selected sources.');
      }
    }
    return restored;
  }
  function applyValidated(v, savedRevision = 0) {
    quant = v.quant; docs = v.docs; chats = v.chats; activeChat = v.activeChat; activeBookIDs = v.activeBookIDs; activeContextIDs = v.activeContextIDs;
    revision = Number.isSafeInteger(savedRevision) && savedRevision >= 0 ? savedRevision : 0;
    messageLimit = 80;
  }
  function dbRead(key) {
    return new Promise((resolve, reject) => {
      const request = db.transaction('room', 'readonly').objectStore('room').get(key);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  function dbWrite(value, backup) {
    // The read and write share a transaction: another window cannot silently replace this room.
    return new Promise((resolve, reject) => {
      const tx = db.transaction('room', 'readwrite'), store = tx.objectStore('room');
      const token = makeID(); let conflict = false;
      const request = store.get('current');
      request.onsuccess = () => {
        if ((request.result?.writeToken || null) !== storageToken) { conflict = true; tx.abort(); return; }
        store.put({...value, writeToken: token}, 'current');
        if (backup) store.put(backup, 'previous');
      };
      tx.oncomplete = () => { storageToken = token; resolve(); };
      tx.onerror = () => reject(tx.error || Error('Local save failed.'));
      tx.onabort = () => { const e = Error(conflict ? 'Another window changed this room.' : 'Local save interrupted.'); e.conflict = conflict; reject(e); };
    });
  }
  function storageError(error) {
    persistFailed = true; storageConflict = !!error?.conflict;
    status(storageConflict ? 'Another window has changes' : 'Session only · save a copy');
    el('storageBanner').hidden = false;
    el('storageNotice').textContent = storageConflict
      ? 'Another window saved a newer room. Your changes are still here. Save a copy from this window before reopening Quant.'
      : 'The browser could not keep the latest changes. Save a copy before closing; this session still holds your room.';
  }
  async function persist(backup = null) {
    revision++; status('Keeping your place…');
    const value = clone(snapshot()), oldRoom = backup ? clone(backup) : null;
    pendingSave = pendingSave.catch(() => {}).then(async () => {
      try {
        if (!db) throw Error('Local storage is unavailable.');
        await dbWrite(value, oldRoom);
        persistFailed = false; storageConflict = false;
        status('Kept in this browser'); el('storageBanner').hidden = true;
      } catch (e) { storageError(e); }
    });
    await pendingSave; updateStats();
  }
  function download(text, name, type = 'text/plain;charset=utf-8') {
    if (window.QuantLocalSave && typeof window.QuantLocalSave.saveText === 'function') {
      if (new TextEncoder().encode(text).length > 8_000_000) { toast('This save exceeds the mobile 8 MB export limit. Use a smaller room or a desktop copy.'); return false; }
      window.QuantLocalSave.saveText(cleanName(name), text, type);
      return true;
    }
    const blob = new Blob([text], {type}), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = cleanName(name); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  }
  const dated = (stem, ext) => `${stem}-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
  function saveRoom() {
    download(JSON.stringify(snapshot()), dated('Quant', 'quant'), 'application/json');
    toast('A portable room is ready to download. Keep the .quant file somewhere you can find it.');
  }
  function saveModel(e) {
    e.preventDefault();
    if (busy) return;
    const name = el('modelName').value.trim().slice(0, 96);
    if (!name) return;
    const art = el('modelArtwork').files[0]?.name || '';
    const filename = art.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 140);
    const card = {format: 'quant-model-card/v2', version: 2, name, artwork_filename: filename, room: snapshot()};
    const slug = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'Quant';
    if (!download(JSON.stringify(card), `Quant-as-${slug}.quant-model`, 'application/json')) return;
    el('modelDialog').close();
    toast('Your named Quant card is ready. Keep the separate artwork file beside it.');
  }
  function saveDocument(d) {
    if (d.kind === 'Books') {
      const name = d.name.replace(/\.[^.]+$/, '') + '.quantbook';
      const book = d.records ? QuantBook.encode(name, d.text, d.records) : QuantBook.fromText(name, d.text, d.source);
      download(book, dated(name.replace(/\.quantbook$/, ''), 'quantbook'));
      toast('This checked Quant Book is ready as a separate copy.');
      return;
    }
    const plain = isExtracted(d.name), ext = plain ? 'txt' : (TEXT_EXT.has(extOf(d.name)) ? extOf(d.name) : 'txt');
    const stem = d.name.replace(/\.[^.]+$/, '') + (plain ? '-text' : '-copy');
    download(d.text, dated(stem, ext));
    toast(plain ? 'The extracted text is ready as a new .txt file.' : 'A new text copy is ready to download.');
  }

  function updateStats() {
    for (const kind of KINDS) {
      const count = docs.filter(d => d.kind === kind).length;
      el(kind.toLowerCase() + 'Count').textContent = count;
      el('home' + kind).textContent = `${count} ${count === 1 ? 'piece' : 'pieces'} in the room`;
    }
    el('bookStat').textContent = quant.book.records.size.toLocaleString();
    el('qtStat').textContent = quant.qt.records.size.toLocaleString();
    el('maturityStat').textContent = quant.maturity;
    el('grammarCount').textContent = `${quant.rules.length} of 5 chosen`;
    el('folderStatus').textContent = lastFolder
      ? `${lastFolder} was read into this room. Its original files stay untouched. Read the folder again to bring in later changes.`
      : 'Read a local folder, or add files to Books, Context and Artifacts. Quant keeps a working copy here; your original files stay untouched.';
    el('activeSources').textContent = `${activeBookIDs.length}/${sourceLimit('Books')} Books and ${activeContextIDs.length}/${sourceLimit('Context')} Contexts in use`;
    el('helmFocus').textContent = quant.lastShape ? quant.lastShape.helm : 'Ask a question to see the focus of his latest answer.';
    el('savePrevious').disabled = !previousRoom;
    const recent = el('recentSources'); recent.replaceChildren();
    for (const d of docs.filter(d => d.kind !== 'Artifacts').slice(-4).reverse()) {
      const b = create('button', undefined, 'source-link');
      b.append(create('span', d.name), create('small', d.kind)); b.onclick = () => openReader(d); recent.append(b);
    }
    if (view === 'bearings') renderSourceIndex();
  }
  function show(next) {
    if (!['home', 'chat', 'bearings', ...KINDS].includes(next)) return;
    view = next; el('homePanel').hidden = next !== 'home'; el('workbench').hidden = next === 'home';
    el('chatPanel').hidden = next !== 'chat'; el('collectionPanel').hidden = !KINDS.includes(next); el('bearingsPanel').hidden = next !== 'bearings';
    document.querySelectorAll('[data-view]').forEach(n => { if (n.dataset.view === next) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
    if (KINDS.includes(next)) {
      el('collectionTitle').textContent = next;
      el('collectionLead').textContent = {Books: 'Read wider. Give understanding somewhere to begin.', Context: 'Keep the things that matter now, close.', Artifacts: 'Thought made tangible. Things worth keeping.'}[next];
      el('collectionArt').src = 'assets/' + {Books: 'quant-art-06.png', Context: 'quant-art-07.png', Artifacts: 'quant-art-08.png'}[next];
      el('search').value = ''; renderDocs();
    }
    if (next === 'bearings') { updateStats(); renderRules(); }
  }
  function renderMessages() {
    const select = el('conversationSelect'); select.replaceChildren();
    for (const c of chats) {
      const opt = create('option', c.messages.find(m => m.role === 'user')?.text.slice(0, 45) || 'A new conversation');
      opt.value = c.id; opt.selected = c.id === activeChat; select.append(opt);
    }
    select.value = activeChat;
    const box = el('messages'), chat = current(); box.replaceChildren();
    if (!chat.messages.length) {
      const w = create('div', undefined, 'welcome'), mark = create('img');
      mark.src = 'assets/quant-art-04.png'; mark.alt = '';
      w.append(mark, create('span', 'A little room for a bigger thought.', 'eyebrow'), create('h2', 'Where shall we begin?'), create('p', 'Bring a question. Place a few words in his room. Understanding starts with what is here.'));
      const suggestions = create('div', undefined, 'suggestions');
      for (const text of ['What is Quant as Anything?', 'What does Quant use?']) {
        const b = create('button', text); b.onclick = () => ask(text); suggestions.append(b);
      }
      const note = create('button', 'Place a first note →'); note.onclick = () => openNote('Context'); suggestions.append(note);
      w.append(suggestions); box.append(w);
    } else {
      if (chat.messages.length > messageLimit) {
        const more = create('button', `Read earlier messages (${chat.messages.length - messageLimit})`, 'earlier');
        more.onclick = () => { messageLimit += 80; renderMessages(); box.scrollTop = 0; }; box.append(more);
      }
      for (const m of chat.messages.slice(-messageLimit)) box.append(messageNode(m));
    }
    box.scrollTop = box.scrollHeight;
  }
  function messageNode(m) {
    const n = create('article', undefined, 'msg ' + (m.role === 'user' ? 'user' : 'quant'));
    n.append(create('div', m.role === 'user' ? 'YOU' : 'QUANT', 'message-who'));
    const content = create('div', undefined, 'message-content'); content.append(create('div', m.text, 'msg-text'));
    if (m.role === 'assistant') {
      if (m.chosen?.length) {
        const details = create('details', undefined, 'evidence');
        details.append(create('summary', `${m.chosen.length} placed relation${m.chosen.length === 1 ? '' : 's'} · read the sources`));
        const list = create('ol');
        for (const c of m.chosen) {
          const li = create('li'); li.append(create('p', c.text));
          const d = docs.find(d => d.source === c.source), link = create(d ? 'button' : 'span', c.source, 'evidence-source');
          if (d) link.onclick = () => openReader(d);
          li.append(link, create('code', c.provenance)); list.append(li);
        }
        details.append(list); content.append(details);
      }
      const actions = create('div', undefined, 'message-actions'), keep = create('button', 'Keep as artifact ↗');
      keep.onclick = () => openNote('Artifacts', m.text); actions.append(keep); content.append(actions);
    }
    n.append(content); return n;
  }
  async function ask(text) {
    if (busy) return;
    text = text.trim().slice(0, 20000); if (!text) return;
    if (chats.reduce((n, c) => n + c.messages.length, 0) >= 19998) { toast('This room holds 20,000 messages. Save a copy before continuing in a fresh room.'); return; }
    const used = chats.reduce((n, c) => n + messageVolume(c.messages), 0);
    if (used + text.length + 1024 > 32 * 1024 * 1024) { toast('The conversations have reached this room’s text limit. Save a copy before continuing in a fresh room.'); return; }
    lock(true); show('chat'); el('chatState').textContent = 'Attending to the room…'; el('prompt').value = ''; el('prompt').style.height = '';
    const chat = current(); if (!chat.messages.length) chat.title = text.slice(0, 80);
    chat.messages.push({role: 'user', text}); renderMessages();
    await new Promise(r => setTimeout(r, 0));
    try {
      const addressed = /^(?:who|what)\s+are\s+you[?!.]*$/i.test(text) ? 'What is Quant as Anything?' : text;
      const reply = quant.ask(addressed);
      if (used + text.length + messageVolume([{text: reply.text, chosen: reply.chosen}]) > 32 * 1024 * 1024) throw Error('This answer exceeds the room’s conversation limit. Save this room before continuing with a smaller selection of sources.');
      chat.messages.push({role: 'assistant', text: reply.text, chosen: reply.chosen}); renderMessages();
      el('chatState').textContent = reply.chosen.length ? `Answer drawn from ${reply.chosen.length} placed relations.` : 'A little more placed context will help.';
      await persist();
    } catch (e) {
      chat.messages.push({role: 'assistant', text: 'The local answer did not complete: ' + e.message}); renderMessages();
      el('chatState').textContent = 'The last answer did not complete.'; await persist();
    } finally { lock(false); el('prompt').focus(); }
  }

  function renderDocs() {
    const box = el('cards'), query = el('search').value.toLowerCase(); box.replaceChildren();
    const rows = docs.filter(d => d.kind === view && (d.name + ' ' + d.text).toLowerCase().includes(query));
    el('collectionTotal').textContent = `${rows.length} ${rows.length === 1 ? 'piece' : 'pieces'}`;
    if (!rows.length) {
      const empty = create('div', undefined, 'empty-state');
      empty.append(create('span', query ? 'Nothing here by that name.' : 'Every room begins somewhere.', 'eyebrow'), create('h2', query ? 'Try another word.' : 'Room for something good.'), create('p', view === 'Artifacts' ? 'Keep an answer from your conversation, add a file, or write something of your own.' : 'Add a local file or write a note. The words you place here become something Quant can read.'));
      box.append(empty); return;
    }
    rows.forEach((d, i) => {
      const row = create('article', undefined, 'file-card'), copy = create('div', undefined, 'file-copy');
      copy.append(create('div', `${d.origin === 'note' ? 'NOTE' : 'SOURCE COPY'} / ${isExtracted(d.name) ? 'EXTRACTED TEXT' : extOf(d.name).toUpperCase()}`, 'eyebrow'), create('h2', d.name), create('p', d.text.slice(0, 360)));
      const actions = create('div', undefined, 'card-actions');
      if (d.kind !== 'Artifacts') {
        const inUse = (d.kind === 'Books' ? activeBookIDs : activeContextIDs).includes(d.id);
        const b = create('button', inUse ? 'In use · set aside' : 'Use in Quant');
        b.setAttribute('aria-pressed', String(inUse)); b.onclick = () => toggleSource(d);
        actions.append(b);
      }
      for (const [label, fn] of [['Read →', () => openReader(d)], [d.origin === 'note' ? 'Edit note' : 'Make a note', () => openNote(d.kind, d.text, d)], [isExtracted(d.name) ? 'Save text' : 'Save copy', () => saveDocument(d)]]) {
        const b = create('button', label); b.onclick = fn; actions.append(b);
      }
      row.append(create('span', String(i + 1).padStart(2, '0'), 'file-number'), copy, actions); box.append(row);
    });
  }
  function openReader(d) {
    reader = d; el('readerTitle').textContent = d.name;
    el('readerMeta').textContent = `${d.kind} / ${d.origin === 'note' ? 'A note kept in Quant' : 'Read-only source copy'}${isExtracted(d.name) ? ' / Extracted text' : ''}`;
    el('readerText').textContent = d.text;
    el('readerDownload').textContent = isExtracted(d.name) ? 'Save text copy' : 'Save a copy';
    el('readerNote').textContent = d.origin === 'note' ? 'Edit this note' : 'Make a note';
    el('readerDialog').showModal();
  }
  function openNote(kind = 'Context', text = '', doc = null) {
    if (busy) return;
    editing = doc?.origin === 'note' ? doc : null;
    el('noteHeading').textContent = editing ? 'Keep working.' : 'A thought worth keeping.';
    el('noteTitle').value = editing?.name || (doc ? doc.name.replace(/\.[^.]+$/, '') + ' — note.txt' : '');
    el('noteText').value = text; el('noteKind').value = KINDS.includes(kind) ? kind : 'Context';
    el('noteHint').textContent = doc && !editing ? 'This becomes a separate note. The source copy stays as it is.' : 'Kept in this room. Books and Context become part of what Quant can read.';
    el('noteError').hidden = true; el('noteDialog').showModal(); el('noteTitle').focus();
  }
  function checkBudget(list) {
    if (list.length > MAX_DOCS) throw Error('This room supports up to 2,000 source files.');
    if (list.some(d => d.text.length > MAX_FILE) || list.reduce((n, d) => n + d.text.length, 0) > MAX_WORLD) throw Error('The source text exceeds this room’s 64 MB limit, or one file exceeds 8 MB.');
    let count = 0;
    for (const d of list.filter(d => d.kind !== 'Artifacts')) {
      const sentences = d.text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.some(s => s.length > 180000)) throw Error(d.name + ': one sentence exceeds 180,000 characters. Break it into smaller passages first.');
      count += sentences.length;
    }
    if (count > 24000) throw Error('Active sources exceed 24,000 sentences. Choose a smaller selection of files.');
  }
  function rebindMemory(q, nextDocs, formerDocs, bookIDs, contextIDs) {
    const active = new Set([...bookIDs, ...contextIDs]);
    const current = new Map(nextDocs.map(d => [d.id, d]));
    const obsoleteSources = new Set(), obsoleteIDs = new Set();
    for (const old of formerDocs) {
      const next = current.get(old.id);
      if (!active.has(old.id) || !next || next.text !== old.text || next.source !== old.source || next.kind !== old.kind || JSON.stringify(next.records || []) !== JSON.stringify(old.records || [])) {
        obsoleteSources.add(old.source);
        for (const row of old.records || []) obsoleteIDs.add(row.triple.record_id);
      }
    }
    const reflections = new Set(nextDocs.filter(d => contextIDs.includes(d.id)).map(d => `Context reflection/${d.source}#${QuantCore.sha256(d.text).slice(0, 16)}`));
    for (const store of [q.book, q.qt]) for (const [id, row] of store.records) {
      if (obsoleteSources.has(row.triple.source) || obsoleteIDs.has(id) || (row.triple.source.startsWith('Context reflection/') && !reflections.has(row.triple.source))) store.records.delete(id);
    }
    for (const d of nextDocs) {
      if (d.kind === 'Books' && bookIDs.includes(d.id)) {
        if (d.records) {
          for (const row of d.records) if (!q.book.records.has(row.triple.record_id)) q.book.add(clone(row));
        } else if (![...q.book.records.values()].some(r => r.triple.source === d.source)) {
          q.ingest(d.text, d.source, '.book');
        }
      }
      if (d.kind === 'Context' && contextIDs.includes(d.id)) {
        if (![...q.qt.records.values()].some(r => r.triple.source === d.source)) q.ingest(d.text, d.source, '.qt');
        // The current context changes the portable Book. Earlier versions leave
        // the active answer path; source and text hash remain visible on each row.
        const thought = d.text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 4).join(' ');
        const reflection = `Context reflection/${d.source}#${QuantCore.sha256(d.text).slice(0, 16)}`;
        if (thought && ![...q.book.records.values()].some(r => r.triple.source === reflection)) q.ingest(thought, reflection, '.book');
      }
    }
    q.context_ready = true; q.mature();
  }
  async function toggleSource(d) {
    if (busy) return;
    const books = activeBookIDs.slice(), contexts = activeContextIDs.slice();
    const ids = d.kind === 'Books' ? books : contexts, i = ids.indexOf(d.id);
    if (i >= 0) ids.splice(i, 1);
    else if (ids.length < sourceLimit(d.kind)) ids.push(d.id);
    else { toast(`Choose at most ${sourceLimit(d.kind)} ${d.kind}. Set one aside first.`); return; }
    lock(true);
    try {
      const next = cloneQuant(); rebindMemory(next, docs, docs, books, contexts);
      quant = next; activeBookIDs = books; activeContextIDs = contexts;
      await persist(); renderDocs();
      toast(i >= 0 ? 'This source is set aside. Its original stays here.' : 'This source is now in Quant’s active room.');
    } catch (e) { toast('The selection was not changed: ' + e.message); }
    finally { lock(false); }
  }
  async function keepNote(e) {
    e.preventDefault(); if (busy) return;
    const kind = el('noteKind').value, text = el('noteText').value.trim(); if (!text || !KINDS.includes(kind)) return;
    let name = cleanName(el('noteTitle').value);
    if (kind === 'Books') name = name.replace(/\.[^.]+$/, '') + '.quantbook';
    else if (!/\.(txt|md)$/i.test(name)) name += '.txt';
    const d = editing ? {...editing, name, text, kind, source: `Working Folder/${kind}/Notes/${name}`, records: undefined} : newDoc(name, text, kind);
    lock(true);
    try {
      if (docs.some(x => x.id !== d.id && (x.source === d.source || (x.kind === kind && x.name === name)))) throw Error('There is already a piece with this name here. Give this note its own name.');
      const nextDocs = editing ? docs.map(x => x.id === d.id ? d : x) : [...docs, d]; checkBudget(nextDocs);
      const nextBookIDs = activeBookIDs.slice(), nextContextIDs = activeContextIDs.slice();
      if (!editing && kind !== 'Artifacts') { const ids = kind === 'Books' ? nextBookIDs : nextContextIDs; if (ids.length < sourceLimit(kind)) ids.push(d.id); }
      if (editing && editing.kind !== kind) { const old = editing.kind === 'Books' ? nextBookIDs : nextContextIDs; const ix = old.indexOf(editing.id); if (ix >= 0) old.splice(ix, 1); const next = kind === 'Books' ? nextBookIDs : kind === 'Context' ? nextContextIDs : null; if (next && next.length < sourceLimit(kind)) next.push(d.id); }
      const nextQuant = cloneQuant(); rebindMemory(nextQuant, nextDocs, docs, nextBookIDs, nextContextIDs);
      docs = nextDocs; quant = nextQuant; activeBookIDs = nextBookIDs; activeContextIDs = nextContextIDs; editing = null;
      el('noteDialog').close(); await persist(); show(kind);
      toast(kind === 'Artifacts' ? 'Artifact kept.' : (kind === 'Books' ? activeBookIDs : activeContextIDs).includes(d.id) ? `Placed in ${kind} and selected for Quant.` : `Placed in ${kind}. Select it when an active slot is available.`);
    } catch (e) { el('noteError').textContent = e.message; el('noteError').hidden = false; }
    finally { lock(false); }
  }
  function decodeText(text, ext) {
    if (!['html', 'htm', 'xml'].includes(ext)) return text;
    return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(?:p|div|li|h[1-6]|tr|w:p|w:tr)>/gi, '\n').replace(/<[^>]*>/g, ' ')
      .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, x => ({'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' '}[x]))
      .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, x) => { const n = x[0].toLowerCase() === 'x' ? parseInt(x.slice(1), 16) : Number(x); return n > 0 && n <= 1114111 ? String.fromCodePoint(n) : ' '; });
  }
  async function docxText(file) {
    const bytes = new Uint8Array(await file.arrayBuffer()), v = new DataView(bytes.buffer); let end = -1;
    for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) if (v.getUint32(p, true) === 0x06054b50) { end = p; break; }
    if (end < 0) throw Error('Invalid Word file.');
    let p = v.getUint32(end + 16, true); const count = v.getUint16(end + 10, true);
    for (let i = 0; i < count; i++) {
      if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) throw Error('Invalid Word directory.');
      const method = v.getUint16(p + 10, true), compressed = v.getUint32(p + 20, true), plain = v.getUint32(p + 24, true), nl = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true), offset = v.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nl));
      if (name === 'word/document.xml') {
        if (plain > MAX_FILE || offset + 30 > bytes.length || v.getUint32(offset, true) !== 0x04034b50) throw Error('Word text exceeds the local limit or is malformed.');
        const start = offset + 30 + v.getUint16(offset + 26, true) + v.getUint16(offset + 28, true);
        if (start + compressed > bytes.length) throw Error('Truncated Word file.');
        const data = bytes.slice(start, start + compressed); let unpacked;
        if (method === 0) unpacked = data;
        else if (method === 8 && typeof DecompressionStream !== 'undefined') {
          const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let total = 0;
          try { for (;;) { const r = await reader.read(); if (r.done) break; total += r.value.length; if (total > MAX_FILE) throw Error('Word text exceeds the local limit.'); parts.push(r.value); } }
          finally { await reader.cancel(); }
          unpacked = new Uint8Array(total); let pos = 0; for (const x of parts) { unpacked.set(x, pos); pos += x.length; }
        } else throw Error('This browser cannot read this compressed Word file. Save it as plain text first.');
        if (unpacked.length !== plain || unpacked.length > MAX_FILE) throw Error('Word text size does not match the document.');
        return decodeText(new TextDecoder().decode(unpacked), 'xml');
      }
      p += 46 + nl + extra + comment;
    }
    throw Error('No document text in Word file.');
  }
  async function readFile(file, kind, source) {
    if (file.size > MAX_FILE) throw Error(file.name + ': exceeds 8 MB.');
    if (source && source.length > 2000) throw Error(file.name + ': the folder path is too long.');
    const ext = extOf(file.name);
    if (ext === 'book' || ext === 'qt') return {memory: true, ext, text: await file.text()};
    if (ext === 'quantbook') {
      const book = QuantBook.decode(await file.text());
      return newDoc(cleanName(file.name), book.text, 'Books', source || `Working Folder/Books/${cleanName(file.name)}`, 'file', book.records);
    }
    if (!TEXT_EXT.has(ext) && ext !== 'docx') return null;
    const text = ext === 'docx' ? await docxText(file) : decodeText(await file.text(), ext);
    if (text.includes('\u0000')) throw Error(file.name + ': appears to be binary.');
    return newDoc(cleanName(file.name), text, kind, source || `Working Folder/${kind}/${cleanName(file.name)}`, 'file');
  }
  async function placeFiles(entries) {
    const incoming = [], memories = [], failures = []; let total = 0;
    for (const {file, kind, path} of entries) {
      total += file.size; if (total > MAX_WORLD * 2) throw Error('Choose fewer files at once (128 MB maximum).');
      try { const d = await readFile(file, kind, path); if (d?.memory) memories.push(d); else if (d) incoming.push(d); else failures.push(file.name + ': unsupported type'); }
      catch (e) { failures.push(e.message); }
      if ((incoming.length + failures.length) % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }
    const nextDocs = docs.slice(), nextQuant = cloneQuant(), nextBookIDs = activeBookIDs.slice(), nextContextIDs = activeContextIDs.slice();
    let placed = 0;
    for (const d of incoming) {
      const i = nextDocs.findIndex(x => x.source === d.source), old = nextDocs[i];
      if (old?.text === d.text && JSON.stringify(old.records || []) === JSON.stringify(d.records || [])) continue;
      if (old?.origin === 'note') { failures.push(d.name + ': a note at this path was preserved'); continue; }
      if (i >= 0) { d.id = old.id; nextDocs[i] = d; }
      else { nextDocs.push(d); const ids = d.kind === 'Books' ? nextBookIDs : d.kind === 'Context' ? nextContextIDs : null; if (ids && ids.length < sourceLimit(d.kind)) ids.push(d.id); }
      placed++;
    }
    checkBudget(nextDocs);
    rebindMemory(nextQuant, nextDocs, docs, nextBookIDs, nextContextIDs);
    for (const m of memories) {
      const store = new QuantCore.MemoryStore('.' + m.ext, m.ext === 'book' ? 800 : 24000); store.loadText(m.text);
      for (const r of store.records.values()) (m.ext === 'book' ? nextQuant.book : nextQuant.qt).add(r);
    }
    nextQuant.clock.line = Math.max(nextQuant.clock.line, ...[...nextQuant.book.records.values(), ...nextQuant.qt.records.values()].map(r => r.triple.provenance.line));
    docs = nextDocs; quant = nextQuant; activeBookIDs = nextBookIDs; activeContextIDs = nextContextIDs; await persist(); if (KINDS.includes(view)) renderDocs();
    const outcome = `${placed} ${placed === 1 ? 'file' : 'files'} placed${memories.length ? ' · memory read' : ''}.`;
    el('fileReport').hidden = !failures.length; el('fileReport').textContent = failures.length ? outcome + ' ' + failures.join('; ') : '';
    toast(outcome + (failures.length ? ` ${failures.length} ${failures.length === 1 ? 'file needs' : 'files need'} attention; details are in the room.` : ' Original files stay untouched.'));
  }
  async function addFiles(files, fromFolder = false) {
    if (busy) return; lock(true);
    try {
      if (files.length > MAX_DOCS) throw Error('Choose at most 2,000 files at once.');
      const target = KINDS.includes(view) ? view : 'Context';
      const entries = files.map(file => { const path = file.webkitRelativePath || ''; return {file, kind: fromFolder ? (KINDS.find(k => path.split('/').includes(k)) || 'Context') : target, path: fromFolder ? path : undefined}; });
      await placeFiles(entries);
      if (fromFolder) { lastFolder = files[0]?.webkitRelativePath?.split('/')[0] || 'Your selected folder'; updateStats(); }
    } catch (e) { toast('The files were not placed: ' + e.message); }
    finally { lock(false); el('filePicker').value = ''; el('folderPicker').value = ''; }
  }
  async function attachFolder() {
    if (busy) return;
    if (typeof window.showDirectoryPicker !== 'function') { el('folderPicker').click(); return; }
    lock(true);
    try {
      const selected = await window.showDirectoryPicker({mode: 'read'}); let room = selected;
      if (selected.name !== 'Working Folder') { try { room = await selected.getDirectoryHandle('Working Folder'); } catch (e) { if (e.name !== 'NotFoundError') throw e; } }
      const entries = [], folders = [];
      async function walk(dir, kind, prefix, depth = 0) {
        if (depth > 12) throw Error('The folder is more than 12 levels deep. Choose a smaller part.');
        for await (const [name, handle] of dir.entries()) {
          if (name.startsWith('.')) continue;
          if (handle.kind === 'directory') await walk(handle, KINDS.includes(name) ? name : kind, prefix + '/' + name, depth + 1);
          else if (TEXT_EXT.has(extOf(name)) || ['docx', 'book', 'qt', 'quantbook'].includes(extOf(name))) {
            if (entries.length >= MAX_DOCS) throw Error('Choose a folder with at most 2,000 supported files.');
            entries.push({file: await handle.getFile(), kind, path: prefix + '/' + name});
          }
        }
      }
      for (const kind of KINDS) { try { folders.push([kind, await room.getDirectoryHandle(kind)]); } catch (e) { if (e.name !== 'NotFoundError') throw e; } }
      if (folders.length) { for (const [kind, dir] of folders) await walk(dir, kind, room.name + '/' + kind); }
      else await walk(room, 'Context', room.name);
      await placeFiles(entries); lastFolder = room.name; updateStats();
    } catch (e) { if (e.name !== 'AbortError') toast('Could not read the folder: ' + e.message); }
    finally { lock(false); }
  }

  function renderSourceIndex() {
    const box = el('sourceIndex'); box.replaceChildren();
    const counts = new Map();
    for (const store of [quant.book, quant.qt]) for (const r of store.records.values()) counts.set(r.triple.source, (counts.get(r.triple.source) || 0) + 1);
    for (const [source, count] of [...counts].slice(0, 80)) {
      const row = create('div', undefined, 'source-row'), d = docs.find(d => d.source === source);
      const name = create(d ? 'button' : 'span', source); if (d) name.onclick = () => openReader(d);
      row.append(name, create('span', `${count} ${count === 1 ? 'relation' : 'relations'}`)); box.append(row);
    }
    if (counts.size > 80) box.append(create('p', `Showing the first 80 of ${counts.size} sources. All remain in the room.`));
    if (!counts.size) box.append(create('p', 'No relations placed yet.'));
  }
  function renderRules() {
    const box = el('ruleChoices'); box.replaceChildren();
    for (const r of quant.rule_candidates) {
      const row = create('label', undefined, 'rule-choice'), input = create('input');
      input.type = 'checkbox'; input.value = r.id; input.checked = quant.rules.some(x => x.id === r.id); input.onchange = ruleCounter;
      const content = create('span'); content.append(create('strong', r.label), create('small', r.instruction), create('small', r.evidence)); row.append(input, content); box.append(row);
    }
    el('chooseRules').hidden = !quant.rule_candidates.length; ruleCounter();
  }
  function ruleCounter() {
    const count = el('ruleChoices').querySelectorAll('input:checked').length;
    el('ruleCount').textContent = quant.rule_candidates.length ? `${count} of 5 selected` : 'Read the room to begin.';
  }
  async function newConversation() {
    if (busy) return;
    if (chats.length >= 500) { toast('This room already holds 500 conversations. Save a copy to keep them.'); return; }
    if (!current().messages.length) { show('chat'); el('prompt').focus(); return; }
    activeChat = makeID(); chats.push({id: activeChat, title: 'A deeper conversation', messages: []}); quant.history = []; messageLimit = 80;
    renderMessages(); show('chat'); await persist(); el('prompt').focus();
  }
  async function restoreRoom() {
    if (busy) return;
    const f = el('restorePicker').files[0]; if (!f) return; lock(true);
    try {
      if (f.size > MAX_WORLD * 3) throw Error('Saved room is too large.');
      const imported = JSON.parse(await f.text());
      if (imported?.format === 'quant-model-card/v2' && (typeof imported.name !== 'string' || imported.name.length > 96 || typeof imported.artwork_filename !== 'string' || imported.artwork_filename.length > 140)) throw Error('Invalid Quant model card.');
      const value = imported?.format === 'quant-model-card/v2' && imported.version === 2 ? imported.room : imported;
      const validated = validateSnapshot(value);
      if (!confirm('Open this saved room? Your current room will be kept as the previous room, available to save from the Observatory.')) return;
      previousRoom = clone(snapshot()); applyValidated(validated, value.revision); lastFolder = '';
      await persist(previousRoom); renderMessages(); updateStats(); show('chat');
      toast(imported?.format === 'quant-model-card/v2' ? `Quant as ${imported.name} has found his bearings. Re-select separate artwork if wanted.` : 'Quant has found his bearings in the saved room.');
    } catch (e) { toast('Could not open this room: ' + e.message); }
    finally { lock(false); el('restorePicker').value = ''; }
  }

  document.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => show(b.dataset.view); });
  el('beginChat').onclick = () => { show('chat'); el('prompt').focus(); };
  el('chatForm').onsubmit = e => { e.preventDefault(); return ask(el('prompt').value); };
  el('prompt').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(min-width:761px)').matches) { e.preventDefault(); ask(el('prompt').value); } };
  el('prompt').oninput = () => { el('prompt').style.height = 'auto'; el('prompt').style.height = Math.min(el('prompt').scrollHeight, 160) + 'px'; };
  el('conversationSelect').onchange = async () => { if (busy) return; activeChat = el('conversationSelect').value; messageLimit = 80; renderMessages(); await persist(); };
  el('newChat').onclick = el('newConversation').onclick = newConversation;
  el('search').oninput = renderDocs; el('addFiles').onclick = () => el('filePicker').click();
  el('filePicker').onchange = () => addFiles([...el('filePicker').files]);
  el('folderPicker').onchange = () => addFiles([...el('folderPicker').files], true);
  el('createNote').onclick = () => openNote(view); el('noteForm').onsubmit = keepNote;
  el('cancelNote').onclick = () => el('noteDialog').close(); el('closeReader').onclick = () => el('readerDialog').close();
  el('readerDownload').onclick = () => reader && saveDocument(reader);
  el('readerNote').onclick = () => { if (!reader || busy) return; el('readerDialog').close(); openNote(reader.kind, reader.text, reader); };
  el('openFolder').onclick = attachFolder;
  el('saveCopy').onclick = () => { if (!busy) el('modelDialog').showModal(); };
  el('saveUnsaved').onclick = saveRoom;
  el('modelForm').onsubmit = saveModel;
  el('cancelModel').onclick = () => el('modelDialog').close();
  el('restoreCopy').onclick = () => el('restorePicker').click(); el('restorePicker').onchange = restoreRoom;
  el('savePrevious').onclick = () => { if (previousRoom) download(JSON.stringify(previousRoom), dated('Quant-previous-room', 'quant'), 'application/json'); };
  el('saveBook').onclick = () => {
    const rows = [...quant.book.records.values()];
    const text = [...new Set(rows.map(r => r.raw).filter(Boolean))].join('\n').slice(0, MAX_FILE / 2);
    download(QuantBook.encode('Quant Continuity', text, rows), dated('quant-continuity', 'quantbook'));
  };
  el('saveTerrain').onclick = () => download(quant.qt.exportText(), dated('quant-terrain', 'qt'));
  el('exportChat').onclick = () => download(current().messages.map(m => (m.role === 'user' ? 'You' : 'Quant') + ': ' + m.text).join('\n\n'), dated('Quant-conversation', 'txt'));
  el('printChat').onclick = () => { messageLimit = current().messages.length; renderMessages(); show('chat'); window.print(); };
  el('scanRules').onclick = async () => { if (busy) return; quant.rule_candidates = QuantCore.ruleCandidates(docs.filter(d => activeBookIDs.includes(d.id) || activeContextIDs.includes(d.id)).map(d => d.text)); renderRules(); await persist(); };
  el('chooseRules').onclick = async () => {
    if (busy) return; lock(true);
    try {
      const ids = [...el('ruleChoices').querySelectorAll('input:checked')].map(n => Number(n.value));
      const next = cloneQuant(); next.selectRules(ids);
      rebindMemory(next, docs, docs, activeBookIDs, activeContextIDs);
      quant = next; await persist(); toast('Five grammar choices kept. His sources have been reparsed.');
    } catch (e) { toast(e.message); } finally { lock(false); }
  };
  window.addEventListener('beforeunload', e => { if (persistFailed || busy) { e.preventDefault(); e.returnValue = ''; } });
  async function init() {
    lock(true);
    try {
      db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('quant-anything-offline', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('room'); r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error); r.onblocked = () => reject(Error('Storage is blocked by another window.'));
      });
      db.onversionchange = () => { db.close(); db = null; storageError(); };
      const saved = await dbRead('current'); storageToken = saved?.writeToken || null;
      if (saved) applyValidated(validateSnapshot(saved), saved.revision); else await dbWrite(clone(snapshot()));
      const backup = await dbRead('previous');
      if (backup) { try { validateSnapshot(backup); previousRoom = backup; } catch { /* A damaged backup never replaces the live room. */ } }
      status('Kept in this browser');
    } catch (e) {
      // Do not replace unreadable saved data with the seed room on a later write.
      if (db) { db.close(); db = null; } storageError(e);
    }
    renderMessages(); updateStats(); show('home'); lock(false);
  }
  init();
})();
