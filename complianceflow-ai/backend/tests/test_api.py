import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "ComplianceFlow AI"
    assert response.json()["agent_swarm"] == "Kimi K2.6"
    assert response.json()["max_sub_agents"] == 300
