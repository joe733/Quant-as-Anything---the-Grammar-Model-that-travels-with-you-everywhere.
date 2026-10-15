from __future__ import annotations
from collections import Counter, deque

class Daydreamer:
    """Autonomous cognition with no query target.

    Journal capture comes from recurrent wandering motifs only. Nothing is rewarded,
    punished, promoted to SELF, or automatically spoken.
    """
    def __init__(self, brain, window=24, min_unique=5, recurrence=2):
        self.brain = brain
        self.window = deque(maxlen=window)
        self.motif_counts = Counter()
        self.min_unique = min_unique
        self.recurrence = recurrence

    def _consider_journal(self, words):
        clean = [w for w in words if w in self.brain.substrate.idx]
        self.window.extend(clean)
        if len(self.window) < self.window.maxlen:
            return None
        counts = Counter(self.window)
        unique = len(counts)
        if unique < self.min_unique:
            return None
        # The most recurrent current motif becomes a journal seed only after recurrence.
        seed, freq = counts.most_common(1)[0]
        if freq < self.recurrence:
            return None
        signature = tuple(w for w, _ in counts.most_common(5))
        self.motif_counts[signature] += 1
        if self.motif_counts[signature] < 2:
            return None
        return self.brain.journal.capture(seed, self.brain.tick)

    def run(self, transitions: int = 1000, chunk: int = 100):
        reports = []
        remaining = transitions
        while remaining > 0:
            n = min(chunk, remaining)
            l, r = self.brain.daydream_step(n)
            entry = self._consider_journal(l["path"][-12:] + r["path"][-12:])
            reports.append({
                "tick": self.brain.tick,
                "left_state": l["state"],
                "right_state": r["state"],
                "journal_capture": entry.entry_id if entry else None,
            })
            remaining -= n
        return reports
