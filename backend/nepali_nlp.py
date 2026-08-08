# Created by Subash Nepal · nepalsubash.com.np
"""
Lightweight 3-Stage Deterministic Nepali Correction Pipeline
1. Unicode NFC & Whitespace Normalization
2. Stage 1: Hunspell Spelling Verification & Fixes
3. Stage 2: Varnavinyas Orthography (danda '.' -> '।', spacing, punctuation)
4. Stage 3: Custom Confusion Dictionary (backend/data/ne_corrections.json)
5. Final Punctuation & Spacing Pass
"""

import os
import re
import json
import unicodedata
from typing import List, Dict, Tuple, Set

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CUSTOM_CORRECTIONS_FILE = os.path.join(DATA_DIR, "ne_corrections.json")
DIC_FILE = os.path.join(DATA_DIR, "ne_NP.dic")

# Load Custom Confusion Dictionary (Stage 3)
NEPALI_CUSTOM_DICTIONARY: Dict[str, str] = {}
if os.path.exists(CUSTOM_CORRECTIONS_FILE):
    try:
        with open(CUSTOM_CORRECTIONS_FILE, "r", encoding="utf-8") as f:
            NEPALI_CUSTOM_DICTIONARY = json.load(f)
    except Exception as e:
        print(f"Notice: Failed to load ne_corrections.json ({e})")

# Fallback default custom corrections if JSON is missing
if not NEPALI_CUSTOM_DICTIONARY:
    NEPALI_CUSTOM_DICTIONARY = {
        "छन": "छन्",
        "हुन्छन": "हुन्छन्",
        "तपाइ": "तपाईं",
        "तपाई": "तपाईं",
        "भएकोछ": "भएको छ",
        "गरेकोछ": "गरेको छ",
        "रहेकोछ": "रहेको छ",
        "गरिरहेछ": "गरिरहेको छ",
        "गरेकोछु": "गरेको छु"
    }

# Load Hunspell Dictionary (Stage 1)
HUNSPELL_WORDS: Set[str] = set()
if os.path.exists(DIC_FILE):
    try:
        with open(DIC_FILE, "r", encoding="utf-8") as f:
            for line in f:
                w = line.strip().split('/')[0]
                if w and not w.isdigit():
                    HUNSPELL_WORDS.add(unicodedata.normalize("NFC", w))
    except Exception as e:
        print(f"Notice: Failed to load ne_NP.dic ({e})")

# Stage 2 Orthography Rules (Varnavinyas)
VARNAVINYAS_SPACING_PATTERNS: List[Tuple[re.Pattern, str]] = [
    # Auxiliary verb agglutination fixes
    (re.compile(r'(\b[\u0900-\u097F]+)(गरेको|भएको|रहेको|गर्दै|भइरहेको|आएको|जाने|हुने)(छु|छौ|छस्|छन्|छ|थियो|थिए|थियौ)\b'), r'\1 \2 \3'),
    (re.compile(r'(\b[\u0900-\u097F]+)(गरेको|भएको|रहेको)(छ|छन्|थियो|थिए)\b'), r'\1 \2 \3'),
    (re.compile(r'(\b[\u0900-\u097F]+)(छु|छन्|थियो|थिए)\b'), r'\1 \2')
]

def normalize_nfc(text: str) -> str:
    if not text:
        return ""
    return unicodedata.normalize("NFC", text).strip()

