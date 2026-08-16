import struct
from pathlib import Path

import pytest

from utils.png_overlay_export import (
    MAX_OVERLAY_FRAMES,
    build_overlay_filter,
    png_color_type,
    write_rgba_png,
)


def test_transparent_png_is_color_type_6(tmp_path):
    path = tmp_path / "t.png"
    write_rgba_png(path, 8, 4)
    assert png_color_type(path) == 6
    data = path.read_bytes()
    w, h = struct.unpack(">II", data[16:24])
    assert (w, h) == (8, 4)


def test_overlay_filter_keeps_video_as_base():
    graph = build_overlay_filter(
        2,
        [{"start": 0.0, "end": 1.2}, {"start": 1.2, "end": 3.0}],
        1920,
        1080,
    )
    assert graph.startswith("[1:v]format=rgba")
    assert "[0:v][o0]overlay=0:0:enable='between(t,0.000,1.200)':format=auto[v0]" in graph
    assert "[v0][o1]overlay=0:0:enable='between(t,1.200,3.000)':format=auto[outv]" in graph
    assert "concat" not in graph


def test_overlay_filter_rejects_empty():
    with pytest.raises(ValueError):
        build_overlay_filter(0, [], 1920, 1080)


def test_audio_canvas_args_use_shortest():
    from utils.png_overlay_export import audio_canvas_args, needs_black_canvas, write_black_png

    args = audio_canvas_args("input.mp3")
    assert "-loop" in args
    assert "black.png" in args
    assert "-shortest" in args
    assert "canvas.mp4" in args
    assert "color=c=0x0B0B0B" not in " ".join(args)
    assert needs_black_canvas("clip.mp3", False) is True
    assert needs_black_canvas("clip.mp4", False) is False
    assert needs_black_canvas("clip.webm", True) is True
    assert MAX_OVERLAY_FRAMES == 48


def test_black_png_is_opaque(tmp_path):
    from utils.png_overlay_export import write_black_png

    path = tmp_path / "black.png"
    write_black_png(path, 8, 4)
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    assert png_color_type(path) == 6
    # IDAT of opaque black is not empty
    assert path.stat().st_size > 40
