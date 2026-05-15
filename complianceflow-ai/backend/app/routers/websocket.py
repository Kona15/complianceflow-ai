from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from fastapi.security import HTTPBearer
from typing import Dict, Set
import json
import asyncio
from app.core.events import event_bus, AgentEvent
from app.core.config import get_settings
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/ws", tags=["websocket"])

# Active WebSocket connections per job
active_connections: Dict[str, Set[WebSocket]] = {}

async def websocket_event_handler(event_dict: dict):
    """Broadcast events to all connected clients for a job."""
    job_id = event_dict.get("payload", {}).get("job_id")
    if job_id and job_id in active_connections:
        disconnected = []
        for ws in active_connections[job_id]:
            try:
                await ws.send_json(event_dict)
            except Exception:
                disconnected.append(ws)

        # Clean up disconnected clients
        for ws in disconnected:
            active_connections[job_id].discard(ws)

# Subscribe event bus to websocket handler
event_bus.subscribe("websocket", websocket_event_handler)

@router.websocket("/agents/{job_id}")
async def agent_websocket(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time Agent Thought Process streaming.
    Clients connect here to see live step-by-step agent reasoning.
    """
    await websocket.accept()

    if job_id not in active_connections:
        active_connections[job_id] = set()
    active_connections[job_id].add(websocket)

    logger.info("websocket_connected", job_id=job_id, client_count=len(active_connections[job_id]))

    try:
        # Send connection confirmation
        await websocket.send_json({
            "id": "conn_established",
            "agent_name": "System",
            "event_type": "connection",
            "payload": {
                "message": "Connected to Agent Thought Stream",
                "job_id": job_id,
                "status": "streaming"
            },
            "timestamp": "now"
        })

        # Keep connection alive and handle client messages
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                data = json.loads(message)

                # Handle ping/pong
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong", "job_id": job_id})

                # Handle subscription to specific agents
                elif data.get("type") == "subscribe_agent":
                    agent_name = data.get("agent_name")
                    await websocket.send_json({
                        "type": "subscription_confirmed",
                        "agent_name": agent_name,
                        "job_id": job_id
                    })

            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                await websocket.send_json({"type": "heartbeat", "job_id": job_id})

    except WebSocketDisconnect:
        logger.info("websocket_disconnected", job_id=job_id)
    except Exception as e:
        logger.error("websocket_error", job_id=job_id, error=str(e))
    finally:
        if job_id in active_connections:
            active_connections[job_id].discard(websocket)
            if not active_connections[job_id]:
                del active_connections[job_id]

@router.websocket("/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    """Global dashboard websocket for real-time stats updates."""
    await websocket.accept()

    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)

            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("dashboard_ws_error", error=str(e))