def normalize_whitespace(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s+([।?!.,;:])', r'\1', text)
    text = re.sub(r'([।?!.,;:])([^\s\d।?!.,;:])', r'\1 \2', text)
    return text.strip()

def stage1_hunspell_check(text: str) -> Tuple[str, int]:
    """Stage 1 — Hunspell spell check. Fixes wrong letters/matras without altering proper nouns or English words."""
    if not text or not HUNSPELL_WORDS:
        return text, 0

    corrected_count = 0
    words = text.split()
    result_words = []

    for w in words:
        # Preserve English words, numbers, or short symbols
        if re.search(r'[a-zA-Z0-9]', w) or len(w) <= 1:
            result_words.append(w)
            continue

        match = re.match(r'^([\u0900-\u097F]+)([।?!.,;:]*)$', w)
        if not match:
            result_words.append(w)
            continue

        clean_w, punct = match.group(1), match.group(2)

        # If word is in Hunspell dictionary, it is valid!
        if clean_w in HUNSPELL_WORDS:
            result_words.append(w)
            continue

        # Common matra typos fix (e.g., missing halanta or incorrect end matra)
        candidate = None
        if clean_w.endswith("न") and (clean_w[:-1] + "न्") in HUNSPELL_WORDS:
            candidate = clean_w[:-1] + "न्"
        elif clean_w.endswith("स") and (clean_w[:-1] + "स्") in HUNSPELL_WORDS:
            candidate = clean_w[:-1] + "स्"

        if candidate:
            result_words.append(candidate + punct)
            corrected_count += 1
        else:
            result_words.append(w)

    return " ".join(result_words), corrected_count

def stage2_varnavinyas_orthography(text: str) -> Tuple[str, int]:
    """Stage 2 — Varnavinyas Orthography (punctuation '.', double danda, auxiliary verb spacing)."""
    if not text:
        return text, 0

    fixed_count = 0
    original_text = text

    # Punctuation normalization (. -> ।)
    text = re.sub(r'(?<!\d)\.(?!\d)', '।', text)
    text = re.sub(r'।।+', '।', text)
    text = re.sub(r'\s*\?\s*', '? ', text)
    text = re.sub(r'\s*!\s*', '! ', text)

    # Spacing rules
    for pattern, replacement in VARNAVINYAS_SPACING_PATTERNS:
        new_text = pattern.sub(replacement, text)
        if new_text != text:
            fixed_count += 1
            text = new_text

    if text != original_text and fixed_count == 0:
        fixed_count = 1

    return text.strip(), fixed_count

def stage3_custom_confusion_dictionary(text: str) -> Tuple[str, int]:
    """Stage 3 — Custom Confusion Dictionary (backend/data/ne_corrections.json). Whole-word exact replacement."""
    if not text or not NEPALI_CUSTOM_DICTIONARY:
        return text, 0

    applied_count = 0
    words = text.split()
    result_words = []

    for w in words:
        match = re.match(r'^([\u0900-\u097F\w]+)([।?!.,;:]*)$', w)
        if match:
            clean_w, punct = match.group(1), match.group(2)
            if clean_w in NEPALI_CUSTOM_DICTIONARY:
                result_words.append(NEPALI_CUSTOM_DICTIONARY[clean_w] + punct)
                applied_count += 1
            else:
                result_words.append(w)
        else:
            if w in NEPALI_CUSTOM_DICTIONARY:
                result_words.append(NEPALI_CUSTOM_DICTIONARY[w])
                applied_count += 1
            else:
                result_words.append(w)

    return " ".join(result_words), applied_count

def process_nepali_correction_pipeline(text: str) -> Tuple[str, Dict[str, int]]:
    """
    Execution Order:
    text -> unicode normalize (NFC) -> whitespace normalize -> Stage 1: Hunspell
         -> Stage 2: Varnavinyas -> Stage 3: custom confusion dictionary -> final punctuation pass
    """
    if not text or not text.strip():
        return "", {"hunspell": 0, "varnavinyas": 0, "custom": 0}

    # Step 1: Unicode NFC Normalization
    text = normalize_nfc(text)

    # Step 2: Whitespace Normalization
    text = normalize_whitespace(text)

    # Stage 1: Hunspell (Misspellings)
    text, hunspell_count = stage1_hunspell_check(text)

    # Stage 2: Varnavinyas (Orthography & Spacing)
    text, varnavinyas_count = stage2_varnavinyas_orthography(text)

    # Stage 3: Custom Confusion Dictionary
    text, custom_count = stage3_custom_confusion_dictionary(text)

    # Final Punctuation & Whitespace Pass
    text = normalize_whitespace(text)

    stats = {
        "hunspell": hunspell_count,
        "varnavinyas": varnavinyas_count,
        "custom": custom_count
    }

    return text, stats

def process_nepali_vyakaran_pipeline(text: str, confidence: float = 1.0) -> str:
    """Convenience wrapper returning cleaned text."""
    cleaned, _ = process_nepali_correction_pipeline(text)
    return cleaned
