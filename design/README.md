# Design variant

The design surface is deliberately quiet.

It should feel less like a dashboard and more like a place where attention can gather.

## Behaviour

- **Idle** — nearly static drift.
- **Attending** — particles gather and the field gains energy.
- **Speaking** — movement opens outward as the response arrives.
- **Settling** — the surface returns to near-stillness.

The design is single-file and dependency-free. It can run on its own as a visual shell, or talk to the local Quant reference runtime at `http://127.0.0.1:8765`.

The public surface intentionally receives only clean prose plus a small state label. Internal parser, provenance, belief, and diagnostic structures belong elsewhere.
