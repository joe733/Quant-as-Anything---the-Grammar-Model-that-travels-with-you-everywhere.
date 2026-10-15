# Quant release security review — 13 October 2026

## Scope and result

The review covered the source projects and the local testable policy/engine paths. No critical issue was found in those checks. This is **not** a native build or a security certification: macOS, Windows, Android and iPhone binaries have not been compiled or run in this environment, and the Cloudflare site has not been deployed. Public executable downloads should wait for the platform checks below.

## Checks completed

| Area | Observed result |
| --- | --- |
| Anything reference | Python self-test passed. The JavaScript port was exercised for the same core answer and engine behavior. Its optional Python provider is excluded from the app runtime. |
| Books and room | Three `quantbook/v1` files decoded and their records entered the selected Book store. Tampering failed the SHA-256 check. Export/import, Context reflection replacement, deselection, answer, snapshot validation and provenance continuity passed. The checksum detects accidental or unsophisticated alteration; it does not prove who created a Book. |
| Desktop browser policy | Mac and Windows JavaScript tests each passed 60 URL/navigation cases, 19 POST scenarios with 33 assertions, 140 hostile HTML fixtures and 32 local Quant render fixtures. The native projects hold the web switch off initially, use HTTPS native requests, prohibit automatic redirects and require a separate, one-use POST review. Tests did not visit adversarial sites or run WebKit/WebView2 on the target OS. |
| Bundled desktop resources | All 77 Mac and 45 Windows resource hashes match their generated pins. The source files are inspectable; the pins are integrity checks for the packaged build, not publisher signatures. |
| Mobile boundaries | Android has no Internet permission, blocks network loads in its WebView and accepts user-picked files. iPhone rejects non-bundle navigation, attaches a WebKit HTTP(S) block list before loading the local room, and displays saved-page text outside the WebView. The native bridges only save text from the trusted local page, with an 8 MB limit. These behaviors still need device verification. |
| Website | Static pages have no script, frames, ads, trackers or form collection. Download routes allow only five exact R2 object keys and GET. Contribution redirects allow only configured HTTPS Stripe hosts, never forward visitor query parameters, and keep monthly options closed until delivery is ready. Route tests passed. |

## Issues fixed during this pass

- Replaced the earlier small starter resident with the fuller Anything browser port in each current Room, and included three typed Books and Context templates.
- Changed the Mac starter installer to copy the checked current Book set while retaining older bundled material as provenance.
- Fixed the iPhone saved-room confirmation path and made its About page describe the offline mobile reader accurately.
- Kept subscriptions closed until fulfillment is available and payment links are configured. Missing R2 objects return an unavailable response.
- Removed unqualified “open source” language because no redistribution license has been selected. Source is available for inspection; distribution rights for bundled artwork and dependencies need confirmation before a public license is attached.

## Required before a public binary release

1. Build each native target with its platform SDK, then run its own native checks and test real file selection, saved-room restore, Book export/import, persistence after force quit, accessibility and error recovery. Test HTTPS reader, redirects, POST review and rendering against controlled hostile pages on Mac and Windows.
2. Sign and notarise or provision the four binaries using the project owner's identities. Recompute release hashes from the **actual signed artifacts**; the supplied ZIP digests describe source packages only.
3. Review the supplied artwork and source provenance, select a redistribution license, and verify the payment products, AUD amounts, cancellation and research delivery promises before opening hosted checkouts.
4. Deploy Pages Functions with the R2 binding, upload the exact ZIPs, configure the domain and payment links, then test downloads and contributions over HTTPS. Until then the source ZIPs are available separately; the public routes have not been verified.

Local room data is not separately encrypted by Quant. A user's deliberate native GET or reviewed POST contacts the chosen site; the hosted contribution checkout is a separate service and cannot access the local room.
