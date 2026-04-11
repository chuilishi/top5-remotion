---
name: bilibili-search
description: "Search and retrieve video information from Bilibili (哔哩哔哩/B站) using bilibili-cli. Use when: finding videos on Bilibili, searching B站 content by keyword, getting video details by BV ID, listing UP主 videos, researching Chinese video content, collecting bilibili video URLs for downloading. Keywords: bilibili, B站, 哔哩哔哩, bvid, video search, 视频搜索"
---

# Bilibili Video Search

Search and retrieve video information from Bilibili (哔哩哔哩) using the `bili` CLI tool (bilibili-cli). Automatically uses browser cookies for authentication — no manual setup needed.

## Prerequisites

`bili` is installed globally via `uv tool install bilibili-cli`. The executable is `bili`.

## Commands

### 1. Search Videos

```bash
bili search "关键词" --type video --max 20 --json
```

- `--type video` — search videos (default is `user`)
- `--max N` — number of results (default 20)
- `--page N` — page number (default 1)
- `--json` — structured JSON output
- `--yaml` — YAML output (good for AI agents)

**Output fields**: `bvid`, `title`, `author`, `play`, `duration`

### 2. Get Video Details

```bash
bili video {BVID} --json
```

### 3. List UP主's Videos

```bash
bili user-videos {UID_OR_NAME} --max 20 --json
```

`UID_OR_NAME` can be a numeric UID or username (searches for first match).

### 4. Search Users

```bash
bili search "用户名" --type user --json
```

### 5. View UP主 Profile

```bash
bili user {UID_OR_NAME} --json
```

## Tips

- The video URL for yt-dlp download is: `https://www.bilibili.com/video/{bvid}/`
- Use `--json` for structured output when parsing results programmatically
- Try multiple keyword variations (Chinese + English) to maximize coverage
- Unlike the raw API, `bili` handles cookie extraction and rate limiting automatically
- For more commands: `bili --help` or `bili {command} --help`
