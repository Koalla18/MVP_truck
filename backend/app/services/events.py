from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

import anyio


class EventBus:
    """In-memory per-process event bus.

    For production horizontal scaling, replace with Redis PubSub.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)

    def subscribe(self, company_id: str) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=1000)
        self._subscribers[company_id].add(q)
        return q

    def unsubscribe(self, company_id: str, q: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers[company_id].discard(q)
        if not self._subscribers[company_id]:
            self._subscribers.pop(company_id, None)

    async def publish(self, company_id: str, event: dict[str, Any]) -> None:
        queues = list(self._subscribers.get(company_id, ()))
        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Drop oldest style behavior: if consumer is slow, we skip to protect server.
                try:
                    _ = q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass


def publish_event(company_id: str, event: dict[str, Any]) -> None:
    """Publish from sync or async contexts."""

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # Running in threadpool context
        anyio.from_thread.run(event_bus.publish, company_id, event)
        return
    loop.create_task(event_bus.publish(company_id, event))


event_bus = EventBus()
