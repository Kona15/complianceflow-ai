-- Enable RLS
alter table if exists compliance_jobs enable row level security;
alter table if exists audit_trail enable row level security;

-- Compliance Jobs Table
CREATE TABLE IF NOT EXISTS compliance_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'unknown',
    policy_id TEXT NOT NULL DEFAULT 'enterprise_compliance_v1',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    audit_result JSONB,
    email_draft JSONB,
    dashboard_status JSONB,
    agent_events JSONB DEFAULT '[]'::jsonb,
    final_certificate_url TEXT,
    document_url TEXT
);

-- Audit Trail Table (Immutable)
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES compliance_jobs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT now(),
    ip_address INET,
    user_agent TEXT
);

-- Policies Table
CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON compliance_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON compliance_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON compliance_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_job_id ON audit_trail(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_trail(timestamp DESC);

-- RLS Policies
CREATE POLICY "Users can view own jobs" ON compliance_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON compliance_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON compliance_jobs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own audit trail" ON audit_trail
    FOR SELECT USING (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON compliance_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default policy
INSERT INTO policies (id, name, version, description, rules, metadata)
VALUES (
    'enterprise_compliance_v1',
    'Enterprise Financial Compliance Policy',
    '1.0.0',
    'Standard compliance rules for invoices and contracts',
    '[
        {"id": "rule_amount_max", "name": "Maximum Invoice Amount", "type": "amount_threshold", "field": "amounts", "condition": "less_than_or_equal", "threshold": 50000.00, "severity": "critical", "message": "Invoice amount exceeds $50,000 threshold. Requires VP approval."},
        {"id": "rule_date_valid", "name": "Valid Invoice Date", "type": "date_validation", "field": "dates", "condition": "not_future", "severity": "high", "message": "Invoice date cannot be in the future."},
        {"id": "rule_vendor_approved", "name": "Approved Vendor List", "type": "vendor_whitelist", "field": "parties", "allowed_vendors": ["Acme Corp Inc.", "Global Supplies LLC", "TechForward Ltd.", "Strategic Partners GmbH"], "severity": "high", "message": "Vendor not found in approved vendor list."},
        {"id": "rule_clause_warranty", "name": "Warranty Clause Required", "type": "required_clause", "field": "clauses", "required_clauses": ["warranty", "liability"], "severity": "medium", "message": "Contract must include warranty and liability clauses."},
        {"id": "rule_po_match", "name": "Purchase Order Match", "type": "reference_match", "field": "po_number", "severity": "medium", "message": "Invoice must reference a valid Purchase Order number."}
    ]'::jsonb,
    '{"created_by": "compliance_team", "effective_date": "2026-01-01", "review_cycle": "quarterly"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
