"""Devanagari → readable Latin (V1 convention).

This is transliteration, not translation. Latin tokens, numbers, URLs, and
known proper nouns are preserved.

V1 romanization (readability over ISO 15919):
- Independent आ → aa; dependent ा → a (तपाईं → tapai)
- छ with inherent a → chha; छ + other vowels → ch + vowel (छु → chu)
- Word-final inherent schwa is dropped (घर → ghar)
- Anusvara/chandrabindu → n, omitted before ल/र in the same word
- Nepali danda । → .
- Cue text is sentence-cased
"""

from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

VIRAMA = "\u094d"
NUKTA = "\u093c"
ANUSVARA = "\u0902"
CANDRA = "\u0901"
VISARGA = "\u0903"

INDEPENDENT = {
    "अ": "a",
    "आ": "aa",
    "इ": "i",
    "ई": "i",
    "उ": "u",
    "ऊ": "u",
    "ऋ": "ri",
    "ए": "e",
    "ऐ": "ai",
    "ओ": "o",
    "औ": "au",
    "अं": "an",
    "अः": "ah",
}

MATRA = {
    "ा": "a",
    "ि": "i",
    "ी": "i",
    "ु": "u",
    "ू": "u",
    "ृ": "ri",
    "े": "e",
    "ै": "ai",
    "ो": "o",
    "ौ": "au",
    "ॅ": "e",
    "ॉ": "o",
}

# Base consonant romanization without inherent vowel.
CONSONANT = {
    "क": "k",
    "ख": "kh",
    "ग": "g",
    "घ": "gh",
    "ङ": "ng",
    "च": "ch",
    "छ": "chh",
    "ज": "j",
    "झ": "jh",
    "ञ": "n",
    "ट": "t",
    "ठ": "th",
    "ड": "d",
    "ढ": "dh",
    "ण": "n",
    "त": "t",
    "थ": "th",
    "द": "d",
    "ध": "dh",
    "न": "n",
    "प": "p",
    "फ": "ph",
    "ब": "b",
    "भ": "bh",
    "म": "m",
    "य": "y",
    "र": "r",
    "ल": "l",
    "व": "w",
    "श": "sh",
    "ष": "sh",
    "स": "s",
    "ह": "h",
    "क्ष": "ksh",
    "त्र": "tr",
    "ज्ञ": "gy",
    "क़": "q",
    "ख़": "kh",
    "ग़": "g",
    "ज़": "z",
    "ड़": "r",
    "ढ़": "rh",
    "फ़": "f",
    "य़": "y",
}

DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

_DATA = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def _lexicon() -> dict:
    path = _DATA / "nepali_lexicon.json"
    if not path.is_file():
        return {}
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _merged_roman() -> dict:
    data = _lexicon()
    merged = dict(COMMON_ROMAN)
    merged.update(data.get("roman_overrides") or {})
    return merged


def _merged_proper() -> dict:
    data = _lexicon()
    merged = dict(PROPER_NOUNS)
    merged.update(data.get("proper_nouns_devanagari") or {})
    return merged


# High-frequency words: conventional romanized Nepali (not ISO 15919).
COMMON_ROMAN = {
    "हुन्छ": "hunchha",
    "हुन्": "hun",
    "छैन": "chhaina",
    "छैनन्": "chhainan",
    "छन्": "chhan",
    "होइन": "hoina",
    "होइनन्": "hoinan",
    "किन": "kina",
    "तपाईं": "tapai",
    "तपाईँ": "tapai",
    "तपाई": "tapai",
    "तपाइ": "tapai",
    "उहाँ": "uhan",
    "उहा": "uha",
    "कृपया": "kripaya",
    "धन्यवाद": "dhanyabad",
    "नमस्ते": "namaste",
    "नमस्कार": "namaskar",
}

PROPER_NOUNS = {
    "काठमाडौं": "Kathmandu",
    "काठमाण्डु": "Kathmandu",
    "काठमाडौँ": "Kathmandu",
    "पोखरा": "Pokhara",
    "नेपाल": "Nepal",
    "चितवन": "Chitwan",
    "गुल्मी": "Gulmi",
    "भारत": "Bharat",
    "यूट्यूब": "YouTube",
    "युट्युब": "YouTube",
    "फेसबुक": "Facebook",
    "इन्स्टाग्राम": "Instagram",
    "गूगल": "Google",
    "गुगल": "Google",
}

LATIN_TOKEN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9+._/-]*$")
URL_LIKE = re.compile(r"(https?://|www\.|@[A-Za-z])", re.I)


def _is_consonant(ch: str) -> bool:
    return ch in CONSONANT or ("क" <= ch <= "ह")


def _cons_roma(ch: str) -> str:
    return CONSONANT.get(ch, ch)


def _skip_nasal_before(next_cons: str) -> bool:
    return next_cons in {"ल", "र", "व", "य"}


