"""Visual context for a question: one short clip or a few frames, built by video-service."""

from typing import Any

import httpx


class MediaError(Exception):
    """video-service could not provide the clip or frames."""


async def _get(base_url: str, path: str, params: dict[str, str | int]) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.get(f"{base_url.rstrip('/')}{path}", params=params)
    except httpx.HTTPError as e:
        raise MediaError(f"video-service unreachable: {e}") from e
    if response.status_code >= 400:
        raise MediaError(
            f"video-service answered HTTP {response.status_code}: {response.text[:200]}"
        )
    body: Any = response.json()
    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, dict):
        raise MediaError("video-service returned no data")
    return data


async def fetch_clip(base_url: str, videos: list[str]) -> str:
    """Builds one Motion-JPEG AVI from all the feeds (8 frames each, 512x512, 2 fps).

    About 1 s per feed (measured 2026-11-02: 0.5-1.7 s for one feed, 8.6 s for all ten).

    Returns:
        The clip as a data URL.
    """
    data = await _get(base_url, "/api/v1/video/combined-context", {"vids": ",".join(videos)})
    clip = data.get("video_b64")
    if not isinstance(clip, str):
        raise MediaError("video-service returned no clip")
    return clip


async def fetch_frames(base_url: str, videos: list[str], max_images: int) -> list[str]:
    """Captures still frames, spread so every feed is represented within max_images.

    Returns:
        JPEG data URLs, at most max_images.
    """
    per_feed = max(1, max_images // len(videos))
    data = await _get(
        base_url,
        "/api/v1/video/combined-frames",
        {"vids": ",".join(videos), "count": per_feed},
    )
    frames = data.get("images_b64")
    if not isinstance(frames, list) or not frames:
        raise MediaError("video-service returned no frames")
    return [f for f in frames if isinstance(f, str)][:max_images]
