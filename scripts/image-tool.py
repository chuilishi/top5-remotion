"""Image utility: extract frames from video or resize existing images.

Both modes auto-scale output so the longest edge ≤ --max-dim pixels
(default 1568, Anthropic's recommended optimum for Claude API).

Usage:
    uv run scripts/image-tool.py extract video.mp4 10 output.jpg
    uv run scripts/image-tool.py extract video.mp4 0:29.667 frame.png --max-dim 1200
    uv run scripts/image-tool.py resize input.jpg output.jpg
    uv run scripts/image-tool.py resize input.png output.jpg --max-dim 1200
"""

import argparse
import subprocess
import sys
from pathlib import Path


def _scale_filter(max_dim: int) -> str:
    return f"scale='min({max_dim},iw)':'min({max_dim},ih)':force_original_aspect_ratio=decrease"


def _quality_args(output: Path) -> list[str]:
    if output.suffix.lower() in (".jpg", ".jpeg"):
        return ["-q:v", "2"]
    return []


def cmd_extract(args: argparse.Namespace) -> None:
    video = Path(args.input)
    if not video.exists():
        print(f"Error: {video} not found", file=sys.stderr)
        sys.exit(1)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(args.time),
        "-i", str(video),
        "-vf", _scale_filter(args.max_dim),
        "-frames:v", "1", "-update", "1",
        *_quality_args(out),
        str(out),
    ]

    result = subprocess.run(cmd, capture_output=True)
    if not out.exists():
        print(f"Error: ffmpeg failed to produce {out}", file=sys.stderr)
        if result.stderr:
            print(result.stderr.decode(errors="replace"), file=sys.stderr)
        sys.exit(1)

    print(f"OK: {out}")


def cmd_resize(args: argparse.Namespace) -> None:
    src = Path(args.input)
    if not src.exists():
        print(f"Error: {src} not found", file=sys.stderr)
        sys.exit(1)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(src),
        "-vf", _scale_filter(args.max_dim),
        *_quality_args(out),
        str(out),
    ]

    result = subprocess.run(cmd, capture_output=True)
    if not out.exists():
        print(f"Error: ffmpeg failed to produce {out}", file=sys.stderr)
        if result.stderr:
            print(result.stderr.decode(errors="replace"), file=sys.stderr)
        sys.exit(1)

    print(f"OK: {out}")


def main():
    parser = argparse.ArgumentParser(description="Extract frames or resize images (auto-scaled for Claude API)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_extract = sub.add_parser("extract", help="Extract a single frame from a video")
    p_extract.add_argument("input", help="Source video file")
    p_extract.add_argument("time", help="Seek position (seconds or MM:SS.s)")
    p_extract.add_argument("output", help="Output image path (.jpg or .png)")
    p_extract.add_argument("--max-dim", type=int, default=1568, help="Max pixels for longest edge (default: 1568)")

    p_resize = sub.add_parser("resize", help="Resize an image to fit API limits")
    p_resize.add_argument("input", help="Source image file")
    p_resize.add_argument("output", help="Output image path (.jpg or .png)")
    p_resize.add_argument("--max-dim", type=int, default=1568, help="Max pixels for longest edge (default: 1568)")

    args = parser.parse_args()
    if args.command == "extract":
        cmd_extract(args)
    elif args.command == "resize":
        cmd_resize(args)


if __name__ == "__main__":
    main()
