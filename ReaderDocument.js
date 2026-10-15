/* Text extraction and a conservative design serializer. No DOM, imports or I/O. */
'use strict';
const PageReader = (() => {
  const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',copy:'©'};
  const decode = s => s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, value) => {
    if (value[0] !== '#') return Object.prototype.hasOwnProperty.call(entities,value.toLowerCase()) ? entities[value.toLowerCase()] : whole;
    const number = value[1].toLowerCase() === 'x' ? parseInt(value.slice(2),16) : parseInt(value.slice(1),10);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '�';
  });
  const escape = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function read(input) {
    if (!input || typeof input.source !== 'string' || input.source.length > 8 * 1024 * 1024) throw Error('Document exceeds the reader limit.');
    if (input.mime === 'text/plain') return {text:input.source, links:[], routes:[]};
    const source = input.source, lower = source.toLowerCase();
    const output = [], links = [], routes = [];
    let i = 0, activeRoute = null;
    while (i < source.length) {
      if (source[i] !== '<') {
        let end = source.indexOf('<',i); if (end < 0) end = source.length;
        output.push(decode(source.slice(i,end))); i = end; continue;
      }
      if (source.startsWith('<!--',i)) { const end=source.indexOf('-->',i+4); i=end < 0 ? source.length : end+3; continue; }
      // Scan quoted attributes without interpreting markup as executable HTML.
      let end=i+1, quote='';
      for (;end<source.length;end++) { const c=source[end]; if (quote) { if(c===quote)quote=''; } else if(c==='"'||c==="'")quote=c; else if(c==='>')break; }
      if(end===source.length) { output.push(source.slice(i)); break; }
      const tag=source.slice(i+1,end), match=/^\s*(\/?)\s*([a-z][a-z0-9:-]*)/i.exec(tag); i=end+1;
      if(!match)continue;
      const name=match[2].toLowerCase(), closing=!!match[1];
      if(!closing && ['script','style','template','iframe','object','svg','math'].includes(name)) {
        let close=lower.indexOf('</'+name,i);
        while(close>=0 && /[a-z0-9:-]/i.test(lower[close+name.length+2]||''))close=lower.indexOf('</'+name,close+2);
        i=close<0 ? source.length : close; continue;
      }
      if(['p','div','br','hr','section','article','header','footer','nav','h1','h2','h3','h4','h5','h6','li','tr','pre','blockquote','title'].includes(name))output.push('\n');
      if(name==='td'||name==='th')output.push(' | ');
      if(closing && name==='a' && activeRoute) {
        const label=output.slice(activeRoute.start).join('').replace(/[ \t\r\f]+/g,' ').replace(/ *\n */g,' ').trim().slice(0,160);
        routes.push({href:activeRoute.href,label:label||activeRoute.href}); activeRoute=null;
      }
      if(!closing && name==='a' && links.length<200) {
        const attr=/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
        if(attr) { const href=decode(attr[1]??attr[2]??attr[3]??''); if(href.length<=4096) { links.push(href); activeRoute={href,start:output.length}; } }
      }
    }
    const unique=[], seen=new Set();
    for(const route of routes)if(!seen.has(route.href)){seen.add(route.href);unique.push(route);}
    return {text:output.join('').replace(/[ \t\r\f]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim(),links:[...new Set(links)],routes:unique};
  }
  function design(input) {
    const decision=BrowserPolicy.inspectURL(input?.url);
    if(!decision.allowed || typeof input.source!=='string' || input.source.length>8*1024*1024)throw Error('The design request is invalid.');
    const origin='https://'+decision.host;
    const csp="default-src 'none'; script-src 'none'; style-src 'unsafe-inline' "+origin+"; img-src "+origin+"; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri "+origin;
    const permitted=new Set('a abbr address article aside b blockquote br caption code col colgroup dd del details div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img label li link main mark nav ol p pre s section small span strong sub summary sup table tbody td th thead time tr u ul'.split(' '));
    const attributes=new Set('class id style title lang dir alt width height colspan rowspan aria-label role'.split(' '));
    const source=input.source, lower=source.toLowerCase(), result=[];
    let i=0;
    while(i<source.length) {
      if(source[i]!=='<') { let end=source.indexOf('<',i); if(end<0)end=source.length; result.push(escape(decode(source.slice(i,end)))); i=end; continue; }
      if(source.startsWith('<!--',i)) { const end=source.indexOf('-->',i+4); i=end<0?source.length:end+3; continue; }
      let end=i+1,quote='';
      for(;end<source.length;end++) { const c=source[end]; if(quote) { if(c===quote)quote=''; } else if(c==='"'||c==="'")quote=c; else if(c==='>')break; }
      if(end===source.length) { result.push(escape(source.slice(i))); break; }
      const raw=source.slice(i+1,end),match=/^\s*(\/?)\s*([a-z][a-z0-9:-]*)(?=\s|\/|$)/i.exec(raw); i=end+1;
      if(!match)continue;
      const name=match[2].toLowerCase(),closing=!!match[1];
      if(!closing && ['script','style','template','iframe','object','svg','math','textarea'].includes(name)) {
        let close=lower.indexOf('</'+name,i);
        while(close>=0 && /[a-z0-9:-]/i.test(lower[close+name.length+2]||''))close=lower.indexOf('</'+name,close+2);
        if(name==='style' && close>=0)result.push('<style>'+source.slice(i,close).replace(/</g,'\\3c ')+'</style>');
        i=close<0?source.length:close; continue;
      }
      if(!permitted.has(name))continue;
      if(closing) { if(!['br','hr','img','link','col'].includes(name))result.push('</'+name+'>'); continue; }
      const found=new Map(),rest=raw.slice(match[0].length);
      const pattern=/([^\s=/'"<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+)))?/g;
      let item;
      while((item=pattern.exec(rest))) { const key=item[1].toLowerCase(); if(!found.has(key))found.set(key,decode(item[2]??item[3]??item[4]??'')); }
      if(name==='link' && found.get('rel')?.toLowerCase()!=='stylesheet')continue;
      let output='<'+name;
      for(const [key,value] of found) {
        if(['src','href'].includes(key)) {
          if(/[\s\\\u0000-\u0020\u007f-\u009f]/.test(value))continue;
          const resource=(name==='img'&&key==='src')||(name==='link'&&key==='href');
          if(/^[a-z][a-z0-9+.-]*:/i.test(value)) { const checked=BrowserPolicy.inspectURL(value); if(!checked.allowed||(resource&&checked.host!==decision.host))continue; }
          if(value.startsWith('//')) { const checked=BrowserPolicy.inspectURL('https:'+value); if(!checked.allowed||(resource&&checked.host!==decision.host))continue; }
        }
        if(attributes.has(key)||(name==='a'&&key==='href')||(name==='img'&&key==='src')||(name==='link'&&['href','rel','media'].includes(key)))output+=' '+key+'="'+escape(value)+'"';
      }
      result.push(output+'>');
    }
    return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+escape(csp)+'"><meta name="referrer" content="no-referrer"><base href="'+escape(decision.url)+'"></head><body>'+result.join('')+'</body></html>';
  }
  function quant(input) {
    const decision=BrowserPolicy.inspectURL(input?.url), styles=new Set(['field','route','cards','quiet']);
    const assetRoots=new Set(['quant-asset://local','https://quant.local']);
    if(!decision.allowed || typeof input.text!=='string' || input.text.length===0 || input.text.length>500000 || !styles.has(input.style) || !assetRoots.has(input.assetRoot))throw Error('The local Quant render request is invalid.');
    if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(input.text))throw Error('Hidden control characters are not accepted in a Quant render.');
    const raw=input.text, lines=raw.split('\n'), first=lines.findIndex(line=>line.trim().length>0);
    const useTitle=first>=0 && lines[first].trim().length<=180;
    const title=useTitle?lines[first].trim():'A reading from '+decision.host;
    const bodyLines=useTitle?lines.filter((_,index)=>index!==first):lines;
    const paragraphs=bodyLines.join('\n').split(/\n{2,}/).map(value=>value.trim()).filter(Boolean);
    if(!paragraphs.length&&!useTitle)paragraphs.push(raw.trim());
    const labels={field:'FIELD NOTES',route:'ROUTE',cards:'INDEX CARDS',quiet:'QUIET PAGE'};
    const motifs=['quant-art-06.png','quant-art-07.png','quant-art-08.png'];
    const asset=name=>input.assetRoot+'/'+name;
    const blocks=paragraphs.map((value,index)=>'<section class="note"><div class="index">'+String(index+1).padStart(2,'0')+'</div><div class="copy">'+escape(value).replace(/\n/g,'<br>')+'</div><img class="motif" src="'+asset(motifs[index%motifs.length])+'" alt="" aria-hidden="true"></section>').join('');
    const acceptedRoutes=[];
    if(Array.isArray(input.routes))for(const route of input.routes.slice(0,80)) {
      const checked=BrowserPolicy.inspectURL(route?.url);
      if(!checked.allowed || typeof route.label!=='string' || !route.label.trim())continue;
      acceptedRoutes.push({url:checked.url,label:route.label.trim().slice(0,160)});
    }
    const routes=acceptedRoutes.length?'<nav class="routes" aria-label="Links from this reading"><div class="routeLabel">CONTINUE WITH A FRESH GET</div>'+acceptedRoutes.map(route=>'<a href="'+escape(route.url)+'">'+escape(route.label)+'</a>').join('')+'</nav>':'';
    const words=(raw.match(/\S+/g)||[]).length;
    const csp="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src "+input.assetRoot+"; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
    const css=`
      :root{--ink:#181817;--muted:#6c665c;--paper:#efe4cf;--paper2:#e5d5b9;--line:rgba(24,24,23,.34);--soft:rgba(255,255,255,.28)}
      *{box-sizing:border-box}html{background:#d7c8ad;color:var(--ink)}body{margin:0;min-height:100vh;font-family:Georgia,'Times New Roman',serif;background:radial-gradient(circle at 18% 10%,rgba(255,255,255,.48),transparent 27rem),repeating-linear-gradient(3deg,rgba(45,39,31,.018) 0,rgba(45,39,31,.018) 1px,transparent 1px,transparent 5px),var(--paper);letter-spacing:.005em}
      body:before{content:'';position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 90px rgba(63,45,21,.10)}
      .page{width:min(1040px,calc(100% - 40px));margin:auto;padding:38px 0 66px}.mast{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding-bottom:20px;border-bottom:1px solid var(--ink)}
      .mark{width:66px;height:66px;object-fit:contain;filter:grayscale(1) contrast(1.12);mix-blend-mode:multiply}
      .eyebrow,.source,.seal,.kicker,.index,.promise,.meta{font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.17em}.eyebrow{font-size:12px;font-weight:700}.source{font-size:10px;margin-top:7px;color:var(--muted);letter-spacing:.1em}.seal{font-size:9px;line-height:1.45;text-align:center;border:1px solid var(--ink);border-radius:999px;padding:10px 14px;max-width:170px}.hero{padding:64px 0 42px;position:relative}.kicker{font-size:10px;margin-bottom:16px}.hero h1{font-size:clamp(42px,7vw,78px);font-weight:400;line-height:.98;max-width:850px;margin:0;letter-spacing:-.035em}.promise{font-size:9px;line-height:1.7;color:var(--muted);margin:24px 0 0}.rule{height:10px;border-top:1px solid var(--ink);border-bottom:1px solid var(--line);margin-bottom:26px;position:relative}.rule:after{content:'◆';position:absolute;right:0;top:-11px;background:var(--paper);padding-left:10px;font-size:12px}
      .notes{display:grid;gap:0}.note{display:grid;grid-template-columns:58px minmax(0,1fr) 76px;gap:18px;padding:26px 0;border-top:1px solid var(--line);break-inside:avoid}.note:first-child{border-top:0}.index{font-size:10px;padding-top:5px;color:var(--muted)}.copy{font-size:20px;line-height:1.62;max-width:760px;overflow-wrap:anywhere}.motif{width:70px;height:70px;object-fit:contain;opacity:.66;filter:grayscale(1) contrast(1.12);mix-blend-mode:multiply;align-self:start}footer{margin-top:50px;padding-top:18px;border-top:1px solid var(--ink);display:flex;justify-content:space-between;gap:20px}.meta{font-size:9px;color:var(--muted);line-height:1.6}
      .route .notes{position:relative;padding-left:30px}.route .notes:before{content:'';position:absolute;left:7px;top:12px;bottom:12px;border-left:1px solid var(--ink)}.route .note{position:relative;border:0;padding:20px 0 30px}.route .note:before{content:'';position:absolute;left:-30px;top:25px;width:11px;height:11px;background:var(--paper);border:2px solid var(--ink);border-radius:50%}.route .note:nth-child(3n):before{background:var(--ink)}.route .index{border:1px solid var(--ink);border-radius:999px;text-align:center;padding:5px 6px;height:25px}
      .cards .notes{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.cards .note{display:grid;grid-template-columns:1fr auto;border:1px solid var(--ink);padding:26px;min-height:180px;background:var(--soft);box-shadow:5px 5px 0 rgba(24,24,23,.10)}.cards .index{grid-column:1;display:inline-block;border:1px solid var(--ink);border-radius:999px;padding:5px 8px;margin-bottom:22px;width:max-content}.cards .copy{grid-column:1;font-size:18px}.cards .motif{grid-column:2;grid-row:1/3;margin-left:18px}
      .quiet .mast{border-color:var(--line)}.quiet .seal,.quiet .rule:after,.quiet .index,.quiet .motif{display:none}.quiet .page{width:min(760px,calc(100% - 40px))}.quiet .hero{padding-top:90px}.quiet .hero h1{font-size:clamp(40px,7vw,66px)}.quiet .note{display:block;padding:21px 0}.quiet .copy{font-size:21px;line-height:1.75}.quiet .rule{border-bottom:0}
      .routes{margin-top:48px;padding:26px 0;border-top:1px solid var(--ink);border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:10px}.routeLabel{width:100%;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:.17em;margin-bottom:4px}.routes a{display:inline-block;color:var(--ink);text-decoration:none;border:1px solid var(--ink);border-radius:999px;padding:9px 14px;font-size:13px;background:rgba(255,255,255,.2)}.routes a:first-of-type{background:var(--ink);color:var(--paper)}
      @media(max-width:680px){.page{width:min(100% - 24px,1040px);padding-top:18px}.mast{grid-template-columns:auto 1fr}.seal{display:none}.mark{width:52px;height:52px}.hero{padding:44px 0 30px}.hero h1{font-size:42px}.cards .notes{grid-template-columns:1fr}.note{grid-template-columns:40px minmax(0,1fr);gap:10px}.motif{display:none}.copy{font-size:18px}.route .note{grid-template-columns:45px minmax(0,1fr)}footer{display:block}.meta+ .meta{margin-top:8px}}
      @media print{body{background:#fff}.page{width:auto;padding:0 14mm}.seal{border-color:#000}.note{break-inside:avoid}}
    `;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+escape(csp)+'"><meta name="referrer" content="no-referrer"><title>'+escape(title)+'</title><style>'+css+'</style></head><body><main class="page '+input.style+'"><header class="mast"><img class="mark" src="'+asset('quant-art-04.png')+'" alt="Quant"><div><div class="eyebrow">QUANT / REBUILT VIEW</div><div class="source">'+escape(decision.host)+'</div></div><div class="seal">ON DEVICE<br>ONE PAGE<br>YOUR CHOICE</div></header><div class="hero"><div class="kicker">01 / '+labels[input.style]+'</div><h1>'+escape(title)+'</h1><div class="promise">SOURCE WORDING PRESERVED · NO PAGE CODE · ORIGINAL QUANT ASSETS · USER-CHOSEN GET REFRESH</div></div><div class="rule"></div><article class="notes">'+blocks+'</article>'+routes+'<footer><div class="meta">QUANT AS ANYTHING<br>REBUILT LOCALLY</div><div class="meta">'+paragraphs.length+' SECTIONS / '+words+' WORDS<br>DESIGN APPROVED FOR THIS PAGE</div></footer></main></body></html>';
  }
  function scripted(input) {
    if (!/^[a-f0-9-]{36}$/i.test(input?.nonce || '')) throw Error('Invalid page approval.');
    let html = design(input);
    const scripts = [];
    const lockdown = `(function(){
      const blocked=['RTCPeerConnection','webkitRTCPeerConnection','WebTransport','WebSocket','Worker','SharedWorker','EventSource','XMLHttpRequest','fetch'];
      for(const name of blocked) if(!Reflect.defineProperty(globalThis,name,{value:undefined,writable:false,configurable:false})) throw Error('Script isolation unavailable');
      if(!Reflect.defineProperty(navigator,'sendBeacon',{value:undefined,writable:false,configurable:false})) throw Error('Beacon isolation unavailable');
    })();`;
    const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    let match;
    while ((match = pattern.exec(input.source)) && scripts.length < 32) {
      if (/\bsrc\s*=/i.test(match[1])) continue;
      const type = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[1]);
      if (type && !['', 'text/javascript', 'application/javascript'].includes((type[1] ?? type[2] ?? type[3] ?? '').toLowerCase())) continue;
      if (match[2].length > 65536) throw Error('An inline script exceeded the review limit.');
      scripts.push(match[2].replace(/<\/script/gi, '<\\/script'));
    }
    html = html.replace("script-src &#39;none&#39;", "script-src &#39;nonce-" + input.nonce + "&#39;");
    return html.replace('</body>', '<script nonce="' + input.nonce + '">' + lockdown + '\n' + scripts.join('\n;\n') + '</script></body>');
  }
  return Object.freeze({read,design,quant,scripted});
})();

/* Native controls are the only callers. No website has a handle to this object. */
