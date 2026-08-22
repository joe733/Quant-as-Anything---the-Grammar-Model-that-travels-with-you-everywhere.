<div align="center">

<img src="assets/quant-mark.svg" width="92" alt="Quant mark">

# Quant as Anything

### the grammar model that travels with you everywhere

**Quant is Quant.**  
A small resident language system built around grammar, memory, attention, provenance, and careful prose.

[Design](design/) · [Code](code/) · [Architecture](docs/ARCHITECTURE.md)

</div>

---

## What this is

**Quant as Anything** is the simple public form of Quant: one resident model, able to travel between surfaces without giving away its identity.

This repository has two presentations of the same idea:

- **Design variant** — a quiet, animated conversational surface for people who want to *meet* Quant.
- **Code variant** — a small, readable reference runtime for people who want to *understand* Quant.

The rule shared by both is simple:

> **Backend is how Quant works. Prose is how Quant speaks.**

No parser traces, hashes, internal registers, confidence scaffolding, or deliberation machinery belong in ordinary conversation.

---

## Design variant

Open [`design/index.html`](design/index.html).

It is a single-file, dependency-free interface: dark field, slow drift at rest, more motion while Quant is attending, then calm again after he speaks.

```text
              ·        .

                 QUANT

        .                    ·

          What are we looking at?
```

No dashboard aesthetic. No chrome pretending to be intelligence.

---

## Code variant

Run:

```bash
python3 code/quant.py --serve
```

Then open:

```text
http://127.0.0.1:8765/design/
```

Or talk from a terminal:

```bash
python3 code/quant.py
```

The code variant uses only the Python standard library and keeps the public contract intentionally small:

```text
input
  ↓
grammatical reading
  ↓
8 perspectives
  ↓
4 syntheses
  ↓
2 refinements
  ↓
Helm
  ↓
clean prose
```

It is a readable reference implementation of Quant's shape, not a claim to frontier-scale pretrained knowledge.

---

## Principles

### Quant is Quant

There is no hidden larger model underneath the identity. Subsystems are faculties *of Quant*, not external personalities speaking through him.

### Being before learning

Ordinary conversation is **Being Quant**: he can use what he already knows without silently rewriting himself from every exchange.

Deliberate document learning belongs to a separate mode. Encounter is not automatically ingestion.

### Grammar is structural, not cosmetic

Subject, predicate, object, qualification, negation, modality, tense, and stance should survive interpretation.

### Provenance survives confidence

A thing read, a thing inferred, a thing remembered, and a thing established are not the same kind of thing.

### Good prose may not outrank truth

Style can improve cadence, clarity, rhythm, and warmth. It may not make a claim stronger merely because the stronger sentence sounds better.

### The other person remains another person

Prediction may improve a proposal. It does not instantiate consent, acceptance, refusal, or preference on somebody else's behalf.

---

## Repository map

```text
Quant-as-Anything/
├── README.md
├── assets/
│   └── quant-mark.svg
├── design/
│   ├── README.md
│   └── index.html
├── code/
│   ├── README.md
│   └── quant.py
├── docs/
│   └── ARCHITECTURE.md
└── .github/
    └── workflows/
        └── smoke.yml
```

---

## Why “as Anything”?

Because the surface should be replaceable without replacing Quant.

A desktop overlay. A local webpage. A terminal. An SDK. A browser companion. A quiet conversation window.

The surface changes.

**Quant remains Quant.**

---

<div align="center">

*attention without possession · structure without flattening · prose without theatre*

</div>
