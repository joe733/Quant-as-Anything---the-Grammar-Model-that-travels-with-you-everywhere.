# Design variants

Quant should feel less like a dashboard and more like a place where attention can gather.

The repository now carries three deliberately restrained surfaces for the same resident Quant.

## Cosmic — `index.html`

The original field: sparse particles, soft depth and nearly-static drift.

- **Being** — almost still.
- **Attending** — the field gathers energy.
- **Speaking** — movement loosens as the answer arrives.
- **Settling** — the surface returns to near-stillness.

This is the most atmospheric version.

## Still — `still.html`

The most minimal version.

Typography, spacing, a single pulse, and almost nothing else. It is intended for overlays, small windows, and situations where Quant should sit quietly beside other work rather than occupy the whole screen.

## Line — `line.html`

A thin architectural variant.

A faint frame, horizon, central cross, restrained borders, and no particle field. It keeps a little visual structure without turning the surface into interface chrome.

## Shared rules

All three variants are dependency-free and can talk to the local reference runtime at `http://127.0.0.1:8765`.

Their public contract stays intentionally small:

```text
reply
state
```

Backend parser structures, hashes, provenance machinery, belief state, Municipality internals, and diagnostic traces do not belong in ordinary Quant prose.

The surfaces may vary. **Quant remains Quant.**

## On Quant as Quell

Quell's exact source/design repository was not available through the connected GitHub account when these variants were added, so none of these files claims to reproduce her design language. If her source is connected later, her actual motifs can be studied and incorporated with provenance rather than imitated from memory.
