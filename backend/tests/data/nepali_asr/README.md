# Nepali ASR audio benchmark fixtures

Place WAV/FLAC clips here to measure Devanagari WER/CER.

Expected layout:

    tests/data/nepali_asr/
      manifest.json
      clips/*.wav

manifest.json example:

    {
      "clips": [
        {
          "file": "clips/sample01.wav",
          "reference_devanagari": "म आज घर जाँदै छु।",
          "notes": "male, quiet room"
        }
      ]
    }

Do not commit copyrighted media without a license.

WER/CER is computed only when clips exist. Tests skip when this folder has no audio.

The pipeline under test is:

    audio → Whisper (language=ne) → Devanagari reference comparison

Romanization is measured separately against Devanagari goldens, not against audio.
