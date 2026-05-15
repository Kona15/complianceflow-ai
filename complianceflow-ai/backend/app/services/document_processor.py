import io
import re
from datetime import datetime
from typing import Dict, List, Any, Optional

import pdfplumber
import pytesseract
import structlog
from PIL import Image

logger = structlog.get_logger()


class DocumentProcessor:
    """
    Extracts structured data from PDFs and images.
    Supports invoices, contracts, compliance certificates.
    """

    def __init__(self):
        self.supported_types = {
            "application/pdf": self._process_pdf,
            "image/png": self._process_image,
            "image/jpeg": self._process_image,
            "image/jpg": self._process_image,
        }

    def _detect_mime_type(self, filename: str) -> str:
        """Detect mime type from filename extension."""

        filename = filename.lower()

        if filename.endswith(".pdf"):
            return "application/pdf"

        elif filename.endswith(".png"):
            return "image/png"

        elif filename.endswith(".jpg") or filename.endswith(".jpeg"):
            return "image/jpeg"

        return "unknown"

    async def process(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """Main entry point for document processing."""

        # Detect mime type
        mime = self._detect_mime_type(filename)

        logger.info(
            "document_processing_started",
            filename=filename,
            mime=mime
        )

        if mime not in self.supported_types:
            raise ValueError(f"Unsupported file type: {mime}")

        processor = self.supported_types[mime]

        raw_text = await processor(file_bytes)

        # Extract structured fields
        extracted = self._extract_fields(raw_text, filename)

        return {
            "filename": filename,
            "mime_type": mime,
            "raw_text": raw_text[:10000],
            "extracted_fields": extracted,
            "processed_at": datetime.utcnow().isoformat()
        }

    async def _process_pdf(self, file_bytes: bytes) -> str:
        """Extract text from PDF using pdfplumber."""

        text_parts = []

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()

                if page_text:
                    text_parts.append(
                        f"--- Page {i + 1} ---\n{page_text}"
                    )

        return "\n\n".join(text_parts)

    async def _process_image(self, file_bytes: bytes) -> str:
        """Extract text from image using OCR."""

        image = Image.open(io.BytesIO(file_bytes))

        # Convert to grayscale for better OCR
        image = image.convert("L")

        text = pytesseract.image_to_string(
            image,
            config="--psm 6"
        )

        return text

    def _extract_fields(self, text: str, filename: str) -> Dict[str, Any]:
        """Extract key-value pairs from document text using regex patterns."""

        fields = {
            "document_type": self._detect_document_type(text, filename),
            "amounts": self._extract_amounts(text),
            "dates": self._extract_dates(text),
            "parties": self._extract_parties(text),
            "clauses": self._extract_clauses(text),
            "invoice_number": self._extract_invoice_number(text),
            "po_number": self._extract_po_number(text),
        }

        return fields

    def _detect_document_type(self, text: str, filename: str) -> str:
        """Detect document type based on content."""

        text_lower = text.lower()
        filename_lower = filename.lower()

        if "invoice" in text_lower or "inv" in filename_lower:
            return "invoice"

        elif "contract" in text_lower or "agreement" in text_lower:
            return "contract"

        elif "certificate" in text_lower or "compliance" in text_lower:
            return "compliance_certificate"

        elif "po" in text_lower or "purchase order" in text_lower:
            return "purchase_order"

        return "unknown"

    def _extract_amounts(self, text: str) -> List[Dict]:
        """Extract monetary amounts with currency."""

        patterns = [
            r'(?:Total|Amount|Sum|Price)[\s:]*[$€£]?\s*([\d,]+\.\d{2})',
            r'[$€£]\s*([\d,]+\.\d{2})',
            r'([\d,]+\.\d{2})\s*(?:USD|EUR|GBP)',
        ]

        amounts = []

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)

            for match in matches:
                amounts.append({
                    "value": match.replace(",", ""),
                    "currency": "USD",
                    "context": "extracted"
                })

        return amounts[:10]

    def _extract_dates(self, text: str) -> List[str]:
        """Extract dates in various formats."""

        patterns = [
            r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b',
            r'\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b',
            r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b',
        ]

        dates = []

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)

        return list(set(dates))[:10]

    def _extract_parties(self, text: str) -> List[str]:
        """Extract company/party names."""

        patterns = [
            r'(?:From|Vendor|Supplier|Seller|Company)[\s:]*([A-Z][A-Za-z0-9\s&.,]+(?:Inc|LLC|Ltd|Corp|GmbH|\.))',
            r'(?:To|Buyer|Client|Customer)[\s:]*([A-Z][A-Za-z0-9\s&.,]+(?:Inc|LLC|Ltd|Corp|GmbH|\.))',
        ]

        parties = []

        for pattern in patterns:
            matches = re.findall(pattern, text)
            parties.extend(matches)

        return list(set(parties))[:5]

    def _extract_clauses(self, text: str) -> List[Dict]:
        """Extract legal/compliance clauses."""

        clause_keywords = [
            "warranty",
            "liability",
            "indemnification",
            "termination",
            "force majeure",
            "governing law",
            "confidentiality",
            "payment terms",
            "delivery",
            "penalty",
            "sla",
            "compliance"
        ]

        clauses = []

        text_lower = text.lower()

        for keyword in clause_keywords:
            if keyword in text_lower:
                idx = text_lower.find(keyword)

                start = max(0, idx - 100)
                end = min(len(text), idx + 200)

                context = text[start:end].strip()

                clauses.append({
                    "type": keyword,
                    "present": True,
                    "context": context
                })

        return clauses

    def _extract_invoice_number(self, text: str) -> Optional[str]:
        """Extract invoice number."""

        match = re.search(
            r'(?:Invoice\s*(?:No|Number|#)[:\s]*)([A-Z0-9\-]+)',
            text,
            re.IGNORECASE
        )

        return match.group(1) if match else None

    def _extract_po_number(self, text: str) -> Optional[str]:
        """Extract purchase order number."""

        match = re.search(
            r'(?:PO|P\.O\.|Purchase Order)\s*(?:No|Number|#)[:\s]*([A-Z0-9\-]+)',
            text,
            re.IGNORECASE
        )

        return match.group(1) if match else None


# Singleton instance
document_processor = DocumentProcessor()