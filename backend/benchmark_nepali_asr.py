"""Reproducible Nepali ASR benchmark.

Usage (from repo root):
    python -m backend.benchmark_nepali_asr

Reports WER/CER only when licensed clips + reference_devanagari exist.
Does not download models unless you pass --run-whisper.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

FIXTURE_DIR = BACKEND / "tests" / "data" / "nepali_asr"
MANIFEST = FIXTURE_DIR / "manifest.json"


def load_manifest() -> dict:
    if not MANIFEST.is_file():
        return {"clips": []}
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Nepali ASR benchmark (no fabricated WER).")
    parser.add_argument("--quality", choices=("fast", "high_accuracy"), default="fast")
    parser.add_argument("--run-whisper", action="store_true", help="Load Whisper and score clips (slow).")
    args = parser.parse_args()

    from utils.whisper_decode import get_transcription_config
    from utils.asr_metrics import char_error_rate, word_error_rate

    cfg = get_transcription_config(quality=args.quality, language="ne")
    data = load_manifest()
    clips = data.get("clips") or []
    print(f"requested_quality={cfg['quality']}")
    print(f"requested_model={cfg['requested_model']}")
    print(f"beam_size={cfg['beam_size']}")
    print(f"vad_enabled={cfg['vad_enabled']}")
    print(f"clips_in_manifest={len(clips)}")

    if not clips:
        print("WER/CER unavailable")
        print("Reason: no licensed reference audio dataset (manifest clips empty).")
        return 0

    missing_audio = []
    for clip in clips:
        audio = FIXTURE_DIR / (clip.get("audio") or "")
        if not audio.is_file():
            missing_audio.append(str(audio))
    if missing_audio:
        print("WER/CER unavailable")
        print("Reason: manifest lists clips but audio files are missing:")
        for p in missing_audio:
            print(f"  {p}")
        return 0

    if not args.run_whisper:
        print("Audio fixtures present. Re-run with --run-whisper to score (loads the speech model).")
        return 0

    import app as appmod

    t0 = time.perf_counter()
    model, forced_lang, label, meta = appmod.get_whisper_model_and_language("ne", args.quality)
    load_s = time.perf_counter() - t0
    print(f"actual_model={meta.get('actual_model')}")
    print(f"fallback={meta.get('fallback')}")
    print(f"fallback_reason={meta.get('fallback_reason')}")
    print(f"device={meta.get('device')}")
    print(f"compute_type={meta.get('compute_type')}")
    print(f"model_load_sec={load_s:.2f}")
    print(f"label={label}")

    decode = dict(cfg["decode"])
    wers = []
    cers = []
    for clip in clips:
        path = FIXTURE_DIR / clip["audio"]
        ref = clip.get("reference_devanagari") or ""
        started = time.perf_counter()
        segments, info = model.transcribe(str(path), **decode)
        hyp = " ".join((seg.text or "").strip() for seg in segments).strip()
        elapsed = time.perf_counter() - started
        dur = float(clip.get("duration_sec") or getattr(info, "duration", 0) or 0)
        rtf = (elapsed / dur) if dur else None
        wer = word_error_rate(ref, hyp) if ref else None
        cer = char_error_rate(ref, hyp) if ref else None
        print("---")
        print(f"id={clip.get('id')}")
        print(f"Model: {meta.get('actual_model')}")
        print(f"Language: ne")
        print(f"Audio: {dur:.1f} sec" if dur else "Audio: unknown duration")
        print(f"Processing: {elapsed:.1f} sec")
        print(f"RTF: {rtf:.2f}" if rtf is not None else "RTF: n/a")
        if wer is None:
            print("WER: unavailable (no reference_devanagari)")
        else:
            print(f"WER: {wer:.2f}")
            wers.append(wer)
        if cer is None:
            print("CER: unavailable (no reference_devanagari)")
        else:
            print(f"CER: {cer:.2f}")
            cers.append(cer)
    if wers:
        print(f"mean_WER={sum(wers)/len(wers):.2f}")
    if cers:
        print(f"mean_CER={sum(cers)/len(cers):.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
