from __future__ import annotations
import argparse, os, resource, tempfile, time
from zwe import Claim, SQLiteClaimStore, ZeroWeightEngine

def rss_mb():
    # Linux ru_maxrss is KiB
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024

def main(n: int):
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, "claims.db")
        store = SQLiteClaimStore(path)
        batch = []
        start = time.perf_counter()
        for i in range(n):
            subject = f"ENTITY_{i % 10000}"
            obj = f"{i % 101}%"
            batch.append(Claim(subject, "hasMetric", obj, f"source_{i % 1000}", f"evidence {i}", confidence=.8 + (i % 20)/100))
            if len(batch) >= 5000:
                store.add_many(batch); batch.clear()
        if batch: store.add_many(batch)
        ingest_s = time.perf_counter() - start
        engine = ZeroWeightEngine(store)
        q0 = time.perf_counter()
        for i in range(1000):
            engine.ask(f"ENTITY_{i % 10000}", "hasMetric")
        query_s = time.perf_counter() - q0
        size_mb = os.path.getsize(path) / (1024*1024)
        print(f"claims={store.count()}")
        print(f"ingest_s={ingest_s:.4f}")
        print(f"ingest_claims_per_s={n/ingest_s:.1f}")
        print(f"queries=1000")
        print(f"query_total_s={query_s:.4f}")
        print(f"query_avg_ms={(query_s/1000)*1000:.4f}")
        print(f"db_size_mb={size_mb:.2f}")
        print(f"max_rss_mb={rss_mb():.2f}")

if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('-n', type=int, default=100000); a=p.parse_args(); main(a.n)
