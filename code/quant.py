#!/usr/bin/env python3
"""Quant as Anything — public local reference.

This edition is intentionally public-facing: it demonstrates the resident contract
without publishing the proprietary grammar, memory or inference implementation used
by Fiduci's private Quant builds.

Standard library only. No network model. No telemetry.
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

NAME = "Quant"
VERSION = "0.2-public"
WORD = re.compile(r"[A-Za-z][A-Za-z'_-]*")


def terms(text: str) -> set[str]:
    return {m.group(0).lower() for m in WORD.finditer(text)}


@dataclass
class Place:
    """A small public demonstration of a local place Quant can read."""
    notes: list[tuple[str, str]] = field(default_factory=list)

    def add(self, text: str, source: str = "local") -> int:
        clean = " ".join(str(text).split())
        if clean:
            self.notes.append((source, clean))
        return len(self.notes)

    def find(self, question: str) -> tuple[str, str] | None:
        wanted = terms(question)
        if not wanted:
            return None
        best = None
        best_score = 0
        for source, text in self.notes:
            score = len(wanted & terms(text))
            if score > best_score:
                best_score = score
                best = (source, text)
        return best


class Resident:
    """Public behaviour contract for Quant.

    The names here are intentionally descriptive public denominations rather than
    the private implementation vocabulary used by Fiduci's production resident.
    """

    def __init__(self):
        self.place = Place()

    @staticmethod
    def read(text: str) -> dict:
        clean = " ".join(str(text).strip().split())
        lower = clean.lower()
        words = WORD.findall(clean)
        return {
            "text": clean,
            "question": clean.endswith("?") or bool(re.match(r"^(who|what|when|where|why|how|which|can|could|would|should|do|does|did|is|are)\b", lower)),
            "negated": bool(re.search(r"\b(no|not|never|without|cannot|can't|won't|isn't|aren't|doesn't|don't|didn't)\b", lower)),
            "words": words,
        }

    def speak(self, text: str) -> str:
        reading = self.read(text)
        clean = reading["text"]
        lower = clean.lower()
        if not clean:
            return "I'm here."
        if re.search(r"\b(hello|hi|hey)\b", lower):
            return "Hello. What are we looking at?"
        if any(p in lower for p in ("who are you", "what are you", "are you quant")):
            return "I'm Quant. A small local grammar model designed to stay himself while the place around him changes."
        if "thank" in lower:
            return "You're welcome."

        found = self.place.find(clean)
        if found:
            source, evidence = found
            return f"From {source}: {evidence}"

        if reading["question"]:
            return "I don't have enough in this place to answer that as fact yet. You can add local material and ask me again."
        if reading["negated"]:
            return "I hear the negation in that. I won't silently turn it into its opposite."
        return "I hear you. I can keep that language intact and use it as part of this local place when you deliberately add it."


QUANT = Resident()


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/design", "/design/"):
            page = Path(__file__).resolve().parents[1] / "design" / "index.html"
            if not page.exists():
                self._json(404, {"error": "design surface not found"}); return
            body = page.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers(); self.wfile.write(body); return
        if self.path == "/status":
            self._json(200, {"ok": True, "model": NAME, "version": VERSION, "privacy": "local"}); return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self._json(400, {"error": "invalid json"}); return
        if self.path == "/chat":
            message = str(data.get("message", "")).strip()
            if not message: self._json(400, {"error": "message required"}); return
            self._json(200, {"reply": QUANT.speak(message), "model": NAME}); return
        if self.path == "/add":
            text = str(data.get("text", "")).strip()
            source = str(data.get("source", "local")).strip() or "local"
            if not text: self._json(400, {"error": "text required"}); return
            count = QUANT.place.add(text, source)
            self._json(200, {"ok": True, "records": count}); return
        self._json(404, {"error": "not found"})

    def log_message(self, *_):
        pass


def chat():
    print("Quant as Anything · public local reference · type 'quit' to leave\n")
    while True:
        try: text = input("You: ").strip()
        except (EOFError, KeyboardInterrupt): print("\nQuant: Until next time."); return
        if text.lower() in {"quit", "exit", "q"}: print("Quant: Until next time."); return
        if text.startswith("+ "):
            QUANT.place.add(text[2:], "conversation")
            print("Quant: Added to this local place.\n")
        elif text:
            print("Quant:", QUANT.speak(text), "\n")


def serve(port: int):
    address = ("127.0.0.1", port)
    print(f"Quant as Anything · http://{address[0]}:{address[1]}/design/")
    ThreadingHTTPServer(address, Handler).serve_forever()


def main():
    p = argparse.ArgumentParser(description="Quant as Anything public local reference")
    p.add_argument("--serve", action="store_true")
    p.add_argument("--port", type=int, default=8765)
    args = p.parse_args()
    serve(args.port) if args.serve else chat()


if __name__ == "__main__":
    main()
