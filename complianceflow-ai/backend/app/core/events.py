import asyncio
from typing import Dict, List, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime
import uuid
import structlog
from typing import Optional

logger = structlog.get_logger()

@dataclass
class AgentEvent:
    id: str
    agent_name: str
    event_type: str  # 'thought', 'action', 'result', 'error', 'handoff'
    payload: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.utcnow)
    parent_id: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "agent_name": self.agent_name,
            "event_type": self.event_type,
            "payload": self.payload,
            "timestamp": self.timestamp.isoformat(),
            "parent_id": self.parent_id
        }

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._history: List[AgentEvent] = []
        self._lock = asyncio.Lock()

    async def publish(self, event: AgentEvent):
        async with self._lock:
            self._history.append(event)

        # Notify websocket subscribers
        if "websocket" in self._subscribers:
            for callback in self._subscribers["websocket"]:
                try:
                    await callback(event.to_dict())
                except Exception as e:
                    logger.error("websocket_notify_failed", error=str(e))

        # Notify agent-specific subscribers
        agent_key = f"agent:{event.agent_name}"
        if agent_key in self._subscribers:
            for callback in self._subscribers[agent_key]:
                try:
                    await callback(event)
                except Exception as e:
                    logger.error("agent_notify_failed", agent=event.agent_name, error=str(e))

    def subscribe(self, channel: str, callback: Callable):
        if channel not in self._subscribers:
            self._subscribers[channel] = []
        self._subscribers[channel].append(callback)

    def unsubscribe(self, channel: str, callback: Callable):
        if channel in self._subscribers:
            self._subscribers[channel] = [c for c in self._subscribers[channel] if c != callback]

    def get_history(self, agent_name: Optional[str] = None) -> List[Dict]:
        events = self._history
        if agent_name:
            events = [e for e in events if e.agent_name == agent_name]
        return [e.to_dict() for e in events]

    def clear_history(self):
        self._history.clear()

# Global event bus instance
event_bus = EventBus()
