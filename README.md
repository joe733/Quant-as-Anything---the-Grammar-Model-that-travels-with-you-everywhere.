<div align="center">

# Quant... as himself.

### a small local grammar model that travels with you everywhere

**One resident. Many places. No remote model required.**

</div>

---

## What Quant is

Quant is a local resident language system from **Fiduci Group** designed around a simple public idea:

> **the resident can stay small while the world around him gets large.**

A project, folder, archive, notebook or app can become a *place* Quant reads locally. The place can change. Quant does not need to become the place in order to work there.

The public repository contains a deliberately compact, working reference edition. It demonstrates the product contract without publishing Fiduci's private implementation, protected grammar, production memory structures, resident knowledge, or internal reasoning machinery.

That is intentional.

## Try the public reference

Requires Python 3. No packages to install.

```bash
python3 code/quant.py
```

Or run the local interface:

```bash
python3 code/quant.py --serve
```

Then open:

```text
http://127.0.0.1:8765/design/
```

The reference server binds to **localhost**. It does not call a remote language model.

In terminal mode, prefix a line with `+ ` to deliberately add it to the current local place:

```text
+ Dogs are loyal companions.
Are dogs loyal?
```

## Public denominations

The public code uses deliberately plain denominations such as:

- **Resident** — the local Quant process
- **Place** — material deliberately available to the resident
- **Read** — preserve the grammatical shape of an input
- **Find** — locate locally relevant material
- **Speak** — produce the public response

These names describe the observable contract. They are **not a specification of Fiduci's private implementation**.

## Quant... as anything

The interface can change without requiring Quant to become a different resident:

```text
macOS app    local page    terminal    SDK    project folder
     \           |           |         |          /
                      Quant
```

The surface changes. The place changes.

**Quant remains Quant.**

## Privacy by default

The public reference is intentionally boring about privacy:

- no remote model provider
- no analytics or telemetry
- no account required
- localhost-only server
- no automatic document ingestion
- material becomes part of the local place only when deliberately added

Production/private Quant builds may provide richer local capabilities, but the same privacy principle remains: **your environment is not a prerequisite for somebody else's server.**

## A note on protected terminology and implementation

Fiduci's research includes named concepts, grammar-model methods, storage formats, and related technical language that may be subject to intellectual-property rights, patent applications, copyright, trade-secret protection, licence terms, or other protections depending on jurisdiction and status.

This repository does not waive those rights and should not be read as publishing the full production method. Protected terminology may appear descriptively because it belongs to the project; implementation detail is intentionally reduced or represented through public denominations.

For licensing or implementation enquiries: **support@fiducigroup.com**

## Repository map

```text
README.md
assets/
design/       local conversational surface
code/         working public reference runtime
docs/         public architecture boundary
.github/      smoke tests
```

---

<div align="center">

### Quant... as himself.

*small enough to make a difference, for the better.*

</div>
