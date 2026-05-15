import json
from typing import Dict, List, Any, Optional
from pathlib import Path
import structlog

logger = structlog.get_logger()

class PolicyEngine:
    """
    JSON-based policy rule engine for compliance verification.
    Supports amount thresholds, date validations, vendor whitelists,
    required clauses, and custom rule types.
    """

    def __init__(self, policies_dir: str = "policies"):
        self.policies_dir = Path(policies_dir)
        self.policies: Dict[str, Dict] = {}
        self._load_policies()

    def _load_policies(self):
        """Load all JSON policy files from the policies directory."""
        if not self.policies_dir.exists():
            self.policies_dir.mkdir(parents=True, exist_ok=True)
            # Create default policy
            self._create_default_policy()

        for policy_file in self.policies_dir.glob("*.json"):
            with open(policy_file, 'r') as f:
                policy = json.load(f)
                self.policies[policy["id"]] = policy
                logger.info("policy_loaded", policy_id=policy["id"], name=policy["name"])

    def _create_default_policy(self):
        """Create a default enterprise compliance policy."""
        default = {
            "id": "enterprise_compliance_v1",
            "name": "Enterprise Financial Compliance Policy",
            "version": "1.0.0",
            "description": "Standard compliance rules for invoices and contracts",
            "rules": [
                {
                    "id": "rule_amount_max",
                    "name": "Maximum Invoice Amount",
                    "type": "amount_threshold",
                    "field": "amounts",
                    "condition": "less_than_or_equal",
                    "threshold": 50000.00,
                    "severity": "critical",
                    "message": "Invoice amount exceeds $50,000 threshold. Requires VP approval."
                },
                {
                    "id": "rule_date_valid",
                    "name": "Valid Invoice Date",
                    "type": "date_validation",
                    "field": "dates",
                    "condition": "not_future",
                    "severity": "high",
                    "message": "Invoice date cannot be in the future."
                },
                {
                    "id": "rule_vendor_approved",
                    "name": "Approved Vendor List",
                    "type": "vendor_whitelist",
                    "field": "parties",
                    "allowed_vendors": [
                        "Acme Corp Inc.",
                        "Global Supplies LLC",
                        "TechForward Ltd.",
                        "Strategic Partners GmbH"
                    ],
                    "severity": "high",
                    "message": "Vendor not found in approved vendor list."
                },
                {
                    "id": "rule_clause_warranty",
                    "name": "Warranty Clause Required",
                    "type": "required_clause",
                    "field": "clauses",
                    "required_clauses": ["warranty", "liability"],
                    "severity": "medium",
                    "message": "Contract must include warranty and liability clauses."
                },
                {
                    "id": "rule_po_match",
                    "name": "Purchase Order Match",
                    "type": "reference_match",
                    "field": "po_number",
                    "severity": "medium",
                    "message": "Invoice must reference a valid Purchase Order number."
                }
            ],
            "metadata": {
                "created_by": "compliance_team",
                "effective_date": "2026-01-01",
                "review_cycle": "quarterly"
            }
        }

        with open(self.policies_dir / "enterprise_compliance_v1.json", 'w') as f:
            json.dump(default, f, indent=2)

        self.policies["enterprise_compliance_v1"] = default

    def get_policy(self, policy_id: str) -> Optional[Dict]:
        return self.policies.get(policy_id)

    def list_policies(self) -> List[Dict]:
        return [{"id": k, "name": v["name"], "version": v["version"]} 
                for k, v in self.policies.items()]

    def evaluate(self, policy_id: str, extracted_fields: Dict[str, Any]) -> List[Dict]:
        """Evaluate extracted document fields against policy rules."""

        policy = self.get_policy(policy_id)
        if not policy:
            raise ValueError(f"Policy {policy_id} not found")

        discrepancies = []

        for rule in policy["rules"]:
            result = self._evaluate_rule(rule, extracted_fields)
            if not result["compliant"]:
                discrepancies.append({
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "severity": rule["severity"],
                    "message": rule["message"],
                    "field": rule["field"],
                    "expected": result.get("expected"),
                    "actual": result.get("actual"),
                    "suggested_fix": result.get("suggested_fix")
                })

        logger.info("policy_evaluation_complete", 
                   policy_id=policy_id, 
                   total_rules=len(policy["rules"]),
                   discrepancies=len(discrepancies))

        return discrepancies

    def _evaluate_rule(self, rule: Dict, fields: Dict[str, Any]) -> Dict:
        """Evaluate a single rule against document fields."""

        rule_type = rule["type"]
        field_value = fields.get(rule["field"])

        if rule_type == "amount_threshold":
            return self._check_amount_threshold(rule, field_value)
        elif rule_type == "date_validation":
            return self._check_date_validation(rule, field_value)
        elif rule_type == "vendor_whitelist":
            return self._check_vendor_whitelist(rule, field_value)
        elif rule_type == "required_clause":
            return self._check_required_clause(rule, field_value)
        elif rule_type == "reference_match":
            return self._check_reference_match(rule, field_value)

        return {"compliant": True}  # Unknown rule types pass by default

    def _check_amount_threshold(self, rule: Dict, amounts: List[Dict]) -> Dict:
        if not amounts:
            return {"compliant": False, "actual": "No amounts found", "expected": f"<= ${rule['threshold']}"}

        for amount in amounts:
            val = float(amount["value"])
            if val > rule["threshold"]:
                return {
                    "compliant": False,
                    "actual": f"${val:,.2f}",
                    "expected": f"<= ${rule['threshold']:,.2f}",
                    "suggested_fix": f"Split invoice or obtain VP approval for amount exceeding ${rule['threshold']:,.2f}"
                }
        return {"compliant": True}

    def _check_date_validation(self, rule: Dict, dates: List[str]) -> Dict:
        from datetime import datetime

        if not dates:
            return {"compliant": False, "actual": "No dates found", "expected": "Valid date required"}

        # Simple check: if any date parsing fails or is in future
        for date_str in dates:
            try:
                # Try common formats
                for fmt in ["%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y"]:
                    try:
                        parsed = datetime.strptime(date_str, fmt)
                        if parsed > datetime.now():
                            return {
                                "compliant": False,
                                "actual": date_str,
                                "expected": "Date not in future",
                                "suggested_fix": "Correct invoice date to today or earlier"
                            }
                        break
                    except ValueError:
                        continue
            except Exception:
                continue

        return {"compliant": True}

    def _check_vendor_whitelist(self, rule: Dict, parties: List[str]) -> Dict:
        if not parties:
            return {"compliant": False, "actual": "No vendor found", "expected": "Approved vendor"}

        allowed = rule.get("allowed_vendors", [])
        for party in parties:
            if any(allowed_vendor.lower() in party.lower() for allowed_vendor in allowed):
                return {"compliant": True}

        return {
            "compliant": False,
            "actual": parties[0] if parties else "Unknown",
            "expected": f"One of: {', '.join(allowed)}",
            "suggested_fix": "Submit vendor onboarding form or use approved vendor"
        }

    def _check_required_clause(self, rule: Dict, clauses: List[Dict]) -> Dict:
        if not clauses:
            return {"compliant": False, "actual": "No clauses found", "expected": rule["required_clauses"]}

        found_types = [c["type"] for c in clauses]
        missing = [req for req in rule["required_clauses"] if req not in found_types]

        if missing:
            return {
                "compliant": False,
                "actual": f"Missing: {', '.join(missing)}",
                "expected": f"Required: {', '.join(rule['required_clauses'])}",
                "suggested_fix": f"Add the following clauses to the contract: {', '.join(missing)}"
            }

        return {"compliant": True}

    def _check_reference_match(self, rule: Dict, po_number: Optional[str]) -> Dict:
        if not po_number:
            return {
                "compliant": False,
                "actual": "No PO number found",
                "expected": "Valid PO reference",
                "suggested_fix": "Add Purchase Order number to the invoice"
            }
        return {"compliant": True}

# Singleton
policy_engine = PolicyEngine()
