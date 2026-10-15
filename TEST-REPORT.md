# Checks for Quant macOS source build 5

Executed on the Linux workspace on 15 October 2026. No Playwright, browser automation, dependency downloads or live website requests were used.

| Check | Result | Scope |
| --- | --- | --- |
| Book selection, import, portable JSON save/load and source rebinding | 13 passed | Exact bundled functions, lightweight DOM stand-ins; no real IndexedDB |
| Original engine | 5 passed | Empty-room uncertainty, grounded provenance, snapshot restoration, Book roundtrip, tamper rejection |
| URL/navigation policy | 60 passed | Exact bundled JavaScript |
| Non-GET methods | 10 denied | Exact bundled JavaScript |
| Hostile HTML inputs | 140 passed | Sanitizer output assertions; inputs are transformed, not all rejected outright |
| Quant-render fixtures | 32 passed | Serializer output assertions; separate from the 32 active-Book capacity |
| Independent HTML parsing | 173 default-deny outputs + 1 explicit-script output passed | lxml, not a live browser |
| JavaScript syntax | 10 files passed | Node syntax parser |
| Local resource links | 40 passed | Files present, not visual layout verification |
| Resource pins | 81 passed | Every resource hash matches the Swift manifest |
| Original resource preservation | 68 byte-identical, 9 modified, zero missing | Exact paths recorded in RESTORATION.json |
| Shell command syntax and plist data | Passed | Not actual macOS command execution |

The checked Book workflow accepts 32 selected Books, rejects a 33rd selection, retains an unselected 33rd imported document, frees a selection slot when a Book is set aside, restores all 32 small fixture sources and their provenance, and retains compatibility with old three-Book snapshots. It rejects invalid selections and four Contexts. It also checks moving a Book into Artifacts. This does not imply unlimited memory: the original resident keeps at most 800 Book relations and 24,000 terrain relations.

The original resident engine, Book codec, Room stylesheet, canonical Python source and original artwork are byte-identical to the available source archive. Room selection logic, selected explanatory text, Studio handling and native host/build scripts were intentionally changed. Two local opening films are present. These checks do not demonstrate appearance on a Mac.

Not run: Swift compilation, macOS launch, real IndexedDB persistence, native open/save dialogs, native view/draft transitions, movie playback, real WebKit page JavaScript execution, live GET/redirect behavior, visual acceptance, Apple Developer ID signing, notarization, Windows/Android/iPhone/Linux builds or device acceptance. The signing script is prepared source and has only been shell-syntax checked.

Currently absent from this workspace: Quant-as-Astronomer.py, Quant-Complete-macOS-Xcode.zip and Quant-macOS-Browser-Project.zip. Their full inclusion and parity cannot be asserted. MQB execution, encrypted keys and external integrations remain unimplemented. Source fixtures and hashes are not an absolute-safety certificate.

To repeat the executed code checks with existing Node/Python/lxml: run `node Tests/policy.cjs`, `node Tests/restored-engine.cjs`, `node Tests/books.cjs`, then `python3 Tests/source-checks.py`. These tests do not need network access. Building with Start-Quant.command is the separate Mac gate.
