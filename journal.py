from __future__ import annotations
from dataclasses import dataclass
from collections import Counter, deque
import time
import numpy as np
from .substrate import SemanticSubstrate, clean_word, STOP

@dataclass
class JournalEntry:
    entry_id: int
    seed_word: str
    node_words: list[str]
    adjacency: np.ndarray
    created_tick: int
    last_used_tick: int
    uses: int = 1
    caption: str = ""  # Optional reconstruction, never authoritative.

    def touch(self, tick: int):
        self.uses += 1
        self.last_used_tick = tick

    def to_dict(self):
        edges = []
        for i in range(len(self.node_words)):
            for j in range(i + 1, len(self.node_words)):
                w = float(self.adjacency[i, j])
                if w >= 0.20:
                    edges.append([i, j, round(w, 6)])
        return {
            "entry_id": self.entry_id,
            "seed_word": self.seed_word,
            "node_words": self.node_words,
            "edges": edges,
            "created_tick": self.created_tick,
            "last_used_tick": self.last_used_tick,
            "uses": self.uses,
            "caption": self.caption,
        }

    @classmethod
    def from_dict(cls, d):
        n = len(d["node_words"])
        adj = np.zeros((n, n), dtype=np.float32)
        for i, j, w in d.get("edges", []):
            adj[i, j] = adj[j, i] = w
        return cls(d["entry_id"], d["seed_word"], d["node_words"], adj,
                   d["created_tick"], d["last_used_tick"], d.get("uses", 1), d.get("caption", ""))

class Journal:
    """Private bounded wandering-thought store: max 128 local 48-node graphs by default."""
    def __init__(self, substrate: SemanticSubstrate, capacity: int = 128, graph_nodes: int = 48):
        self.s = substrate
        self.capacity = capacity
        self.graph_nodes = graph_nodes
        self.entries: dict[int, JournalEntry] = {}
        self.seed_to_id: dict[str, int] = {}
        self.next_id = 1

    def _evict_if_full(self):
        if len(self.entries) < self.capacity:
            return None
        # User's requested forgetting rule: least used; tie-break oldest access.
        victim = min(self.entries.values(), key=lambda e: (e.uses, e.last_used_tick, e.created_tick))
        del self.entries[victim.entry_id]
        self.seed_to_id.pop(victim.seed_word, None)
        return victim.entry_id

    def capture(self, seed_word: str, tick: int, caption: str = "") -> JournalEntry | None:
        if seed_word not in self.s.idx or not clean_word(seed_word) or seed_word in STOP:
            return None
        if seed_word in self.seed_to_id:
            e = self.entries[self.seed_to_id[seed_word]]
            e.touch(tick)
            return e
        self._evict_if_full()
        nodes, adj = self.s.local_graph(seed_word, self.graph_nodes)
        words = [self.s.words[i] for i in nodes]
        e = JournalEntry(self.next_id, seed_word, words, adj, tick, tick, 1, caption)
        self.entries[e.entry_id] = e
        self.seed_to_id[seed_word] = e.entry_id
        self.next_id += 1
        return e

    def relevant(self, centre: np.ndarray | None, tick: int, k: int = 3) -> list[JournalEntry]:
        if centre is None or not self.entries:
            return []
        scored = []
        for e in self.entries.values():
            seed = self.s.idx.get(e.seed_word)
            if seed is None:
                continue
            d = float(np.linalg.norm(self.s.xyz[seed] - centre))
            scored.append((d, e))
        out = [e for _, e in sorted(scored, key=lambda x: x[0])[:k]]
        for e in out:
            e.touch(tick)
        return out

    def to_dict(self):
        return {
            "capacity": self.capacity,
            "graph_nodes": self.graph_nodes,
            "next_id": self.next_id,
            "entries": [e.to_dict() for e in self.entries.values()],
        }

    @classmethod
    def from_dict(cls, substrate, d):
        j = cls(substrate, d.get("capacity", 128), d.get("graph_nodes", 48))
        j.next_id = d.get("next_id", 1)
        for raw in d.get("entries", []):
            e = JournalEntry.from_dict(raw)
            j.entries[e.entry_id] = e
            j.seed_to_id[e.seed_word] = e.entry_id
        return j
