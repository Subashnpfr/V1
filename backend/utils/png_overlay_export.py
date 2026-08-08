import os
import base64
import struct
import subprocess
from pathlib import Path
from typing import List, Dict, Any

def export_video_with_png_overlays(
    video_path: str,
    output_path: str,
    frames: List[Dict[str, Any]],
    temp_dir: str = "temp"
) -> str:
    abs_video = Path(video_path).resolve()
    abs_output = Path(output_path).resolve()
    abs_temp_dir = Path(temp_dir).resolve()

    abs_output.parent.mkdir(parents=True, exist_ok=True)
    abs_temp_dir.mkdir(parents=True, exist_ok=True)

    print(f"[EXPORT] input: {abs_video}")
    print(f"[EXPORT] overlay frames count: {len(frames) if frames else 0}")
    print(f"[EXPORT] output: {abs_output}")

    if not abs_video.exists():
        raise FileNotFoundError(f"Input video missing: {abs_video}")

    if not frames or len(frames) == 0:
        raise ValueError("No PNG overlay frames provided for subtitle export.")

    saved_frames = []
    frame_width = 1920
    frame_height = 1080
    empty_png_path = abs_temp_dir / "empty_transparent.png"

    try:
        # Step 1: Decode Base64 transparent PNG overlay frames
        for idx, item in enumerate(frames):
            b64_data = item.get("image_data", "")
            if "," in b64_data:
                b64_data = b64_data.split(",", 1)[1]

            img_bytes = base64.b64decode(b64_data)
            frame_path = abs_temp_dir / f"frame_{idx:04d}.png"

            with open(frame_path, "wb") as f:
                f.write(img_bytes)

            # Extract PNG dimensions from header (bytes 16..24)
            if len(img_bytes) >= 24:
                try:
                    w, h = struct.unpack('>II', img_bytes[16:24])
                    if w > 0 and h > 0:
                        frame_width, frame_height = w, h
                except Exception:
                    pass

            saved_frames.append({
                "path": frame_path,
                "start": float(item.get("start", 0.0)),
                "end": float(item.get("end", 0.0))
            })

        # Sort frames by start timestamp
        saved_frames.sort(key=lambda x: x["start"])

        # Step 2: Generate matching WxH 0-alpha transparent PNG for gaps
        cmd_empty = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=black@0.0:s={frame_width}x{frame_height}:d=0.1",
            "-vframes", "1",
            str(empty_png_path)
        ]
        res_empty = subprocess.run(cmd_empty, capture_output=True, text=True)
        if res_empty.returncode != 0 or not empty_png_path.exists():
            print(f"[EXPORT ERROR] Failed to create transparent blank PNG: {res_empty.stderr}")
            # Fallback 1x1 if ffmpeg lavfi fails
            with open(empty_png_path, "wb") as f:
                f.write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="))

        # Step 3: Write concat demuxer script (inputs.txt) mapping video timeline
        inputs_txt_path = abs_temp_dir / "inputs.txt"
        current_time = 0.0

        with open(inputs_txt_path, "w", encoding="utf-8") as f:
            for item in saved_frames:
                start_t = item["start"]
                end_t = item["end"]

                # Fill gap before this frame if gap > 0.02s (prevents micro-gap flashes)
                if start_t > current_time + 0.02:
                    gap_dur = start_t - current_time
                    f.write(f"file '{empty_png_path.as_posix()}'\n")
                    f.write(f"duration {gap_dur:.3f}\n")

                frame_dur = max(0.02, end_t - start_t)
                f.write(f"file '{item['path'].as_posix()}'\n")
                f.write(f"duration {frame_dur:.3f}\n")
                current_time = end_t

            # Add final trailing transparent frame to terminate sequence
            f.write(f"file '{empty_png_path.as_posix()}'\n")
            f.write("duration 1.0\n")

        print(f"[EXPORT] Concat Demuxer Script created at: {inputs_txt_path}")

        # Step 4: Execute FFmpeg single-pass overlay command with scale2ref for perfect resolution matching
        cmd = [
            "ffmpeg", "-y",
            "-safe", "0",
            "-f", "concat",
            "-i", str(inputs_txt_path),
            "-i", str(abs_video),
            "-filter_complex", "[1:v][0:v]overlay=0:0:format=auto[outv]",
            "-map", "[outv]",
            "-map", "1:a?",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "copy",
            "-metadata", "comment=Created by Subash Nepal · nepalsubash.com.np",
            "-metadata", "artist=Subash Nepal",
            str(abs_output)
        ]

        print(f"[EXPORT] Executing FFmpeg command: {' '.join(cmd)}")
        res = subprocess.run(cmd, capture_output=True, text=True)

        print(f"[EXPORT] return code: {res.returncode}")
        print(f"[EXPORT] stderr: {res.stderr[-500:] if res.stderr else 'None'}")
        print(f"[EXPORT] exists: {abs_output.exists()}")

        if res.returncode != 0:
            print(f"[EXPORT ERROR STDERR FULL]:\n{res.stderr}")
            raise RuntimeError(f"FFmpeg subtitle burning failed with returncode {res.returncode}:\n{res.stderr}")

        # Step 5: Verify final MP4 output file exists and is non-empty
        assert abs_output.exists(), f"Export output file missing: {abs_output}"
        assert abs_output.stat().st_size > 1000, f"Export output file is empty (size {abs_output.stat().st_size} bytes): {abs_output}"

        print(f"[EXPORT SUCCESS] Final subtitled MP4 verified: {abs_output} ({abs_output.stat().st_size} bytes)")
        return str(abs_output)

    finally:
        # Clean up all temp frame PNGs and concat script
        for fitem in saved_frames:
            if fitem["path"].exists():
                try:
                    fitem["path"].unlink()
                except Exception:
                    pass
        if empty_png_path.exists():
            try:
                empty_png_path.unlink()
            except Exception:
                pass
        if (abs_temp_dir / "inputs.txt").exists():
            try:
                (abs_temp_dir / "inputs.txt").unlink()
            except Exception:
                pass


