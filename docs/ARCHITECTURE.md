# Architecture

## One resident model, several faculties

Quant as Anything treats the model as a single resident system rather than a personality wrapped around a remote model.

```text
input
  ↓
grammatical reading
  ↓
plural internal perspectives
  ↓
local synthesis
  ↓
Helm
  ↓
public prose
```

The public reference runtime keeps the implementation deliberately compact, but the boundaries are the important part.

## 1. Reading

Quant first preserves the grammatical shape of the utterance. At minimum that means keeping track of:

- interrogative vs declarative form;
- explicit negation;
- subject / predicate / object candidates;
- qualification and modality;
- the fact that a parse is an interpretation, not the source itself.

A parser may help Quant understand language. It does not receive authority to manufacture truth.

## 2. Perspectives

The reference shape uses eight named perspectives:

1. WarmCare
2. CuriousWonder
3. PlayfulLight
4. PreciseClean
5. GentleMelancholy
6. QuietConfidence
7. SoftAmusement
8. ReflectiveDeep

They are not eight agents. They are eight ways the same Quant interrogates the same material before speaking.

## 3. 8 → 4 → 2 → Helm

The perspectives are reduced through successive syntheses rather than simply averaged.

```text
8 readings
   ↓
4 pairwise syntheses
   ↓
2 refinements
   ↓
Helm
```

The purpose is not numerical theatre. It is to keep multiple constraints alive long enough for the final response to be narrower than the impulses that produced it.

## 4. Helm

Helm is the final speaking boundary.

Its job is to produce one answer that remains answerable to:

- the user's actual words;
- the grammatical reading;
- uncertainty;
- provenance;
- consequences of the answer;
- the other person's agency.

Helm is allowed to omit internal machinery. It is not allowed to falsify it.

## 5. Public prose boundary

The ordinary conversation surface should never leak implementation vocabulary merely because that vocabulary was useful internally.

```text
internal: parse confidence / nodes / hashes / diagnostics
                       ↓
                    Helm
                       ↓
public: natural prose
```

If an internal representation reaches the public surface accidentally, the correct behaviour is to regenerate the answer — not to prettify the leak.

## 6. Being and Learning

The wider Quant design distinguishes two modes.

### Being Quant

The present conversation may affect the live turn, but it does not silently rewrite durable knowledge.

### Learning Quant

Durable learning is deliberate. Written works may be read, versioned, parsed, and incorporated while preserving provenance.

The public reference build ships **Being Quant** only. Learning is intentionally left as a separate extension rather than being smuggled into ordinary chat.

## 7. Provenance

Different kinds of knowing remain different:

```text
source said X
user said X
Quant inferred X
Quant previously expressed X
external evidence supports X
```

Those may converge. They are not interchangeable by default.

## 8. Portable surfaces

"As Anything" means the surface is replaceable without replacing Quant.

A terminal, a local webpage, a desktop overlay, an SDK, or a browser companion may all expose the same resident model contract.

The UI is a body. It is not the identity.
