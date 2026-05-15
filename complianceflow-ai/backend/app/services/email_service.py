import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from typing import Dict, List, Optional
from app.core.config import get_settings
import structlog

logger = structlog.get_logger()

class EmailService:
    """
    Professional email drafting and sending service.
    Used by the Negotiator Agent for human-in-the-loop approval workflow.
    """

    def __init__(self):
        self.settings = get_settings()
        self.smtp_host = self.settings.smtp_host
        self.smtp_port = self.settings.smtp_port
        self.smtp_user = self.settings.smtp_user
        self.smtp_pass = self.settings.smtp_pass

    def draft_discrepancy_email(
        self,
        recipient_email: str,
        recipient_name: str,
        document_name: str,
        discrepancies: List[Dict],
        suggested_fixes: List[str],
        sender_name: str = "ComplianceFlow AI",
        sender_email: str = "compliance@complianceflow.ai"
    ) -> Dict[str, str]:
        """Draft a professional email for compliance discrepancies."""

        email_template = Template('''
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
        .discrepancy { background: white; border-left: 4px solid #ef4444; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .severity-critical { border-left-color: #dc2626; }
        .severity-high { border-left-color: #ea580c; }
        .severity-medium { border-left-color: #ca8a04; }
        .fix { background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin: 8px 0; border-radius: 4px; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
        .btn { display: inline-block; background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>🔍 Compliance Review Required</h2>
        <p>Document: {{ document_name }}</p>
    </div>
    <div class="content">
        <p>Dear {{ recipient_name }},</p>
        <p>Our automated compliance system has identified <strong>{{ discrepancy_count }} item(s)</strong> in <strong>{{ document_name }}</strong> that require your attention before processing can continue.</p>

        <h3>⚠️ Discrepancies Found:</h3>
        {% for d in discrepancies %}
        <div class="discrepancy severity-{{ d.severity }}">
            <strong>{{ d.rule_name }}</strong> ({{ d.severity|upper }})<br>
            {{ d.message }}<br>
            <em>Expected: {{ d.expected }} | Found: {{ d.actual }}</em>
        </div>
        {% endfor %}

        <h3>✅ Required Actions:</h3>
        {% for fix in suggested_fixes %}
        <div class="fix">
            {{ loop.index }}. {{ fix }}
        </div>
        {% endfor %}

        <p>Please address these items and resubmit the corrected document. If you believe any of these findings are incorrect, you may request a manual review through the ComplianceFlow dashboard.</p>

        <a href="https://complianceflow.ai/dashboard" class="btn">View in Dashboard</a>
    </div>
    <div class="footer">
        <p>Sent by ComplianceFlow AI — Automated Compliance Orchestration</p>
        <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
</body>
</html>
''')

        html_content = email_template.render(
            recipient_name=recipient_name,
            document_name=document_name,
            discrepancy_count=len(discrepancies),
            discrepancies=discrepancies,
            suggested_fixes=suggested_fixes
        )

        subject = f"[Action Required] Compliance Issues in {document_name}"

        return {
            "subject": subject,
            "html_body": html_content,
            "recipient": recipient_email,
            "sender": sender_email,
            "status": "drafted",
            "requires_approval": True
        }

    async def send_email(self, email_data: Dict[str, str]) -> Dict[str, str]:
        """Send the approved email via SMTP."""

        if not all([self.smtp_user, self.smtp_pass]):
            logger.warning("smtp_not_configured", message="Email not sent - SMTP credentials missing")
            return {**email_data, "status": "failed", "error": "SMTP not configured"}

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = email_data["subject"]
            msg['From'] = email_data["sender"]
            msg['To'] = email_data["recipient"]

            html_part = MIMEText(email_data["html_body"], 'html')
            msg.attach(html_part)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_pass)
                server.send_message(msg)

            logger.info("email_sent", recipient=email_data["recipient"], subject=email_data["subject"])
            return {**email_data, "status": "sent", "sent_at": "now"}

        except Exception as e:
            logger.error("email_send_failed", error=str(e))
            return {**email_data, "status": "failed", "error": str(e)}

    def draft_approval_notification(
        self,
        approver_name: str,
        document_name: str,
        email_preview: str
    ) -> Dict[str, str]:
        """Draft notification for human approver."""

        template = Template('''
<p>Hi {{ approver_name }},</p>
<p>The Negotiator Agent has drafted an email regarding compliance discrepancies in <strong>{{ document_name }}</strong>.</p>
<p><strong>Preview:</strong></p>
<blockquote style="border-left: 3px solid #ccc; padding-left: 10px; color: #555;">
    {{ email_preview[:500] }}...
</blockquote>
<p>Please review and approve before sending to the vendor.</p>
<p><a href="https://complianceflow.ai/approvals" style="background: #0f172a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review & Approve</a></p>
''')

        html = template.render(
            approver_name=approver_name,
            document_name=document_name,
            email_preview=email_preview
        )

        return {
            "subject": f"[Approval Needed] Email Draft for {document_name}",
            "html_body": html,
            "status": "pending_approval",
            "requires_approval": True
        }

# Singleton
email_service = EmailService()
