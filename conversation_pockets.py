from __future__ import annotations
import re
from collections import Counter
from .models import ConversationState, ConversationPocket, ConversationEvent, PocketConfig

_TOKEN = re.compile(r"[A-Za-z][A-Za-z'’-]*")
_STOP = {
    'the','a','an','and','or','but','if','then','of','to','in','on','at','for','from','by','with',
    'is','was','are','were','be','been','being','it','its','that','this','as','not','no','do','does',
    'did','so','than','too','very','into','through','there','here','when','where','while','who','what',
    'which','how','why','i','you','we','they','he','she','my','your','our','their','me','us','about'
}

class ConversationPockets:
    """Attention scaffolding for dialogue. Pockets are not beliefs, values, or SELF-state."""
    def __init__(self, config: PocketConfig | None = None):
        self.config = config or PocketConfig()
        self.state = ConversationState()

    @staticmethod
    def concepts(text: str) -> tuple[str, ...]:
        words = [w.lower().replace('’', "'") for w in _TOKEN.findall(text or '')]
        return tuple(w for w in words if len(w) > 2 and w not in _STOP)

    def _key(self, kind: str, concepts: tuple[str, ...]) -> str:
        core = tuple(dict.fromkeys(concepts))[:5]
        return kind + ':' + '|'.join(sorted(core))

    def ingest_user(self, text: str) -> tuple[str, ...]:
        self.state.turn += 1
        turn = self.state.turn
        concepts = self.concepts(text)
        self.state.events.append(ConversationEvent(turn, 'user', text, concepts, 'external_user'))
        if not concepts:
            self.decay()
            return concepts

        freq = Counter(concepts)
        kind = 'question' if '?' in text else 'active'
        key = self._key(kind, concepts)
        pocket = self.state.pockets.get(key)
        if pocket is None:
            pocket = ConversationPocket(key=key, kind=kind, created_turn=turn, last_turn=turn)
            self.state.pockets[key] = pocket
        pocket.concepts.update(freq)
        pocket.touch(turn, 1.15, 'external_user')
        if '?' in text:
            pocket.unresolved = True
            self.state.unresolved_threads.add(key)

        # Shared-reference pockets emerge only from recurrence across distinct turns.
        prior = Counter()
        for event in list(self.state.events)[:-1][-16:]:
            if event.role == 'user':
                prior.update(set(event.concepts))
        repeated = tuple(w for w in dict.fromkeys(concepts) if prior[w] > 0)
        if repeated:
            skey = self._key('shared_reference', repeated)
            shared = self.state.pockets.get(skey)
            if shared is None:
                shared = ConversationPocket(key=skey, kind='shared_reference', created_turn=turn, last_turn=turn)
                self.state.pockets[skey] = shared
            shared.concepts.update(repeated)
            shared.touch(turn, 0.55, 'conversation_recurrence')

        self.reactivate(concepts)
        self._referential_boost(concepts, exclude={key})
        self.decay(exclude={key})
        self.classify()
        return concepts

    def reactivate(self, concepts: tuple[str, ...]) -> list[str]:
        current = set(concepts)
        woken = []
        for p in self.state.pockets.values():
            overlap = current.intersection(p.concepts)
            if not overlap:
                continue
            gain = min(0.9, 0.18 * len(overlap) + self.config.recurrence_bonus * min(p.recurrence, 3))
            if p.unresolved:
                gain += self.config.unresolved_bonus
            p.activation = min(self.config.activation_ceiling, p.activation + gain)
            p.last_turn = self.state.turn
            if p.state == 'dormant' and p.activation >= self.config.wake_threshold:
                woken.append(p.key)
        self.classify()
        return woken


    def _referential_boost(self, concepts: tuple[str, ...], exclude: set[str] | None = None) -> str | None:
        """Give one prior unresolved thread a bounded boost for ambiguous callbacks.

        This is attention, not semantic certainty: the chosen pocket remains only a candidate context.
        """
        exclude = exclude or set()
        cues = {'earlier','back','again','issue','thread','that','before','previous','unresolved'}
        if not cues.intersection(concepts):
            return None
        candidates = [
            p for k,p in self.state.pockets.items()
            if k not in exclude and p.unresolved and p.last_turn < self.state.turn
        ]
        if not candidates:
            return None
        # Recurrence first, then activation, with older unresolved material receiving a mild callback bonus.
        candidate = max(candidates, key=lambda p: (p.recurrence, p.activation, self.state.turn - p.created_turn))
        candidate.activation = min(self.config.activation_ceiling, candidate.activation + 0.72)
        candidate.provenance.add('ambiguous_callback')
        candidate.last_turn = self.state.turn
        return candidate.key

    def resolve(self, key: str, note: str = '') -> None:
        p = self.state.pockets.get(key)
        if not p:
            return
        p.unresolved = False
        self.state.unresolved_threads.discard(key)
        if note:
            p.notes.append(note)

    def decay(self, exclude: set[str] | None = None) -> None:
        exclude = exclude or set()
        for key, p in self.state.pockets.items():
            if key in exclude:
                continue
            rate = self.config.decay_hot if p.state == 'hot' else self.config.decay_warm if p.state == 'warm' else self.config.decay_dormant
            p.activation *= (1.0 - rate)
            if p.unresolved:
                p.activation += min(0.08, self.config.thread_bonus * 0.06)

    def classify(self) -> None:
        ranked = sorted(self.state.pockets.values(), key=lambda p: (p.activation, p.recurrence, p.last_turn), reverse=True)
        hot = {p.key for p in ranked[:self.config.hot_cap] if p.activation >= self.config.wake_threshold}
        warm = {p.key for p in ranked[self.config.hot_cap:self.config.hot_cap+self.config.warm_cap] if p.activation >= self.config.dormant_threshold}
        for p in ranked:
            if p.key in hot:
                p.state = 'hot'
            elif p.key in warm or p.activation >= self.config.dormant_threshold:
                p.state = 'warm'
            else:
                p.state = 'dormant'

        # Bound dormant population without deleting unresolved threads.
        dormant = [p for p in ranked if p.state == 'dormant' and not p.unresolved]
        for p in dormant[self.config.dormant_cap:]:
            self.state.pockets.pop(p.key, None)

    def hot_concepts(self, cap: int = 24) -> tuple[str, ...]:
        score = Counter()
        for p in self.state.pockets.values():
            if p.state != 'hot':
                continue
            for word, n in p.concepts.items():
                score[word] += p.activation * (1 + 0.1 * n)
        return tuple(w for w, _ in score.most_common(cap))

    def unresolved(self) -> tuple[ConversationPocket, ...]:
        items = [self.state.pockets[k] for k in self.state.unresolved_threads if k in self.state.pockets]
        items.sort(key=lambda p: (p.activation, p.recurrence, p.last_turn), reverse=True)
        return tuple(items)
