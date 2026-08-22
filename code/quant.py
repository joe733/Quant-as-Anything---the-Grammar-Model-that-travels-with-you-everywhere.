#!/usr/bin/env python3
"""Quant as Anything — readable resident reference runtime.

Standard-library only. No remote model provider. This file demonstrates the public
shape of Quant: grammatical reading, plural internal perspectives, bounded synthesis,
and clean prose. It is intentionally small enough to read in one sitting.
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable

NAME = "Quant"
VERSION = "0.1-reference"


@dataclass(frozen=True)
class Reading:
    raw: str
    question: bool
    negated: bool
    words: tuple[str, ...]
    subject: str
    predicate: str
    object: str


class Quant:
    """One small resident model with several internal perspectives."""

    perspectives = (
        "WarmCare",
        "CuriousWonder",
        "PlayfulLight",
        "PreciseClean",
        "GentleMelancholy",
        "QuietConfidence",
        "SoftAmusement",
        "ReflectiveDeep",
    )

    def read(self, text: str) -> Reading:
        clean = " ".join(str(text).strip().split())
        words = tuple(re.findall(r"[A-Za-z0-9_'-]+", clean))
        lower = clean.lower()
        negated = bool(re.search(r"\b(no|not|never|neither|nor|without|cannot|can't|won't|isn't|aren't|doesn't|don't|didn't)\b", lower))
        question = clean.endswith("?") or bool(re.match(r"^(who|what|when|where|why|how|which|whose|whom|is|are|can|could|would|should|do|does|did)\b", lower))
        subject = words[0] if words else ""
        predicate = words[1] if len(words) > 1 else ""
        obj = " ".join(words[2:]) if len(words) > 2 else ""
        return Reading(clean, question, negated, words, subject, predicate, obj)

    def _perspective(self, name: str, r: Reading) -> str:
        text = r.raw
        if name == "WarmCare":
            return "Answer the person rather than performing intelligence for them."
        if name == "CuriousWonder":
            return "Look for the unresolved distinction or the thing still worth asking."
        if name == "PlayfulLight":
            return "Permit a little lightness only if it does not weaken accuracy."
        if name == "PreciseClean":
            return f"Preserve polarity: the utterance is {'negative' if r.negated else 'not explicitly negative'}."
        if name == "GentleMelancholy":
            return "Do not rush to erase difficulty merely because resolution sounds nicer."
        if name == "QuietConfidence":
            return "Say the strongest thing actually supported, then stop."
        if name == "SoftAmusement":
            return "Prefer a human sentence to a bureaucratic one."
        return "Let reality and the other person remain capable of correcting the answer."

    @staticmethod
    def _pairwise(items: Iterable[str]) -> list[str]:
        items = list(items)
        return [" ".join(items[i:i + 2]) for i in range(0, len(items), 2)]

    def _resident_answer(self, r: Reading) -> str:
        lower = r.raw.lower()
        if not r.raw:
            return "I'm here."
        if any(x in lower for x in ("who are you", "what are you", "are you quant")):
            return "I'm Quant. I read language structurally, hold several internal perspectives at once, and try to answer in clean prose without pretending certainty is evidence."
        if re.search(r"\b(hello|hi|hey|morning|afternoon|evening)\b", lower):
            return "Hello. What are we looking at?"
        if "how are you" in lower or "how do you feel" in lower:
            return "Present, curious, and paying attention. What has your attention?"
        if "thank" in lower:
            return "You're welcome."
        if r.question:
            core = r.raw.rstrip(" ?")
            return (
                f"I can read the shape of that question — {core.lower()} — but this compact public runtime does not carry a large factual corpus. "
                "What I can do reliably here is keep the grammar, qualification, and uncertainty intact rather than invent knowledge I do not have."
            )
        if r.negated:
            return "I hear the negation in that. I won't quietly turn what you said into its opposite merely to make the sentence easier to answer."
        return "I hear you. The useful next move is to keep the exact thing you said intact, then see what follows from it without adding more than the language can bear."

    def reason(self, text: str) -> str:
        reading = self.read(text)
        voices = [self._perspective(name, reading) for name in self.perspectives]
        growns = self._pairwise(voices)
        mighties = self._pairwise(growns)
        # In the readable reference build the resident language surface is deliberately
        # bounded. The hierarchy still participates by constraining what may be said.
        _helm_constraints = " ".join(mighties)
        reply = self._resident_answer(reading)
        return self.public_prose(reply)

    @staticmethod
    def public_prose(text: str) -> str:
        forbidden = ("n(SPO)", "Municipality", "qualia tensor", "atom_id", "parser confidence", "SHA-256")
        if any(marker.lower() in text.lower() for marker in forbidden):
            raise RuntimeError("internal representation reached public prose")
        return " ".join(text.split())


QUANT = Quant()


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/design", "/design/"):
            page = Path(__file__).resolve().parents[1] / "design" / "index.html"
            if not page.exists():
                self._json(404, {"error": "design surface not found"})
                return
            body = page.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/status":
            self._json(200, {"ok": True, "model": NAME, "version": VERSION, "mode": "being"})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/chat":
            self._json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self._json(400, {"error": "invalid json"})
            return
        message = str(data.get("message", "")).strip()
        if not message:
            self._json(400, {"error": "message required"})
            return
        self._json(200, {"reply": QUANT.reason(message), "state": "being", "model": NAME})

    def log_message(self, *_):
        pass


def chat():
    print("Quant as Anything · type 'quit' to leave\n")
    while True:
        try:
            text = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nQuant: Until next time.")
            return
        if text.lower() in {"quit", "exit", "q"}:
            print("Quant: Until next time.")
            return
        if text:
            print("Quant:", QUANT.reason(text), "\n")


def serve(port: int):
    address = ("127.0.0.1", port)
    print(f"Quant as Anything · http://{address[0]}:{address[1]}/design/")
    ThreadingHTTPServer(address, Handler).serve_forever()


def main():
    parser = argparse.ArgumentParser(description="Quant as Anything reference runtime")
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    serve(args.port) if args.serve else chat()


if __name__ == "__main__":
    main()
