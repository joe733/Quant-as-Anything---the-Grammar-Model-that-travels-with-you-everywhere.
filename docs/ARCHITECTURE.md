# Public architecture boundary

This document describes **what the public Quant reference promises**, not the private production implementation.

## Resident + place

Quant is presented publicly as a small resident that can work with material available in a local place.

```text
local input
   ↓
read
   ↓
resident + place
   ↓
find what is relevant
   ↓
speak
```

The production system may use additional protected grammar, memory, provenance, storage, safety and inference mechanisms. Those mechanisms are deliberately not specified here.

## Public guarantees of the reference edition

- local execution
- standard-library Python
- localhost-only optional web server
- no remote language-model dependency
- deliberate rather than silent addition of local material
- grammatical cues such as questions and explicit negation are preserved in the public behaviour
- absence of local evidence is surfaced rather than replaced with invented factual certainty

## Public denominations are not production names

Words such as `Resident`, `Place`, `Read`, `Find`, and `Speak` are explanatory handles for the open reference build. They intentionally avoid disclosing private internal names or defining equivalence to any protected production component.

## Portability

"Quant as Anything" refers to the resident contract being portable across surfaces: terminal, local webpage, desktop application, SDK, or other local environment.

A surface is not the resident's identity.

## Intellectual-property boundary

This repository is a working public demonstration, not an exhaustive disclosure of Fiduci Group's production Quant implementation or internal knowledge. Publication of this reference does not imply publication of non-included methods, grammar systems, data structures, resident knowledge, or protected implementation details.
