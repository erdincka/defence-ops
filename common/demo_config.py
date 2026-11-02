"""Demo settings saved by the UI on the shared app-data volume."""

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

CONFIG_PATH = Path(os.environ.get("CONFIG_PATH", "/app/data/config.json"))


def _read_demo_services() -> dict[str, Any]:
    text = CONFIG_PATH.read_text(encoding="utf-8")
    services = json.loads(text).get("demo_services", {})
    return services if isinstance(services, dict) else {}


async def load_demo_config() -> dict[str, Any]:
    """Reads the demo settings that the UI saved to the shared volume.

    All services run in one pod and mount the same volume, so the file is the single source;
    secrets in it never pass through the UI's HTTP API.

    Returns:
        The ``demo_services`` section, or an empty dict when nothing has been saved yet or the
        file cannot be read.
    """
    try:
        return await asyncio.to_thread(_read_demo_services)
    except FileNotFoundError:
        logger.info("demo_config_not_saved_yet", path=str(CONFIG_PATH))
    except (OSError, ValueError, AttributeError) as e:
        logger.error("demo_config_unreadable", path=str(CONFIG_PATH), error=str(e))
    return {}
