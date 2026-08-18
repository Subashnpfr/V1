# Speech / library licenses used by V1 Captions

This project does not vendor Whisper weights. Models are downloaded at runtime by `faster-whisper` / CTranslate2 from Hugging Face when first used.

| Name | How used | License (typical) | Notes |
| --- | --- | --- | --- |
| OpenAI Whisper (medium, large-v3, small) | ASR via faster-whisper | MIT (OpenAI Whisper) | Confirm the snapshot you download; commercial use is generally allowed under MIT. |
| faster-whisper | Inference | MIT | See PyPI package. |
| CTranslate2 | Runtime | MIT | |
| Silero VAD | Optional VAD inside faster-whisper | Silero license (check upstream) | Not a separate pipeline. |
| FFmpeg | Audio extract / MP4 | LGPL/GPL depending on build | Use a build whose license matches distribution. |
| Google Translate (`deep-translator`) | Optional **translation** only | Service ToS | **Not** used for Romanization. Sends caption text off-machine. |

Romanization, normalization, and ASR correction are local deterministic code plus JSON lexicons in `backend/data/`.

Do not treat Romanization goldens as a licensed speech corpus. Do not add unlicensed audio to `backend/tests/data/nepali_asr/`.