def _join_cons_vowel(cons: str, vowel: str) -> str:
    """Readable छ handling: chha vs chu/chi (not chhu)."""
    if cons == "chh":
        if vowel in {"", "a"}:
            return "chha" if vowel == "a" else "chh"
        if vowel in {"ai", "au"}:
            return "chh" + vowel
        if vowel in {"u", "i", "e", "o"}:
            return "ch" + vowel
    if not vowel:
        return cons
    if vowel == "a":
        return cons + "a"
    return cons + vowel


def romanize_word(word: str) -> str:
    if not word:
        return ""
    word = unicodedata.normalize("NFC", word).translate(DIGITS)
    key = word.strip("।.!?,;:")
    roman_map = _merged_roman()
    proper_map = _merged_proper()
    if key in roman_map:
        suffix = word[len(key):]
        return roman_map[key] + suffix.replace("।", ".")
    if key in proper_map:
        suffix = word[len(key):]
        return proper_map[key] + suffix.replace("।", ".")
    if URL_LIKE.search(word) or LATIN_TOKEN.match(word):
        return word.replace("।", ".")
    if not re.search(r"[\u0900-\u097F]", word):
        return word.replace("।", ".")

    out: list[str] = []
    i = 0
    chars = list(word)
    n = len(chars)
    inherent_positions: list[int] = []
    consonant_syllables = 0

    while i < n:
        ch = chars[i]

        if ch in {ANUSVARA, CANDRA}:
            nxt = chars[i + 1] if i + 1 < n else ""
            if out and not (_is_consonant(nxt) and _skip_nasal_before(nxt)):
                prev = out[-1]
                if prev.endswith("a") and not prev.endswith("aa"):
                    out[-1] = prev + "an"
                else:
                    out[-1] = prev + "n"
            i += 1
            continue
        if ch == VISARGA:
            if out:
                out[-1] = out[-1] + "h"
            i += 1
            continue
        if ch in {VIRAMA, NUKTA}:
            i += 1
            continue

        if ch in INDEPENDENT:
            out.append(INDEPENDENT[ch])
            i += 1
            continue

        if ch in MATRA:
            out.append(MATRA[ch])
            i += 1
            continue

        if not _is_consonant(ch):
            mapped = {"।": ".", "ऽ": "", "ॐ": "om"}.get(ch, ch)
            out.append(mapped)
            i += 1
            continue

        cluster: list[str] = []
        vowel = "a"
        while i < n and _is_consonant(chars[i]):
            base = chars[i]
            i += 1
            if i < n and chars[i] == NUKTA:
                base = base + NUKTA
                i += 1
            cluster.append(_cons_roma(base) if base in CONSONANT else _cons_roma(base[:1]))
            if i < n and chars[i] == VIRAMA:
                i += 1
                if i < n and _is_consonant(chars[i]):
                    continue
                vowel = ""
                break
            vowel = "a"
            if i < n and chars[i] in MATRA:
                vowel = MATRA[chars[i]]
                i += 1
            break

        consonant_syllables += 1
        if not cluster:
            continue
        if len(cluster) == 1:
            piece = _join_cons_vowel(cluster[0], vowel)
        else:
            piece = "".join(cluster[:-1]) + _join_cons_vowel(cluster[-1], vowel)
        if vowel == "a":
            inherent_positions.append(len(out))
        out.append(piece)

    if inherent_positions and consonant_syllables >= 2:
        last_i = inherent_positions[-1]
        last = out[last_i]
        if (
            last.endswith("a")
            and not last.endswith("aa")
            and not last.endswith("chha")
            and last not in {"a", "aa"}
        ):
            if last_i == len(out) - 1:
                out[last_i] = last[:-1]

    return "".join(out)


def romanize_caption(text: str, *, sentence_case: bool = True) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    parts = re.split(r"(\s+)", text)
    roman_parts = []
    for part in parts:
        if not part or part.isspace():
            roman_parts.append(part)
            continue
        roman_parts.append(romanize_word(part))
    result = "".join(roman_parts)
    result = re.sub(r"\s+([?.!,;:])", r"\1", result)
    result = re.sub(r"\s+", " ", result).strip()
    if sentence_case and result:
        for idx, ch in enumerate(result):
            if ch.isalpha():
                result = result[:idx] + ch.upper() + result[idx + 1 :]
                break
    return result


def romanize_timed_words(words: list[dict] | None) -> list[dict]:
    if not words:
        return []
    out = []
    for w in words:
        src = w.get("text") or ""
        roman = romanize_word(src) if re.search(r"[\u0900-\u097F]", src) else src
        tokens = [t for t in re.split(r"\s+", roman.strip()) if t]
        if not tokens:
            continue
        start = float(w.get("start") or 0)
        end = float(w.get("end") or start)
        if len(tokens) == 1:
            out.append({**w, "text": tokens[0]})
            continue
        span = max(0.04, end - start)
        step = span / len(tokens)
        for i, tok in enumerate(tokens):
            out.append({
                **w,
                "text": tok,
                "start": round(start + i * step, 3),
                "end": round(start + (i + 1) * step, 3),
            })
    return out


def romanize_nepali(text: str, *, sentence_case: bool = True) -> str:
    """Public alias: Devanagari → V1 Romanized Nepali (not translation)."""
    return romanize_caption(text, sentence_case=sentence_case)
