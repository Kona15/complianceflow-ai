import pytest
from app.services.policy_engine import PolicyEngine

@pytest.fixture
def engine():
    return PolicyEngine(policies_dir="policies")

@pytest.mark.asyncio
async def test_default_policy_loaded(engine):
    policy = engine.get_policy("enterprise_compliance_v1")
    assert policy is not None
    assert policy["name"] == "Enterprise Financial Compliance Policy"
    assert len(policy["rules"]) == 5

@pytest.mark.asyncio
async def test_amount_threshold_violation(engine):
    extracted = {
        "amounts": [{"value": "75000.00", "currency": "USD"}],
        "dates": ["01/15/2026"],
        "parties": ["Test Vendor Inc."],
        "clauses": [{"type": "warranty", "present": True}],
        "po_number": "PO-123"
    }
    discrepancies = engine.evaluate("enterprise_compliance_v1", extracted)
    assert any(d["rule_id"] == "rule_amount_max" for d in discrepancies)

@pytest.mark.asyncio
async def test_vendor_whitelist_violation(engine):
    extracted = {
        "amounts": [{"value": "1000.00"}],
        "dates": ["01/15/2026"],
        "parties": ["Unknown Vendor LLC"],
        "clauses": [{"type": "warranty", "present": True}],
        "po_number": "PO-123"
    }
    discrepancies = engine.evaluate("enterprise_compliance_v1", extracted)
    assert any(d["rule_id"] == "rule_vendor_approved" for d in discrepancies)

@pytest.mark.asyncio
async def test_fully_compliant(engine):
    extracted = {
        "amounts": [{"value": "10000.00"}],
        "dates": ["01/15/2026"],
        "parties": ["Acme Corp Inc."],
        "clauses": [
            {"type": "warranty", "present": True},
            {"type": "liability", "present": True}
        ],
        "po_number": "PO-123"
    }
    discrepancies = engine.evaluate("enterprise_compliance_v1", extracted)
    assert len(discrepancies) == 0
