from zwe import Claim, SQLiteClaimStore, ZeroWeightEngine

store = SQLiteClaimStore(":memory:")
store.add_many([
    Claim("CONCEPT_BATTERY_LI", "hasPriceDrop", "14%", "report-A", "Battery prices dropped 14%", observed_at="2026-09-20", confidence=.94),
    Claim("CONCEPT_BATTERY_LI", "hasPriceDrop", "14%", "report-B", "A 14% decline was observed", observed_at="2026-09-21", confidence=.91),
    Claim("CONCEPT_BATTERY_LI", "hasPriceDrop", "11%", "report-C", "Battery costs fell 11%", observed_at="2026-09-22", confidence=.98),
])
engine = ZeroWeightEngine(store)
result = engine.ask("CONCEPT_BATTERY_LI", "hasPriceDrop")
print(result["answer"])
print(result["resolution"])
