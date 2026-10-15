# Zero-Weight Cognitive Retrieval Engine — executable prototype

A provenance-bound, deterministic knowledge engine separating **knowledge storage** from **language realisation**.

## What is implemented

- Qualified claims rather than naked triples
- Evidence and source provenance
- Source-diversity-aware reconciliation
- Explicit contradiction preservation
- Abstention when no claim exists
- Deterministic natural-language realisation (no LLM required)
- Conservative rule extraction with simple negation guard
- SQLite executable backend for sandbox testing
- Storage interface designed to be replaced by DuckDB + Parquet/Arrow in production

## Run

```bash
python -m unittest discover -s tests -v
python demo.py
python benchmark.py -n 100000
```

## Production storage substitution

Replace `SQLiteClaimStore` with an implementation preserving `add_many()`, `query()`, and `count()` using:

- Arrow RecordBatch at ingestion boundaries
- partitioned Parquet for durable claims
- DuckDB for predicate/projection pushdown and local analytical querying

`requirements-production.txt` lists the production packages. They were not downloadable in the execution sandbox, so the tested reference backend uses Python's built-in SQLite.

## Important scope

This prototype demonstrates the cognitive contract, not the public-web crawler. Internet crawling requires robots.txt/rate-limit/legal handling and is deliberately separated from the reasoning core.
