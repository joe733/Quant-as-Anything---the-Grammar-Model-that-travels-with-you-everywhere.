from __future__ import annotations
from collections import Counter
from .conversation_pockets import ConversationPockets

class PocketAttention:
    """Maps conversational activation into bounded attention cues for cognition."""
    def __init__(self, pockets: ConversationPockets):
        self.pockets = pockets

    def pressure(self, current_concepts: tuple[str, ...], cap: int = 18) -> tuple[tuple[str, float], ...]:
        current = set(current_concepts)
        score = Counter()
        for p in self.pockets.state.pockets.values():
            if p.state == 'dormant' and not current.intersection(p.concepts):
                continue
            overlap = len(current.intersection(p.concepts))
            unresolved = 0.5 if p.unresolved else 0.0
            rec = min(0.6, 0.08 * p.recurrence)
            state_factor = {'hot': 1.0, 'warm': 0.55, 'dormant': 0.2}[p.state]
            base = state_factor * p.activation + unresolved + rec + 0.22 * overlap
            for word, n in p.concepts.items():
                score[word] += base * (1 + 0.05 * n)
        return tuple((w, round(v, 6)) for w, v in score.most_common(cap))

    def prime_runtime(self, runtime, current_concepts: tuple[str, ...]) -> None:
        """Raises attention only for concepts the core runtime has already encountered."""
        for word, pressure in self.pressure(current_concepts):
            if word not in runtime.state.nodes:
                continue
            gain = min(0.22, pressure * 0.025)
            runtime.state.active[word] += gain
            runtime.state.nodes[word].provenance.add('conversation_attention')
        runtime.gating.gate(runtime.state, runtime.config)
