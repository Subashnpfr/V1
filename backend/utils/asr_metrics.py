"""Simple WER/CER for licensed ASR fixtures. No fabricated scores."""

from __future__ import annotations


def _tokens(text: str) -> list[str]:
    return [t for t in (text or "").split() if t]


def levenshtein(a: list[str], b: list[str]) -> int:
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            ins = cur[j - 1] + 1
            delete = prev[j] + 1
            sub = prev[j - 1] + (0 if ca == cb else 1)
            cur.append(min(ins, delete, sub))
        prev = cur
    return prev[-1]


def word_error_rate(reference: str, hypothesis: str) -> float | None:
    ref = _tokens(reference)
    if not ref:
        return None
    return levenshtein(ref, _tokens(hypothesis)) / len(ref)


def char_error_rate(reference: str, hypothesis: str) -> float | None:
    ref = [c for c in (reference or "") if not c.isspace()]
    if not ref:
        return None
    hyp = [c for c in (hypothesis or "") if not c.isspace()]
    return levenshtein(ref, hyp) / len(ref)
