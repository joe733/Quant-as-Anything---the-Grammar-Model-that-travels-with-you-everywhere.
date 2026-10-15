from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from collections import Counter
import numpy as np
from .config import LittleThingConfig
from .substrate import SemanticSubstrate
from .left import LeftBrain
from .right import RightBrain
from .journal import Journal
from .amygdala import Amygdala
from .traffic import SemanticTraffic

class LittleThing:
    def __init__(self, coord_path=None, config=None):
        self.config = config or LittleThingConfig()
        if coord_path is None:
            coord_path = Path(__file__).parent / "data" / "sheridan_coordinates.npz"
        self.substrate = SemanticSubstrate.from_npz(coord_path)
        self.left = LeftBrain(self.substrate, self.config.left_hot_cap, self.config.left_dormant_cap)
        self.right = RightBrain(self.substrate, self.config.right_hot_cap, self.config.right_dormant_cap)
        self.amygdala = Amygdala(self.config.self_words, self.config.user_words)
        self.journal = Journal(self.substrate, self.config.journal_capacity, self.config.journal_nodes)
        self.tick = 0

    def _parallel(self, query, steps, spontaneous=True):
        with ThreadPoolExecutor(max_workers=2) as ex:
            lf = ex.submit(self.left.step, query, steps, spontaneous)
            rf = ex.submit(self.right.step, query, steps, spontaneous)
            return lf.result(), rf.result()

    def ask(self, query, steps_per_cycle=None, max_cycles=None):
        steps = steps_per_cycle or self.config.steps_per_cycle
        cycles = max_cycles or self.config.cognition_cycles
        history = []
        qcentre = self.substrate.centre(self.substrate.tokens(query))
        journal_entries = self.journal.relevant(qcentre, self.tick, k=3)
        journal_words = [e.seed_word for e in journal_entries]
        for cycle in range(1, cycles + 1):
            left, right = self._parallel(query, steps)
            self.tick += steps * 2
            hot = set(self.left.pockets.hot_words()) | set(self.right.pockets.hot_words())
            pool = self.amygdala.thought_pool(left, right, hot, journal_words)
            centre = self.amygdala.express(query, pool, left, right, cycle, cycles)
            history.append({"cycle": cycle, "left": left, "right": right, "pool": pool, "centre": centre})
            if centre["decision"] != "think":
                break
        return {"query": query, "cycles": len(history), "result": history[-1]["centre"], "history": history}

    def absorb(self, text, steps=30):
        # Long-form input is context, not a question. No amygdala expression stage.
        left, right = self._parallel(text, steps, spontaneous=True)
        self.tick += steps * 2
        return {"left": left, "right": right}

    def daydream_step(self, steps=100):
        # No target, no SELF/USER, no speech.
        left, right = self._parallel(None, steps, spontaneous=True)
        self.tick += steps * 2
        return left, right

    def snapshot(self):
        return {
            "tick": self.tick,
            "left": self.left.snapshot(),
            "right": self.right.snapshot(),
            "journal_entries": len(self.journal.entries),
            "journal": [e.to_dict() for e in self.journal.entries.values()],
            "amygdala": {
                "voice": self.amygdala.voice.to_dict(),
                "outcome_memory": list(self.amygdala.outcome_memory),
            },
        }

    def export_state(self):
        # Compact enough for experimentation; semantic substrate is package data, not duplicated.
        return self.snapshot()

    def import_state(self, data):
        # Minimal restore for durable experiment state. Rebuild pocket member graphs from seeds.
        self.tick = int(data.get("tick", 0))
        for side_name, hemi in (("left", self.left), ("right", self.right)):
            raw = data.get(side_name, {})
            state_word = raw.get("state")
            if state_word in self.substrate.idx:
                hemi.state = self.substrate.idx[state_word]
            hemi.w = float(raw.get("w", hemi.w))
            for key in raw.get("dormant", []):
                if key in self.substrate.idx:
                    from .pockets import DormantPocket
                    hemi.pockets.dormant[key] = DormantPocket(key, self.substrate.idx[key], .1, 1, hemi.turn)
            for key in raw.get("hot", []):
                if key in self.substrate.idx:
                    hemi.pockets.wake(key, self.substrate.idx[key], hemi.turn, .5)
            hemi.traffic = SemanticTraffic.from_dict(raw.get("traffic", {}))
        self.journal = Journal.from_dict(self.substrate, {
            "capacity": self.config.journal_capacity,
            "graph_nodes": self.config.journal_nodes,
            "entries": data.get("journal", []),
            "next_id": max([e.get("entry_id", 0) for e in data.get("journal", [])] + [0]) + 1,
        })
        voice_raw = data.get("amygdala", {}).get("voice", {})
        self.amygdala.voice.category = voice_raw.get("category", "own")
        self.amygdala.voice.words.update(voice_raw.get("words", {}))
