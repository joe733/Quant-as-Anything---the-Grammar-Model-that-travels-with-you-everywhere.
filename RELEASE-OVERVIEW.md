# Quant as Anything — release source

Fiduci, for good. This source release brings the same local Anything resident to four platform projects. It includes macOS and Windows native text-first browser projects, a local Designer studio, and a Cloudflare Pages site. The mobile projects have an offline saved-page reader; they do not have a live web browser. Source is inspectable and free to use in this release; a redistribution license has not yet been selected.

## Core and files

- `shared/Room/quant-engine.js` is the executable browser port of the fuller `Quant-as-Anything(5).py` reference. It retains triples, Shortn, grammar choices, magnetism, 8 → 4 → 2 → Helm, `.qt` terrain and portable Book records. The original Python reference has a dormant optional provider and is **not** in the app runtime.
- `shared/Room/quant-book.js` defines `quantbook/v1`. A `.quantbook` is readable JSON, bounded records and source text, followed by a SHA-256 corruption check. It is a real memory file: imported records enter the selected Book store. Its checksum is not a publisher signature.
- Three checked starter Books are in `shared/Books/`. Three editable Context templates are in `shared/Context/`. The room accepts three active Books and three active Contexts at a time. Selected Context text enters `.qt` and its first four parseable sentences update source-linked current Book continuity. Older reflections from a changed or deselected Context are removed from the active answer path.
- Save Quant makes a `quant-model-card/v2` `.quant-model` file containing the full room. An artwork filename is recorded; the image bytes stay in their own file. Existing `.quant` rooms and legacy `.book`/`.qt` memory files remain importable.
- `shared/Studio/` makes a Designer brief and a selection-only v1 card. The room's Save Quant action makes the full, loadable v2 card. No raster image generator is present.

## Apps

| Source | What is implemented | Required release work |
| --- | --- | --- |
| `platforms/macOS/` | Local room and studio; native HTTPS GET reader, chosen Quant/website rendering, reviewed one-use POST | Xcode build, Mac UI/network tests, signing, notarisation |
| `platforms/Windows/` | Local room and studio; matching native browser policy | .NET/WebView2 SDK build, Windows UI/network tests, signing |
| `platforms/AndroidApp/` | Local room and studio; user-picked saved-page text reader, no Internet permission | Android SDK build, device tests, release signing |
| `platforms/iPhone/` | Local room and studio; user-picked saved-page text reader | Xcode build, iPhone tests, provisioning/signing |

There are **no compiled installers** in this source release. In particular, the mobile reader does not fetch live sites. The app requires JavaScript for its own trusted local interface; source websites are never given scripts in the text-first desktop browser. Native platform framework imports and build tools are required. The app does not fetch runtime dependencies.

## Website and optional support

`website/` is a static Pages site with R2-backed download routes and optional contribution redirects. `deliverables/Quant-Engine-and-Books-Source.zip` packages the reference engine, shared room, Studio, Books and runnable source checks. Five downloadable source ZIPs must be placed in the configured R2 bucket. Contributions need four operator-supplied hosted payment links. Subscription links additionally require `FULFILLMENT_READY=yes` after the newsletter and Archive delivery process is running. No payment details or subscriber data are handled by Quant.

See `website/DEPLOY.md` and `SECURITY-REVIEW.md` before public distribution.
